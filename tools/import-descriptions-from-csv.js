#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const APP_JS = path.join(ROOT, 'js', 'app.js');

function extractProductsArray(source) {
  const match = source.match(/const products = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error('Could not find products array in js/app.js');
  return match[1];
}

function parseProducts(source) {
  const arrayLiteral = extractProductsArray(source);
  const sandbox = {
    JACKETS_STRIPE_LINK: 'https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK'
  };
  return vm.runInNewContext(arrayLiteral, sandbox, { timeout: 2000 });
}

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

function parseCsv(csvText) {
  const lines = csvText.replace(/\r/g, '').split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = splitCsvLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = (values[j] || '').trim();
    }
    rows.push(row);
  }

  return rows;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\|\s*ebay$/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDescription(value) {
  let out = String(value || '').trim();
  if (!out) return '';
  out = out.replace(/<[^>]*>/g, ' ');
  out = out.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

function readCandidate(row, names) {
  for (const n of names) {
    if (row[n] && String(row[n]).trim()) return String(row[n]).trim();
  }
  return '';
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node tools/import-descriptions-from-csv.js <path-to-export.csv>');
    process.exit(1);
  }

  const absoluteCsvPath = path.isAbsolute(inputPath) ? inputPath : path.join(process.cwd(), inputPath);
  if (!fs.existsSync(absoluteCsvPath)) {
    console.error(`CSV file not found: ${absoluteCsvPath}`);
    process.exit(1);
  }

  const appSource = fs.readFileSync(APP_JS, 'utf8');
  const products = parseProducts(appSource);
  const csvRows = parseCsv(fs.readFileSync(absoluteCsvPath, 'utf8'));

  const byId = new Map();
  const byCode = new Map();
  const byEbayNum = new Map();
  const byName = new Map();

  for (const p of products) {
    if (!p) continue;
    const id = String(p.id || '').trim();
    const code = String(p.code || '').trim().toLowerCase();
    const ebayNum = String(p.ebayItemNumber || '').trim();
    const nameKey = normalizeText(p.name);
    if (id) byId.set(id, p);
    if (code) byCode.set(code, p);
    if (ebayNum) byEbayNum.set(ebayNum, p);
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, p);
  }

  let updated = 0;
  let matched = 0;

  for (const row of csvRows) {
    const desc = cleanDescription(readCandidate(row, [
      'description',
      'product description',
      'item description',
      'full description',
      'details'
    ]));
    if (!desc || desc.length < 40) continue;

    const rowId = readCandidate(row, ['id', 'product id', 'item id']).trim();
    const rowCode = readCandidate(row, ['code', 'sku', 'product code']).trim().toLowerCase();
    const rowEbay = readCandidate(row, ['ebay item number', 'item number', 'item_number']).trim();
    const rowTitle = readCandidate(row, ['title', 'name', 'product title', 'product name']).trim();

    let product = null;
    if (rowId && byId.has(rowId)) product = byId.get(rowId);
    if (!product && rowCode && byCode.has(rowCode)) product = byCode.get(rowCode);
    if (!product && rowEbay && byEbayNum.has(rowEbay)) product = byEbayNum.get(rowEbay);
    if (!product && rowTitle) {
      const key = normalizeText(rowTitle);
      if (key && byName.has(key)) product = byName.get(key);
    }

    if (!product) continue;
    matched += 1;

    const current = cleanDescription(product.description || '');
    if (desc.length >= Math.max(80, current.length + 15)) {
      product.description = desc;
      updated += 1;
    }
  }

  const arrayLiteral = extractProductsArray(appSource);
  const updatedSource = appSource.replace(arrayLiteral, JSON.stringify(products, null, 2));
  fs.writeFileSync(APP_JS, updatedSource, 'utf8');

  console.log(`CSV rows: ${csvRows.length}`);
  console.log(`Matched products: ${matched}`);
  console.log(`Updated descriptions: ${updated}`);
}

main();