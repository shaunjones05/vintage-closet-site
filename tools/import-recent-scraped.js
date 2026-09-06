#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const APP_JS = path.join(ROOT, 'js', 'app.js');
const SCRAPED_JSON = path.join(ROOT, 'scraped-recent-listings.json');

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sourceIdFromUrl(url) {
  const ebay = String(url || '').match(/\/itm\/(\d+)/i);
  if (ebay) return `eb-${ebay[1]}`;
  const depop = String(url || '').match(/\/products\/([^/]+)\/?$/i);
  if (depop) return `depop-${depop[1]}`;
  return `item-${Buffer.from(String(url || '')).toString('hex').slice(0, 12)}`;
}

function codeFromId(id, category) {
  const prefix = category === 'Jackets' ? 'JKT' : category === 'Pants' ? 'PANTS' : 'TEE';
  const compact = String(id || '').replace(/[^a-z0-9]/gi, '');
  return `${prefix}-${compact.slice(-4).toUpperCase()}`;
}

function roundPrice(price) {
  let n = Number(price) || 0;
  // Depop/analytics sometimes reports cents in large integers.
  if (n > 500) n = n / 100;
  const discounted = n * 0.8;
  return Math.max(5, Math.ceil(discounted / 5) * 5);
}

const COLOR_RULES = [
  ['off-white', 'White'], ['cream', 'Cream'], ['ivory', 'Cream'], ['white', 'White'], ['black', 'Black'],
  ['gray', 'Gray'], ['grey', 'Gray'], ['blue', 'Blue'], ['navy', 'Navy'], ['red', 'Red'],
  ['green', 'Green'], ['yellow', 'Yellow'], ['purple', 'Purple'], ['pink', 'Pink'], ['orange', 'Orange'],
  ['brown', 'Brown'], ['tan', 'Tan'], ['beige', 'Beige'], ['olive', 'Olive'], ['camo', 'Camo'],
  ['khaki', 'Khaki'], ['teal', 'Teal'], ['gold', 'Gold'], ['silver', 'Silver'], ['maroon', 'Maroon'],
  ['burgundy', 'Burgundy'], ['multicolor', 'Multicolor']
];

function detectColors(text) {
  const source = normalizeText(text).toLowerCase();
  const out = [];
  for (const [needle, label] of COLOR_RULES) {
    if (source.includes(needle) && !out.includes(label)) out.push(label);
  }
  return out;
}

function parseSize(text) {
  const source = normalizeText(text);
  const patterns = [
    /\bsize\s*[:\-]?\s*(XXXL|XXL|XL|L|M|S|XS|\d{2,3}(?:x\d{2,3})?)\b/i,
    /\btagged\s*(?:size\s*)?(XXXL|XXL|XL|L|M|S|XS|\d{2,3})\b/i,
    /\bmens\s*(small|medium|large|x-large|xl|xxl)\b/i,
    /\bwaist\s*(\d{2,3})\b/i,
    /\b(W\d{2,3}\s*L\d{2,3})\b/i
  ];

  for (const pattern of patterns) {
    const m = source.match(pattern);
    if (!m) continue;
    let value = (m[1] || '').trim();
    if (!value) continue;
    value = value.toUpperCase();
    if (value === 'SMALL') value = 'S';
    if (value === 'MEDIUM') value = 'M';
    if (value === 'LARGE') value = 'L';
    if (value === 'X-LARGE') value = 'XL';
    return value.replace(/\s+/g, '');
  }

  return '';
}

function deriveCategory(text) {
  const source = normalizeText(text).toLowerCase();
  if (/jacket|coat|windbreaker|bomber|outerwear|detroit/.test(source)) return 'Jackets';
  if (/jeans|jorts|pants|trouser|cargo|shorts/.test(source)) return 'Pants';
  if (/hoodie|crewneck|sweatshirt|sweater|pullover/.test(source)) return 'Crewnecks & Hoodies';
  return 'Tees';
}

function normalizeName(rawTitle) {
  return normalizeText(rawTitle)
    .replace(/\s*\|\s*Depop\s*$/i, '')
    .replace(/\s*\|\s*eBay\s*$/i, '')
    .trim();
}

function dedupeImages(images) {
  const out = [];
  const seen = new Set();
  for (const image of (Array.isArray(images) ? images : [])) {
    const clean = String(image || '').trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= 8) break;
  }
  return out;
}

function cleanDescription(desc) {
  return normalizeText(desc)
    .replace(/^Make offer Add to bag\s*/i, '')
    .replace(/\s+vintagecloset_pdx\s+\d+\s+sold\s*.*/i, '')
    .trim();
}

function buildProduct(item) {
  const sourceUrl = String(item.url || '').trim();
  const id = sourceIdFromUrl(sourceUrl);
  const name = normalizeName(item.title || 'Vintage Listing');
  const baseText = `${name} ${item.description || ''}`;
  const size = parseSize(baseText) || (parseSize(item.description || '') || 'One Size');
  const colors = Array.from(new Set([...(Array.isArray(item.colors) ? item.colors : []), ...detectColors(baseText)]))
    .filter(Boolean);
  const safeColors = colors.length ? colors : ['Multicolor'];

  const description = cleanDescription(item.description || name);
  const withColor = /\bcolor\b/i.test(description)
    ? description
    : `${description} Color: ${safeColors.join('/')}.`;

  const category = deriveCategory(baseText);
  const normalized = {
    id,
    code: codeFromId(id, category),
    name,
    price: roundPrice(item.price),
    size,
    condition: 'Good condition',
    description: withColor,
    images: dedupeImages(item.images),
    status: 'available',
    stripeLink: 'https://buy.stripe.com/REPLACE_WITH_YOUR_LINK',
    category
  };

  if (sourceUrl.includes('depop.com')) normalized.depopUrl = sourceUrl;
  if (sourceUrl.includes('ebay.com')) normalized.ebayUrl = sourceUrl;

  return normalized;
}

function extractProductsArray(source) {
  const marker = 'const products =';
  const idx = source.indexOf(marker);
  if (idx === -1) throw new Error('products array not found');

  const start = source.indexOf('[', idx);
  let i = start;
  let depth = 0;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) break;
    }
    if (ch === '"' || ch === '\'' || ch === '`') {
      const quote = ch;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') i += 2;
        else i++;
      }
    }
  }

  return { start, end: i, arrayText: source.slice(start, i + 1) };
}

function stringifyProduct(product) {
  return `\n  ${JSON.stringify(product, null, 2).replace(/\n/g, '\n  ')}`;
}

function main() {
  if (!fs.existsSync(SCRAPED_JSON)) {
    throw new Error(`Missing scraped input file: ${SCRAPED_JSON}`);
  }

  const scrapedText = fs.readFileSync(SCRAPED_JSON, 'utf8').replace(/^\uFEFF/, '');
  const raw = JSON.parse(scrapedText);
  const mapped = raw.map(buildProduct);

  const appSource = fs.readFileSync(APP_JS, 'utf8');
  const { end, arrayText } = extractProductsArray(appSource);

  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext('products=' + arrayText, sandbox);

  const existing = Array.isArray(sandbox.products) ? sandbox.products : [];
  const existingIds = new Set(existing.map(item => item && item.id));
  const toAdd = mapped.filter(item => !existingIds.has(item.id));

  if (toAdd.length === 0) {
    console.log('No new listings to add.');
    return;
  }

  const backup = `${APP_JS}.bak-scraped-${Date.now()}`;
  fs.writeFileSync(backup, appSource, 'utf8');

  const before = appSource.slice(0, end);
  const after = appSource.slice(end);
  const appended = toAdd.map(stringifyProduct).join(',');
  const newSource = before.replace(/\]$/, '') + (existing.length ? ',' : '') + appended + ']' + after.slice(1);

  fs.writeFileSync(APP_JS, newSource, 'utf8');

  console.log(`Added ${toAdd.length} listings.`);
  console.log('IDs:', toAdd.map(item => item.id).join(', '));
  console.log('Backup:', backup);
}

main();
