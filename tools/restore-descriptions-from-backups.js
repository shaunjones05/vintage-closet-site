#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');
const APP_JS = path.join(JS_DIR, 'app.js');

function extractProductsArray(source) {
  const match = source.match(/const products = (\[[\s\S]*?\n\]);/);
  if (!match) {
    throw new Error('Could not find products array in js/app.js style source');
  }
  return match[1];
}

function parseProductsFromFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const arrayLiteral = extractProductsArray(source);
  return vm.runInNewContext(arrayLiteral, { JACKETS_STRIPE_LINK: 'https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK' }, { timeout: 2000 });
}

function cleanDescription(value) {
  let out = String(value || '').trim();
  if (!out) return '';
  out = out.replace(/<[^>]*>/g, ' ');
  out = out.replace(/\s+/g, ' ').trim();
  if (/script|onclick=|onerror=|<\/button/i.test(out)) return '';
  return out;
}

function writeProductsBack(products) {
  const source = fs.readFileSync(APP_JS, 'utf8');
  const arrayLiteral = extractProductsArray(source);
  const replacement = JSON.stringify(products, null, 2);
  const updated = source.replace(arrayLiteral, replacement);
  fs.writeFileSync(APP_JS, updated, 'utf8');
}

function main() {
  const current = parseProductsFromFile(APP_JS);
  const backupFiles = fs.readdirSync(JS_DIR)
    .filter((name) => name.startsWith('app.js.bak'))
    .map((name) => path.join(JS_DIR, name));

  const bestDescById = new Map();

  for (const product of current) {
    const id = String(product && product.id || '');
    if (!id) continue;
    const desc = cleanDescription(product.description);
    if (desc) bestDescById.set(id, desc);
  }

  for (const file of backupFiles) {
    let products;
    try {
      products = parseProductsFromFile(file);
    } catch {
      continue;
    }
    for (const product of products) {
      const id = String(product && product.id || '');
      if (!id) continue;
      const candidate = cleanDescription(product.description);
      if (!candidate) continue;
      const currentBest = bestDescById.get(id) || '';
      if (candidate.length > currentBest.length) {
        bestDescById.set(id, candidate);
      }
    }
  }

  let updatedCount = 0;
  for (const product of current) {
    if (!product || !product.id) continue;
    const existing = cleanDescription(product.description);
    const best = bestDescById.get(String(product.id)) || '';
    if (!best) continue;
    if (best.length >= Math.max(60, existing.length + 20)) {
      product.description = best;
      updatedCount += 1;
    }
  }

  writeProductsBack(current);
  console.log(`Updated descriptions for ${updatedCount} products.`);
}

main();