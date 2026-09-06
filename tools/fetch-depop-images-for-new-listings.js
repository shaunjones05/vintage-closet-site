#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const APP_JS = path.join(ROOT, 'js', 'app.js');

const TARGET_IDS = new Set([
  'depop-c13d',
  'depop-28ee',
  'depop-eab7',
  'depop-6a76',
  'depop-79c7',
  'depop-16a6',
  'depop-9436',
  'depop-ccb0',
  'depop-ba91',
  'depop-b618',
  'depop-15ab',
  'depop-9a61',
  'depop-b948'
]);

function extractProductsArray(source) {
  const match = source.match(/const products = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error('Could not find products array in js/app.js');
  return match[1];
}

function parseProducts(source) {
  const arrayLiteral = extractProductsArray(source);
  return vm.runInNewContext(arrayLiteral, {
    JACKETS_STRIPE_LINK: 'https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK'
  }, { timeout: 3000 });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
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

function normalizeImageUrl(url) {
  let out = String(url || '').trim();
  out = out.replace(/\\u002F/g, '/');
  out = out.replace(/\\\//g, '/');
  out = out.replace(/&amp;/g, '&');
  out = out.replace(/[)\],"'<>\s]+$/g, '');
  return out;
}

function extractDepopImages(text) {
  if (!text) return [];

  const matches = [];
  const patterns = [
    /https?:\/\/media-photos\.depop\.com\/[A-Za-z0-9\/_\-.]+\/P0\.(?:jpg|jpeg|png|webp)/gi,
    /https?:\/\/media-photos\.depop\.com\/[A-Za-z0-9\/_\-.]+/gi,
    /https?:\/\/i\.depopcdn\.com\/[A-Za-z0-9\/_\-.?=&%]+/gi
  ];

  for (const re of patterns) {
    const found = text.match(re) || [];
    for (const item of found) matches.push(normalizeImageUrl(item));
  }

  const uniq = [];
  const seen = new Set();
  for (const url of matches) {
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    uniq.push(url);
  }

  return uniq.slice(0, 8);
}

async function fetchImagesForDepopUrl(depopUrl) {
  const direct = String(depopUrl || '').trim();
  if (!direct) return [];

  const attempts = [
    direct,
    depopProxyUrl(direct)
  ].filter(Boolean);

  for (const url of attempts) {
    try {
      const text = await fetchText(url);
      const images = extractDepopImages(text);
      if (images.length > 0) return images;
    } catch (err) {
      // Continue to next fallback.
    }
  }

  return [];
}

async function main() {
  const source = fs.readFileSync(APP_JS, 'utf8');
  const products = parseProducts(source);

  const targets = products.filter((p) => p && TARGET_IDS.has(String(p.id || '')));
  if (targets.length === 0) {
    console.log('No matching new Depop products found.');
    return;
  }

  let updated = 0;
  for (const product of targets) {
    const images = await fetchImagesForDepopUrl(product.depopUrl);
    if (images.length > 0) {
      product.images = images;
      updated += 1;
      console.log(`Updated ${product.id} with ${images.length} images`);
    } else {
      console.log(`No images found for ${product.id}`);
    }
  }

  const arrayLiteral = extractProductsArray(source);
  const updatedSource = source.replace(arrayLiteral, JSON.stringify(products, null, 2));
  fs.writeFileSync(APP_JS, updatedSource, 'utf8');

  console.log(`Targets: ${targets.length}`);
  console.log(`Updated: ${updated}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
