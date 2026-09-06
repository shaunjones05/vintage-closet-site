#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP_JS = path.join(__dirname, '..', 'js', 'app.js');

function extractProductsArray(source) {
  const match = source.match(/const products = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error('Could not find products array');
  return match[1];
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function cleanDescription(value) {
  let out = decodeEntities(value);

  out = out.replace(
    /Code:\s*[A-Z0-9-]+\s*--\s*Enter this product code at checkout[^.]*\.\s*Use it when purchasing to ensure we match your payment to the correct listing\.?/gi,
    ''
  );

  out = out.replace(/\bLength:\s*\b|\bSleeve Length:\s*\b|\bShoulder to Shoulder:\s*\b/gi, '');
  out = out.replace(/\s{2,}/g, ' ').trim();

  return out;
}

function main() {
  const source = fs.readFileSync(APP_JS, 'utf8');
  const arrayLiteral = extractProductsArray(source);
  const products = vm.runInNewContext(arrayLiteral, { JACKETS_STRIPE_LINK: 'https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK' }, { timeout: 2000 });

  let cleaned = 0;
  for (const product of products) {
    const before = String(product.description || '');
    const after = cleanDescription(before);
    if (after !== before) {
      product.description = after;
      cleaned += 1;
    }
  }

  const updated = source.replace(arrayLiteral, JSON.stringify(products, null, 2));
  fs.writeFileSync(APP_JS, updated, 'utf8');
  console.log(`Cleaned descriptions for ${cleaned} products.`);
}

main();