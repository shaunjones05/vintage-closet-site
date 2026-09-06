const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE_ORIGIN = 'https://www.vintageclosetpdx.com';
const BRAND_FALLBACK = 'The Vintage Closet PDX';
const APP_JS_PATH = path.join(__dirname, '..', 'js', 'app.js');
const OUTPUT_PATH = path.join(__dirname, '..', 'merchant-feed.xml');

const KNOWN_BRANDS = [
  'Carhartt',
  'Levi\'s',
  'Levis',
  'Harley-Davidson',
  'Harley Davidson',
  'Adidas',
  'Champion',
  'Russell Athletic',
  'Liquid Blue',
  'Patagonia',
  'Polo Ralph Lauren',
  'Ralph Lauren',
  'O\'Neill',
  'Lee',
  'Wrangler',
  'Starter',
  'Hurley',
  'Nike',
  'Discus Athletic',
  'Jerzees',
  'Dickies'
];

const COLOR_PATTERNS = [
  { label: 'Black', regex: /\bblack\b/i },
  { label: 'White', regex: /\bwhite\b/i },
  { label: 'Gray', regex: /\bgray\b|\bgrey\b/i },
  { label: 'Brown', regex: /\bbrown\b|\btan\b|\bbeige\b|\bkhaki\b|\bcream\b/i },
  { label: 'Blue', regex: /\bblue\b|\bnavy\b|\bindigo\b|\blight wash\b|\bdark wash\b|\bacid wash\b/i },
  { label: 'Red', regex: /\bred\b|\bmaroon\b|\bburgundy\b|\bcrimson\b/i },
  { label: 'Green', regex: /\bgreen\b|\bolive\b/i },
  { label: 'Purple', regex: /\bpurple\b|\bviolet\b/i },
  { label: 'Yellow', regex: /\byellow\b|\bgold\b/i },
  { label: 'Orange', regex: /\borange\b|\brust\b/i },
  { label: 'Pink', regex: /\bpink\b/i },
  { label: 'Silver', regex: /\bsilver\b/i },
  { label: 'Camo', regex: /\bcamo\b|\bcamouflage\b/i },
  { label: 'Tie-Dye', regex: /\btie[\s-]?dye\b/i },
  { label: 'Multicolor', regex: /\bmulticolor\b|\bmulti-color\b|\bmulti color\b/i }
];

function slugify(value) {
  return String(value || '')
    .replace(/\s*\|\s*eBay$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s*\|\s*eBay$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractProductsSource(fileText) {
  const match = fileText.match(/const products = (\[[\s\S]*?\n\]);/);
  if (!match) {
    throw new Error('Could not find products array in js/app.js');
  }
  return match[1];
}

function parseProducts(fileText) {
  const arrayLiteral = extractProductsSource(fileText);
  const sandbox = {
    JACKETS_STRIPE_LINK: 'https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK'
  };
  return vm.runInNewContext(arrayLiteral, sandbox, { timeout: 1000 });
}

function getProductUrl(product) {
  const id = encodeURIComponent(String(product.id || ''));
  const slug = slugify(product.name);
  return `${SITE_ORIGIN}/product.html?id=${id}${slug ? `&slug=${encodeURIComponent(slug)}` : ''}`;
}

function guessBrand(name) {
  const cleanName = cleanText(name);
  for (const brand of KNOWN_BRANDS) {
    const regex = new RegExp(`(^|\\b)${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\b|$)`, 'i');
    if (regex.test(cleanName)) {
      return brand.replace(/\\'/g, "'");
    }
  }
  return BRAND_FALLBACK;
}

function uniqueColors(colors) {
  const seen = new Set();
  const out = [];
  for (const color of colors || []) {
    const key = String(color || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(color);
  }
  return out;
}

function detectColors(text) {
  const hay = String(text || '');
  const found = [];
  for (const rule of COLOR_PATTERNS) {
    if (rule.regex.test(hay)) found.push(rule.label);
  }
  return found;
}

function guessColor(product) {
  const description = String(product.description || '');
  const hay = `${product.name || ''} ${description}`;
  const explicit = [];
  const explicitMatches = description.match(/\bcolor\s*:\s*([^\.\n;]+)/ig) || [];
  for (const match of explicitMatches) {
    const raw = match.replace(/^.*?\bcolor\s*:\s*/i, '');
    explicit.push(...detectColors(raw));
  }

  const colors = uniqueColors([...explicit, ...detectColors(hay)]);
  return (colors.length ? colors : ['Multicolor']).join('/');
}

function mapCondition(condition) {
  const value = String(condition || '').toLowerCase();
  if (/\bbrand new\b|\bnew with tags\b|\bnwt\b|^new$/i.test(value)) {
    return 'new';
  }
  return 'used';
}

function mapGoogleCategory(category) {
  if (/jacket/i.test(category || '')) return 'Apparel & Accessories > Clothing > Outerwear';
  if (/pants/i.test(category || '')) return 'Apparel & Accessories > Clothing > Pants';
  if (/hood|crew/i.test(category || '')) return 'Apparel & Accessories > Clothing';
  return 'Apparel & Accessories > Clothing > Shirts & Tops';
}

function getPrimaryImage(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  const valid = images.find((image) => typeof image === 'string' && /^https?:\/\//i.test(image));
  return valid || '';
}

function getDescription(product) {
  const description = cleanText(product.description);
  if (description) return description;
  const parts = [cleanText(product.name), product.size ? `Size ${product.size}` : '', product.category || 'Vintage clothing'];
  return parts.filter(Boolean).join('. ');
}

function buildItem(product) {
  const title = cleanText(product.name);
  const image = getPrimaryImage(product);
  const price = Number(product.price || 0);
  if (!title || !image || !Number.isFinite(price) || price <= 0) return '';

  const size = cleanText(product.size);
  const color = guessColor(product);
  const item = [
    '  <item>',
    '    <g:id>' + xmlEscape(product.code || product.id) + '</g:id>',
    '    <title>' + xmlEscape(title) + '</title>',
    '    <description>' + xmlEscape(getDescription(product)) + '</description>',
    '    <link>' + xmlEscape(getProductUrl(product)) + '</link>',
    '    <g:image_link>' + xmlEscape(image) + '</g:image_link>',
    '    <g:availability>in stock</g:availability>',
    '    <g:price>' + xmlEscape(price.toFixed(2) + ' USD') + '</g:price>',
    '    <g:condition>' + xmlEscape(mapCondition(product.condition)) + '</g:condition>',
    '    <g:brand>' + xmlEscape(guessBrand(product.name)) + '</g:brand>',
    '    <g:google_product_category>' + xmlEscape(mapGoogleCategory(product.category)) + '</g:google_product_category>',
    '    <g:product_type>' + xmlEscape(product.category || 'Vintage Clothing') + '</g:product_type>',
    '    <g:identifier_exists>no</g:identifier_exists>',
    '    <g:age_group>adult</g:age_group>',
    '    <g:gender>unisex</g:gender>'
  ];

  if (size) {
    item.push('    <g:size>' + xmlEscape(size) + '</g:size>');
  }

  item.push('    <g:color>' + xmlEscape(color) + '</g:color>');

  // Shipping: flat rate $5 to US and CA
  item.push('    <g:shipping>');
  item.push('      <g:country>US</g:country>');
  item.push('      <g:service>Standard</g:service>');
  item.push('      <g:price>5.00 USD</g:price>');
  item.push('    </g:shipping>');
  item.push('    <g:shipping>');
  item.push('      <g:country>CA</g:country>');
  item.push('      <g:service>Standard</g:service>');
  item.push('      <g:price>5.00 USD</g:price>');
  item.push('    </g:shipping>');

  // Return policy: 14-day returns, buyer pays return shipping
  item.push('    <g:return_policy_label>14-day-returns</g:return_policy_label>');

  item.push('  </item>');
  return item.join('\n');
}

function buildFeed(products) {
  const items = products
    .filter((product) => product && product.status !== 'sold')
    .map(buildItem)
    .filter(Boolean)
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '<channel>',
    '  <title>The Vintage Closet PDX</title>',
    '  <link>https://www.vintageclosetpdx.com/</link>',
    '  <description>Vintage clothing inventory feed for Google Merchant Center.</description>',
    items,
    '</channel>',
    '</rss>',
    ''
  ].join('\n');
}

function main() {
  const fileText = fs.readFileSync(APP_JS_PATH, 'utf8');
  const products = parseProducts(fileText);
  const xml = buildFeed(products);
  fs.writeFileSync(OUTPUT_PATH, xml, 'utf8');
  const itemCount = (xml.match(/<item>/g) || []).length;
  console.log(`Wrote ${itemCount} products to ${path.basename(OUTPUT_PATH)}`);
}

main();