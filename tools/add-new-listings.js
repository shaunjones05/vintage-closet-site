#!/usr/bin/env node
// tools/add-new-listings.js
// Fetches eBay listings and adds them to products array in js/app.js

const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');

const APP_JS = path.join(__dirname, '..', 'js', 'app.js');

// eBay URLs to add (risky extraction mode: parse whatever HTML returns)
const NEW_LISTINGS = [
  'https://www.ebay.com/itm/317705257766',
  'https://www.ebay.com/itm/317680984921',
  'https://www.ebay.com/itm/317607465922',
  'https://www.ebay.com/itm/317705309857',
  'https://www.ebay.com/itm/317705305558'
];

// Price buckets (round UP to nearest)
const PRICE_BUCKETS = [20, 40, 60, 80, 100, 125, 150, 175, 200, 250, 300];

function roundUpToBucket(price) {
  const num = Number(price) || 0;
  for (const bucket of PRICE_BUCKETS) {
    if (num <= bucket) return bucket;
  }
  return PRICE_BUCKETS[PRICE_BUCKETS.length - 1];
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.ebay.com/'
    } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractFromHtml(html, itemNumber) {
  const product = {
    id: `eb-${itemNumber}`,
    code: `JKT-${itemNumber.slice(-4)}`,
    name: '',
    price: 0,
    size: '',
    description: '',
    images: [],
    status: 'available',
    stripeLink: 'https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK',
    ebayItemNumber: itemNumber,
    ebayUrl: `https://www.ebay.com/itm/${itemNumber}`,
    category: 'Jackets'
  };

  // Extract title
  let titleMatch = html.match(/<h1[^>]*class="[^"]*x-item-title[^"]*"[^>]*>(.*?)<\/h1>/is);
  if (!titleMatch) titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i);
  if (titleMatch) {
    product.name = titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s*\|\s*eBay\s*$/i, '').trim();
  }

  // Extract price
  let priceMatch = html.match(/"priceCurrency":"USD","price":"?([\d.]+)"?/);
  if (!priceMatch) priceMatch = html.match(/US \$([\d,]+\.\d{2})/);
  if (!priceMatch) priceMatch = html.match(/\$([0-9,]+(?:\.[0-9]{2})?)/);
  if (priceMatch) {
    const rawPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
    product.price = roundUpToBucket(rawPrice);
  }

  // Extract size from title or description
  const sizePatterns = [
    /\b(XS|S|M|L|XL|XXL|XXXL)\b/i,
    /\bSize:?\s*([A-Z]{1,4})\b/i,
    /\b(\d{2,3})\s*x\s*(\d{2,3})\b/i,  // waist x inseam
    /\bMens?\s+(Small|Medium|Large|X-?Large|XX-?Large)/i
  ];
  for (const pattern of sizePatterns) {
    const match = product.name.match(pattern);
    if (match) {
      product.size = match[1] || match[0];
      break;
    }
  }

  // Extract description (try multiple selectors)
  let descMatch = html.match(/<div[^>]*id="ds_div"[^>]*>([\s\S]*?)<\/div>/i);
  if (!descMatch) descMatch = html.match(/<div[^>]*class="[^"]*item-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (descMatch) {
    product.description = descMatch[1]
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/#\w+/g, '')
      .trim()
      .substring(0, 500);
  }
  if (!product.description) {
    product.description = product.name;
  }

  // Extract ALL images
  const imageUrls = new Set();
  
  // Method 1: JSON-LD structured data
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const jsonScript of jsonLdMatches) {
    try {
      const json = JSON.parse(jsonScript.replace(/^[\s\S]*?<script[^>]*>/i, '').replace(/<\/script>[\s\S]*$/i, ''));
      if (json.image) {
        if (Array.isArray(json.image)) {
          json.image.forEach(img => imageUrls.add(img));
        } else {
          imageUrls.add(json.image);
        }
      }
    } catch (e) {}
  }

  // Method 2: Meta tags
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  if (ogImageMatch) imageUrls.add(ogImageMatch[1]);

  // Method 3: Image gallery patterns
  const galleryMatches = html.matchAll(/https:\/\/i\.ebayimg\.com\/images\/g\/[A-Za-z0-9_-]+\/s-l\d+\.(?:jpg|png|webp)/gi);
  for (const match of galleryMatches) {
    imageUrls.add(match[0]);
  }

  // Method 4: thumbs pattern
  const thumbMatches = html.matchAll(/https:\/\/i\.ebayimg\.com\/thumbs\/images\/g\/[A-Za-z0-9_-]+\/s-l\d+\.(?:jpg|png|webp)/gi);
  for (const match of thumbMatches) {
    imageUrls.add(match[0]);
  }

  // Convert to array and upgrade to high-res (s-l1600)
  const images = Array.from(imageUrls).map(url => {
    if (/s-l\d+/i.test(url)) {
      return url.replace(/s-l\d+/i, 's-l1600');
    }
    return url;
  });

  // Dedupe and limit to 8
  product.images = [...new Set(images)].slice(0, 8);

  // If no images found, add placeholder
  if (product.images.length === 0) {
    const fallback = `https://i.ebayimg.com/images/g/placeholder/s-l1600.jpg`;
    product.images.push(fallback);
  }

  return product;
}

async function main() {
  console.log('Fetching', NEW_LISTINGS.length, 'eBay listings...\n');
  
  const newProducts = [];
  
  for (const url of NEW_LISTINGS) {
    const itemNumber = url.match(/\/(\d+)$/)[1];
    console.log(`Fetching ${itemNumber}...`);
    
    try {
      const html = await httpsGet(url);
      const product = extractFromHtml(html, itemNumber);
      newProducts.push(product);
      console.log(`  ✓ ${product.name}`);
      console.log(`    Price: $${product.price} (rounded to bucket)`);
      console.log(`    Size: ${product.size || '(none)'}`);
      console.log(`    Images: ${product.images.length}`);
      console.log('');
    } catch (err) {
      console.error(`  ✗ Failed to fetch ${itemNumber}:`, err.message);
    }
  }

  if (newProducts.length === 0) {
    console.log('No products fetched. Exiting.');
    return;
  }

  // Read current app.js
  const source = fs.readFileSync(APP_JS, 'utf8');
  
  // Find products array
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
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') i += 2; else i++;
      }
    }
  }
  const end = i;
  const arrayText = source.slice(start, end + 1);
  
  // Parse existing products (best-effort)
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext('products=' + arrayText, sandbox);
  const existingProducts = sandbox.products || [];

  // Check for duplicates
  const existingIds = new Set(existingProducts.map(p => p.id));
  const toAdd = newProducts.filter(p => !existingIds.has(p.id));
  
  if (toAdd.length === 0) {
    console.log('All products already exist. No changes made.');
    return;
  }

  // Backup
  const backup = APP_JS + '.bak-add-' + Date.now();
  fs.writeFileSync(backup, source, 'utf8');
  console.log('Backup:', backup);

  // Append new products as JS literals preserving JACKETS_STRIPE_LINK symbol
  const before = source.slice(0, end);
  const after = source.slice(end);
  const objToJs = (p) => {
    const esc = s => String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const imgs = (Array.isArray(p.images)? p.images: []).map(u=> `'${esc(u)}'`).join(', ');
    const fields = [
      `id: '${esc(p.id)}'`,
      `code: '${esc(p.code)}'`,
      `name: '${esc(p.name)}'`,
      `price: ${Number(p.price)||0}`,
      `size: '${esc(p.size)}'`,
      `description: '${esc(p.description)}'`,
      `images: [${imgs}]`,
      `status: 'available'`,
      `stripeLink: JACKETS_STRIPE_LINK`,
      `ebayItemNumber: '${esc(p.ebayItemNumber)}'`,
      `ebayUrl: '${esc(p.ebayUrl)}'`,
      `category: '${esc(p.category||'Jackets')}'`
    ];
    return `\n  {\n    ${fields.join(',\n    ')}\n  }`;
  };
  const appended = toAdd.map(objToJs).join(',');
  const newSource = before.replace(/\]$/, '') + (existingProducts.length ? ',' : '') + appended + ']'+ after.slice(1);

  fs.writeFileSync(APP_JS, newSource, 'utf8');
  console.log(`\n✓ Added ${toAdd.length} new products to app.js (preserved Stripe constant)`);
  
  // Report
  console.log('\n=== SUMMARY ===');
  console.log(`Products added: ${toAdd.length}`);
  console.log('Price buckets used:', [...new Set(toAdd.map(p => p.price))].sort((a,b)=>a-b).join(', '));
  console.log('\nImages per item:');
  toAdd.forEach(p => {
    console.log(`  ${p.name.substring(0, 50)}... → ${p.images.length} images`);
  });
}

main().catch(console.error);
