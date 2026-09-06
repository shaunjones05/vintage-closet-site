#!/usr/bin/env node
// tools/fetch-ebay-images.js
// Node script to populate product.image fields in js/app.js by scraping each product's ebayUrl.
// Usage: node tools/fetch-ebay-images.js

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const APP_JS = path.join(__dirname, '..', 'js', 'app.js');

// Read js/app.js and extract the products array text using bracket matching.
function readAppJs() {
  return fs.readFileSync(APP_JS, 'utf8');
}

function extractProductsArray(source) {
  const marker = 'const products =';
  const idx = source.indexOf(marker);
  if (idx === -1) throw new Error('products array marker not found in app.js');
  const start = source.indexOf('[', idx);
  if (start === -1) throw new Error('start of products array not found');
  // Find matching closing bracket
  let i = start;
  let depth = 0;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) break;
    }
    // skip quoted strings to avoid bracket confusion
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') i += 2; else i++;
      }
    }
  }
  if (depth !== 0) throw new Error('Could not find end of products array');
  const end = i;
  const arrayText = source.slice(start, end + 1);
  return { arrayText, start, end };
}

// Evaluate the arrayText to obtain JS objects safely in a new VM context.
function evalArray(arrayText) {
  // Wrap in parentheses to form an expression
  const wrapped = '(' + arrayText + ')';
  // If the arrayText references JACKETS_STRIPE_LINK, provide a safe value
  // to avoid ReferenceError when evaluating (the script preserves the
  // symbol when writing back to app.js).
  const hasStripeSymbol = /\bJACKETS_STRIPE_LINK\b/.test(arrayText);
  if (hasStripeSymbol) {
    const fn = new Function('JACKETS_STRIPE_LINK', 'return ' + wrapped + ';');
    return fn('');
  }
  // Use Function to evaluate in isolated scope
  const fn = new Function('return ' + wrapped + ';');
  return fn();
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const opts = {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.ebay.com/',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      };
      https.get(opts, res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve(body));
      }).on('error', reject);
    } catch (err) { reject(err); }
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isBlockedHtml(html) {
  if (!html) return true;
  const low = html.toLowerCase();
  if (low.includes('captcha') || low.includes('please verify') || low.includes('security check') || low.includes('are you a human') || low.includes('robot')) return true;
  if (html.length < 2000) return true;
  return false;
}

function findBestEbayImage(html) {
  if (!html) return null;
  const ebayImgRegex = /https?:\/\/i\.ebayimg\.com\/images\/g\/[A-Za-z0-9_-]+\/[^\s"'<>]*/g;
  const matches = html.match(ebayImgRegex);
  if (!matches || matches.length === 0) return null;
  // Deduplicate
  const uniq = Array.from(new Set(matches));
  // Score by s-lNNNN size if present
  const scored = uniq.map(u => {
    const m = u.match(/s-l(\d+)/);
    const size = m ? parseInt(m[1], 10) : 0;
    return { url: u, size };
  });
  scored.sort((a,b)=> b.size - a.size);
  return scored[0].url;
}

function extractImageFromHtml(html) {
  // Try meta property og:image
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  if (ogMatch) return ogMatch[1];
  // Try JSON-LD
  const ldMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (ldMatch) {
    try {
      const json = JSON.parse(ldMatch[1]);
      if (json && json.image) return Array.isArray(json.image) ? json.image[0] : json.image;
    } catch (e) {
      // ignore JSON parse errors
    }
  }
  // Try eBay image pattern (prefer highest-res s-lNNNN)
  const ebayImg = findBestEbayImage(html);
  if (ebayImg) return ebayImg;
  // Try itemprop image
  const itemMatch = html.match(/<img[^>]+itemprop=["']image["'][^>]*src=["']([^"']+)["'][^>]*>/i);
  if (itemMatch) return itemMatch[1];
  // Fallback: first large image in page (heuristic)
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (imgMatch) return imgMatch[1];
  return null;
}

function makeJsLiteral(arr) {
  // Create JS code for products array preserving stripeLink as JACKETS_STRIPE_LINK
  const parts = arr.map(prod => {
    const lines = [];
    lines.push('  {');
    // Required order of fields as per spec
    const fields = ['id','code','name','price','size','condition','image','status','stripeLink','ebayItemNumber','ebayUrl'];
    for (const k of fields) {
      let v = prod[k];
      if (k === 'stripeLink') {
        lines.push(`    stripeLink: JACKETS_STRIPE_LINK,`);
        continue;
      }
      if (typeof v === 'string') {
        // escape backslashes and single quotes
        v = v.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        lines.push(`    ${k}: '${v}',`);
      } else if (typeof v === 'number') {
        lines.push(`    ${k}: ${v},`);
      } else if (v === null || v === undefined) {
        lines.push(`    ${k}: '',`);
      } else {
        // fallback stringify
        lines.push(`    ${k}: ${JSON.stringify(v)},`);
      }
    }
    // remove trailing comma from last line
    if (lines.length) {
      const last = lines[lines.length-1];
      lines[lines.length-1] = last.replace(/,$/, '');
    }
    lines.push('  }');
    return lines.join('\n');
  });
  return '[\n' + parts.join(',\n') + '\n]';
}

async function main(){
  console.log('Reading', APP_JS);
  const src = readAppJs();
  const { arrayText, start, end } = extractProductsArray(src);
  let products = evalArray(arrayText);
  if (!Array.isArray(products)) throw new Error('Parsed products is not an array');

  console.log('Found', products.length, 'products — fetching images...');

  for (let i=0;i<products.length;i++){
    const p = products[i];
    if (!p.ebayUrl) {
      console.log(`[${i+1}/${products.length}] ${p.id} no ebayUrl — skipping`);
      continue;
    }
    const maxAttempts = 2;
    let attempts = 0;
    let found = false;
    while (attempts < maxAttempts && !found) {
      attempts++;
      try {
        console.log(`[${i+1}/${products.length}] Fetching ${p.ebayUrl} (attempt ${attempts})`);
        const html = await fetchUrl(p.ebayUrl);
        if (isBlockedHtml(html)) {
          console.log('  -> page looks like a bot/blocked page (captcha/verify/short HTML)');
          if (attempts < maxAttempts) {
            console.log('  -> retrying after longer delay');
            await sleep(3000);
            continue;
          } else {
            break;
          }
        }
        const img = extractImageFromHtml(html);
        if (img) {
          console.log('  -> found image', img);
          p.image = img;
          found = true;
          break;
        } else {
          console.log('  -> no image found on page');
          if (attempts < maxAttempts) await sleep(1200);
        }
      } catch (err) {
        console.error('  -> error fetching', err.message);
        if (attempts < maxAttempts) await sleep(1200);
      }
    }
    // polite delay between items
    await sleep(1200);
  }

  // Build JS literal preserving JACKETS_STRIPE_LINK symbol
  const newArrayText = makeJsLiteral(products);

  // Replace old array in source
  const before = src.slice(0, start);
  const after = src.slice(end+1);
  const newSrc = before + newArrayText + after;

  // Write backup
  fs.writeFileSync(APP_JS + '.bak', src, 'utf8');
  fs.writeFileSync(APP_JS, newSrc, 'utf8');
  console.log('Updated', APP_JS, ' — backup at', APP_JS + '.bak');
}

main().catch(err=>{ console.error(err); process.exit(1); });
