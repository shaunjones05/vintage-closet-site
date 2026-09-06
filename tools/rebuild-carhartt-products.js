#!/usr/bin/env node
// tools/rebuild-carhartt-products.js
// Build products array from eBay CSV (Carhartt jackets only) and attempt best-effort image extraction.
// Usage: node tools/rebuild-carhartt-products.js

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const ROOT = path.join(__dirname, '..');
const CSV = path.join(ROOT, 'eBay-unsold-listings-report-2025-12-26-12288369611.csv');
const APP_JS = path.join(ROOT, 'js', 'app.js');

function readCsv(p) {
  return fs.readFileSync(p, 'utf8');
}

function parseCsv(text) {
  // Minimal CSV parser that supports quoted fields with commas/newlines
  const rows = [];
  let cur = [];
  let i = 0;
  let field = '';
  let inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i+1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === ',') { cur.push(field); field=''; i++; continue; }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field=''; i++; continue; }
    field += ch; i++;
  }
  // push last
  if (field !== '' || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

function headerMap(headerRow) {
  const map = {};
  headerRow.forEach((h, idx)=> map[h.trim()] = idx);
  return map;
}

function safeGet(row, map, name) {
  const idx = map[name];
  if (idx === undefined) return '';
  return (row[idx] || '').trim();
}

function sizeFromTitle(title) {
  if (!title) return '';
  const m = title.match(/\b(XS|S|M|L|XL|XXL|XXXL|Small|Medium|Large|Extra Large)\b/i);
  if (!m) return '';
  const s = m[1].toUpperCase();
  if (s === 'SMALL') return 'S';
  if (s === 'MEDIUM') return 'M';
  if (s === 'LARGE' || s === 'EXTRA LARGE') return s === 'LARGE' ? 'L' : 'XL';
  return s;
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
          'Cache-Control': 'no-cache'
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

function findBestEbayImage(html) {
  if (!html) return null;
  const ebayImgRegex = /https?:\/\/i\.ebayimg\.com\/images\/g\/[A-Za-z0-9_-]+\/[^\s"'<>]*/g;
  const matches = html.match(ebayImgRegex);
  if (!matches || matches.length === 0) return null;
  const uniq = Array.from(new Set(matches));
  const scored = uniq.map(u => {
    const m = u.match(/s-l(\d+)/);
    const size = m ? parseInt(m[1], 10) : 0;
    return { url: u, size };
  });
  scored.sort((a,b)=> b.size - a.size);
  return scored[0].url;
}

function extractImageFromHtml(html) {
  if (!html) return null;
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  if (ogMatch) return ogMatch[1];
  const ldMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (ldMatch) {
    try {
      const json = JSON.parse(ldMatch[1]);
      if (json && json.image) return Array.isArray(json.image) ? json.image[0] : json.image;
    } catch(e) {}
  }
  const itemMatch = html.match(/<img[^>]+itemprop=["']image["'][^>]*src=["']([^"']+)["'][^>]*>/i);
  if (itemMatch) return itemMatch[1];
  const ebay = findBestEbayImage(html);
  if (ebay) return ebay;
  const anyImg = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (anyImg) return anyImg[1];
  return null;
}

function makeJsLiteral(arr) {
  const parts = arr.map(prod => {
    const lines = [];
    lines.push('  {');
    const fields = ['id','code','name','price','size','condition','description','images','status','stripeLink','ebayItemNumber','ebayUrl'];
    for (const k of fields) {
      const v = prod[k];
      if (k === 'stripeLink') {
        lines.push(`    stripeLink: JACKETS_STRIPE_LINK,`);
        continue;
      }
      if (k === 'images') {
        lines.push(`    images: ${JSON.stringify(v)},`);
        continue;
      }
      if (typeof v === 'string') {
        const esc = v.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        lines.push(`    ${k}: '${esc}',`);
      } else if (typeof v === 'number') {
        lines.push(`    ${k}: ${v},`);
      } else {
        lines.push(`    ${k}: ${JSON.stringify(v)},`);
      }
    }
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
  console.log('Reading CSV', CSV);
  const txt = readCsv(CSV);
  const rows = parseCsv(txt);
  if (rows.length < 2) { console.error('No rows'); process.exit(1); }
  const map = headerMap(rows[0]);
  const results = [];

  for (let i=1;i<rows.length;i++){
    const row = rows[i];
    const title = safeGet(row, map, 'Title');
    const sold = (safeGet(row, map, 'Sold status') || '').toLowerCase();
    if (!title) continue;
    if (title.toLowerCase().indexOf('carhartt') === -1) continue; // only Carhartt
    if (sold !== 'unsold') continue; // only unsold
    // heuristics: ensure it's a jacket by searching keywords
    const lower = title.toLowerCase();
    if (!(lower.includes('jacket') || lower.includes('coat') || lower.includes('bomber') || lower.includes('chore'))) continue;

    const item = safeGet(row, map, 'Item number') || safeGet(row, map, 'Item number');
    const itemNumber = item.replace(/\D/g,'');
    const startPrice = safeGet(row, map, 'Start price') || safeGet(row, map, 'Current price (future)') || safeGet(row, map, 'Current price');
    const price = startPrice ? Number(startPrice) : 0;
    const condition = safeGet(row, map, 'Condition') || '';
    const size = sizeFromTitle(title) || '';
    const id = 'eb-' + itemNumber;
    const code = 'JKT-' + (itemNumber.slice(-4) || Math.floor(1000+Math.random()*9000));
    const ebayUrl = `https://www.ebay.com/itm/${itemNumber}`;
    results.push({ id, code, name: title, price, size, condition, description: '', images: [], status: 'available', stripeLink: 'JACKETS_STRIPE_LINK', ebayItemNumber: itemNumber, ebayUrl });
  }

  console.log('Found', results.length, 'Carhartt jacket candidates');

  // Attempt best-effort image extraction (non-blocking, skip on errors)
  let imagesFound = 0;
  for (let i=0;i<results.length;i++){
    const p = results[i];
    if (!p.ebayUrl) continue;
    try {
      console.log(`[${i+1}/${results.length}] Fetching ${p.ebayUrl}`);
      const html = await fetchUrl(p.ebayUrl);
      const img = extractImageFromHtml(html);
      if (img) { p.images.push(img); imagesFound++; console.log('  -> image:', img); }
      else console.log('  -> no image found');
      await new Promise(r=>setTimeout(r, 1200));
    } catch (e) { console.log('  -> fetch error, skipping image'); }
  }

  // Read app.js and replace products array
  const src = fs.readFileSync(APP_JS, 'utf8');
  const marker = 'const products =';
  const idx = src.indexOf(marker);
  if (idx === -1) { console.error('products marker not found in app.js'); process.exit(1); }
  const start = src.indexOf('[', idx);
  let i = start; let depth = 0;
  for (; i < src.length; i++){
    const ch = src[i];
    if (ch === '[') depth++; else if (ch === ']') { depth--; if (depth === 0) break; }
    if (ch === '"' || ch === "'" || ch === '`') { const q = ch; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i+=2; else i++; } }
  }
  const end = i;
  // sanitize descriptions before writing
  function sanitizeDescription(s){
    if (!s) return '';
    let out = String(s);
    out = out.replace(/#\S+/g, '');
    out = out.replace(/(?:,\s*[^,]{1,40}){2,}\s*$/,'');
    out = out.replace(/\s+/g,' ').trim();
    out = out.replace(/^[,;:\-\s]+|[,;:\-\s]+$/g,'').trim();
    return out;
  }

  const newArrayText = makeJsLiteral(results.map(r=>{
    const copy = Object.assign({}, r, { stripeLink: 'JACKETS_STRIPE_LINK' });
    copy.description = sanitizeDescription(copy.description || '');
    return copy;
  }));
  const before = src.slice(0, start);
  const after = src.slice(end+1);
  const newSrc = before + newArrayText + after;
  fs.writeFileSync(APP_JS + '.bak', src, 'utf8');
  fs.writeFileSync(APP_JS, newSrc, 'utf8');

  console.log('Wrote', APP_JS, ' — backup at', APP_JS + '.bak');
  console.log('Imported', results.length, 'Carhartt jackets. Images extracted:', imagesFound);
}

main().catch(err=>{ console.error(err); process.exit(1); });
