#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
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
  return vm.runInNewContext(arrayLiteral, {
    JACKETS_STRIPE_LINK: 'https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK'
  }, { timeout: 2000 });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        resolve(body);
      });
    }).on('error', reject);
  });
}

function depopProxyUrl(depopUrl) {
  const clean = String(depopUrl || '').trim();
  if (!clean) return '';
  const noProto = clean.replace(/^https?:\/\//i, '');
  return `https://r.jina.ai/http://${noProto}`;
}

function cleanText(value) {
  let out = String(value || '');
  out = out.replace(/\[(.*?)\]\((.*?)\)/g, '$1');
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

function extractDepopDescription(pageText) {
  if (!pageText) return '';

  const anchor = 'All purchases through Depop are covered by Buyer Protection';
  const anchorIndex = pageText.indexOf(anchor);
  if (anchorIndex === -1) return '';

  let chunk = pageText.slice(anchorIndex + anchor.length);
  chunk = chunk.replace(/^.*?\* \* \*/s, '');

  const stopMarkers = [
    '[#',
    'show more',
    'Recent reviews',
    'More from this seller',
    'You might also like',
    'Items from',
    'Looking for more',
    'Shop by color',
    'Visit shop',
    'Ask a question'
  ];

  let stopAt = chunk.length;
  for (const marker of stopMarkers) {
    const idx = chunk.indexOf(marker);
    if (idx !== -1 && idx < stopAt) stopAt = idx;
  }

  chunk = chunk.slice(0, stopAt);
  chunk = cleanText(chunk);

  // Keep meaningful seller description text only.
  if (!/condition\s*:|material\s*:|features\s*:/i.test(chunk) && chunk.length < 90) {
    return '';
  }

  return chunk;
}

async function main() {
  const source = fs.readFileSync(APP_JS, 'utf8');
  const products = parseProducts(source);

  const targetProducts = products.filter((p) => p && p.depopUrl);
  let updated = 0;
  let fetched = 0;
  let failed = 0;

  for (const product of targetProducts) {
    const proxyUrl = depopProxyUrl(product.depopUrl);
    if (!proxyUrl) continue;

    try {
      const text = await fetchText(proxyUrl);
      fetched += 1;
      const depopDesc = extractDepopDescription(text);
      if (!depopDesc) continue;

      const current = cleanText(product.description || '');
      if (depopDesc.length >= Math.max(90, current.length - 20)) {
        product.description = depopDesc;
        updated += 1;
      }
    } catch (error) {
      failed += 1;
      // Continue on per-item failures so one bad URL does not stop the sync.
    }
  }

  const arrayLiteral = extractProductsArray(source);
  const updatedSource = source.replace(arrayLiteral, JSON.stringify(products, null, 2));
  fs.writeFileSync(APP_JS, updatedSource, 'utf8');

  console.log(`Products with depopUrl: ${targetProducts.length}`);
  console.log(`Fetched successfully: ${fetched}`);
  console.log(`Descriptions updated: ${updated}`);
  console.log(`Fetch failures: ${failed}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});