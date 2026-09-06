const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE_ORIGIN = 'https://www.vintageclosetpdx.com';
const BRAND_FALLBACK = 'The Vintage Closet PDX';
const APP_JS_PATH = path.join(__dirname, '..', 'js', 'app.js');
const OUTPUT_PATH = path.join(__dirname, '..', 'meta-catalog.csv');

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
  'Dickies',
  'The North Face'
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

function mapAvailability(status) {
  return String(status || '').toLowerCase() === 'sold' ? 'out of stock' : 'in stock';
}

function mapCondition(condition) {
  const value = String(condition || '').toLowerCase();
  if (/\bbrand new\b|\bnew with tags\b|\bnwt\b|^new$/i.test(value)) {
    return 'new';
  }
  return 'used';
}

function getPrimaryImage(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  const valid = images.find((image) => typeof image === 'string' && /^https?:\/\//i.test(image));
  return valid || '';
}

function getDescription(product) {
  const description = cleanText(product.description);
  if (description) return description;
  const fallback = [cleanText(product.name), product.size ? `Size ${product.size}` : '', product.category || 'Vintage clothing'];
  return fallback.filter(Boolean).join('. ');
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildRows(products) {
  const header = [
    'id',
    'title',
    'description',
    'availability',
    'condition',
    'price',
    'link',
    'image_link',
    'brand'
  ];

  const rows = [header.join(',')];

  products
    .filter((product) => product && product.status !== 'sold')
    .forEach((product) => {
      const title = cleanText(product.name);
      const image = getPrimaryImage(product);
      const price = Number(product.price || 0);
      if (!title || !image || !Number.isFinite(price) || price <= 0) return;

      const row = [
        product.code || product.id || '',
        title,
        getDescription(product),
        mapAvailability(product.status),
        mapCondition(product.condition),
        `${price.toFixed(2)} USD`,
        getProductUrl(product),
        image,
        guessBrand(product.name)
      ].map(csvEscape).join(',');

      rows.push(row);
    });

  return rows.join('\n') + '\n';
}

function main() {
  const fileText = fs.readFileSync(APP_JS_PATH, 'utf8');
  const products = parseProducts(fileText);
  const csv = buildRows(products);
  fs.writeFileSync(OUTPUT_PATH, csv, 'utf8');
  const lineCount = csv.trim().split('\n').length;
  const itemCount = Math.max(lineCount - 1, 0);
  console.log(`Wrote ${itemCount} products to ${path.basename(OUTPUT_PATH)}`);
}

main();
