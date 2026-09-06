#!/usr/bin/env node
// tools/import-single-ebay.js
// Fetch a single eBay item page, extract title/description/images/price and
// replace the products array in js/app.js with that single product (backup made).

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const ITEM_URL = 'https://www.ebay.com/itm/317607391969';
const ROOT = path.join(__dirname, '..');
const APP_JS = path.join(ROOT, 'js', 'app.js');

const BUCKETS = [20,40,60,80,100,125,150,175,200,250,300];
function roundUp(n){ for (const b of BUCKETS) if (n <= b) return b; return BUCKETS[BUCKETS.length-1]; }

function fetchUrl(url){
  return new Promise((resolve,reject)=>{
    try{
      const u = new URL(url);
      const opts = { hostname: u.hostname, path: u.pathname + u.search, headers: {
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':'en-US,en;q=0.9',
        'Referer':'https://www.ebay.com'
      }};
      https.get(opts, res=>{
        let body = '';
        res.on('data', d=> body += d);
        res.on('end', ()=> resolve(body));
      }).on('error', reject);
    }catch(e){ reject(e); }
  });
}

function extractTitle(html){
  const m = html.match(/<meta[^>]*property=(?:"|')og:title(?:"|')[^>]*content=(?:"|')([^"']+)(?:"|')/i);
  if (m) return m[1].trim();
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t ? t[1].trim() : '';
}

function extractPrice(html){
  // try JSON-LD price
  const ld = html.match(/<script[^>]*type=(?:"|')application\/ld\+json(?:"|')[^>]*>([\s\S]*?)<\/script>/i);
  if (ld) {
    try{ const j = JSON.parse(ld[1]); if (j && j.offers && j.offers.price) return Number(j.offers.price); } catch(e){}
  }
  const mmeta = html.match(/<meta[^>]*itemprop=(?:"|')price(?:"|')[^>]*content=(?:"|')([^"']+)(?:"|')/i);
  if (mmeta) return Number(mmeta[1]);
  const mp = html.match(/\$\s*([0-9,]+(?:\.[0-9]+)?)/);
  if (mp) return Number(mp[1].replace(/,/g,''));
  return null;
}

function extractImages(html){
  if (!html) return [];
    // prefer well-formed i.ebayimg.com image URLs (stop at image extension)
    const re = /https?:\/\/i\.ebayimg\.com\/[^\s"'<>]*?\.(?:jpe?g|jpeg|png)(?:\?[^
        \s"'<>]*)?/gi;
    const matches = html.match(re) || [];
    const cleaned = matches.map(u => {
      let s = String(u).trim();
      // strip trailing punctuation or stray characters
      s = s.replace(/[\)\]\.,;"'<>\\s]+$/,'');
      return s;
    }).filter(Boolean);
    const uniq = Array.from(new Set(cleaned));
    if (uniq.length) {
      uniq.sort((a,b)=>{
        const ma = Number((a.match(/s-l(\d+)/)||[])[1]||0);
        const mb = Number((b.match(/s-l(\d+)/)||[])[1]||0);
        return mb - ma;
      });
      return uniq;
    }
    // fallback: any image url ending with jpg/png
    const anyRe = /https?:\/\/[^\s"'<>]*?\.(?:jpe?g|jpeg|png)(?:\?[^
        \s"'<>]*)?/gi;
    const any = html.match(anyRe) || [];
    return Array.from(new Set(any.map(u=>String(u).trim().replace(/[\)\]\.,;"'<>\\s]+$/,''))));
}

function extractDescription(html){
  // og:description as best-effort; full description often in iframe and may not be available
  const m = html.match(/<meta[^>]*property=(?:"|')og:description(?:"|')[^>]*content=(?:"|')([^"']+)(?:"|')/i);
  if (m) return m[1].trim();
  // try JSON-LD
  const ld = html.match(/<script[^>]*type=(?:"|')application\/ld\+json(?:"|')[^>]*>([\s\S]*?)<\/script>/i);
  if (ld) {
    try{ const j = JSON.parse(ld[1]); if (j && j.description) return j.description; } catch(e){}
  }
  return '';
}

function parseSize(title){
  if (!title) return 'Unknown';
  const m = title.match(/\b(XS|S|M|L|XL|XXL|XXXL|Small|Medium|Large|Extra Large)\b/i);
  if (!m) return 'Unknown';
  const s = m[1]; if (/Small/i.test(s)) return 'S'; if (/Medium/i.test(s)) return 'M'; if (/Large/i.test(s)) return 'L'; if (/Extra/i.test(s)) return 'XL'; return s.toUpperCase();
}

function extractItemNumber(url){
  const m = url.match(/\/itm\/(\d+)/); return m ? m[1] : '';
}

function makeJsLiteralSingle(prod){
  const lines = [];
  const fields = ['id','name','price','size','images','description','stripeLink','ebayItemNumber','ebayUrl'];
  lines.push('[\n  {');
  for (const k of fields){
    const v = prod[k];
    if (k === 'stripeLink') { lines.push('    stripeLink: JACKETS_STRIPE_LINK,'); continue; }
    if (k === 'images') { lines.push(`    images: ${JSON.stringify(v)},`); continue; }
    if (typeof v === 'string') {
      const esc = v.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      lines.push(`    ${k}: '${esc}',`);
    } else if (typeof v === 'number') { lines.push(`    ${k}: ${v},`); } else { lines.push(`    ${k}: ${JSON.stringify(v)},`); }
  }
  // remove trailing comma on last
  const last = lines[lines.length-1]; lines[lines.length-1] = last.replace(/,$/,'');
  lines.push('\n  }\n]');
  return lines.join('\n');
}

async function main(){
  console.log('Fetching', ITEM_URL);
  const html = await fetchUrl(ITEM_URL).catch(err=>{ console.error('Fetch error', err.message||err); return null; });
  if (!html) { console.error('Failed to fetch item page'); process.exit(1); }
  const title = extractTitle(html) || 'Untitled';
  const rawPrice = extractPrice(html);
  const rounded = rawPrice ? roundUp(rawPrice) : 0;
  const images = extractImages(html);
  const desc = extractDescription(html);
  const itemNum = extractItemNumber(ITEM_URL);
  const size = parseSize(title);

  const prod = {
    id: 'eb-' + (itemNum || Date.now()),
    name: title,
    price: rounded,
    size: size || 'Unknown',
    images: images,
    description: desc,
    stripeLink: 'JACKETS_STRIPE_LINK',
    ebayItemNumber: itemNum,
    ebayUrl: ITEM_URL
  };

  // Read app.js, make backup, replace products array
  const src = fs.readFileSync(APP_JS, 'utf8');
  fs.writeFileSync(APP_JS + '.bak', src, 'utf8');
  const marker = 'const products =';
  const idx = src.indexOf(marker);
  if (idx === -1) { console.error('products marker not found in app.js'); process.exit(1); }
  const start = src.indexOf('[', idx);
  let i = start; let depth = 0;
  for (; i < src.length; i++){
    const ch = src[i];
    if (ch === '[') depth++; else if (ch === ']') { depth--; if (depth === 0) break; }
    if (ch === '"' || ch === "'" || ch === '`') { const q = ch; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i += 2; else i++; } }
  }
  const end = i;
  const before = src.slice(0, start);
  const after = src.slice(end+1);
  const newArray = makeJsLiteralSingle(prod);
  const newSrc = before + newArray + after;
  fs.writeFileSync(APP_JS, newSrc, 'utf8');

  console.log('Wrote', APP_JS, ' (backup at', APP_JS + '.bak)');
  console.log('Title:', title);
  console.log('Raw price:', rawPrice);
  console.log('Rounded price used:', rounded);
  console.log('Item number:', itemNum);
  console.log('Images extracted:', images.length);
  images.forEach((u,i)=> console.log(`  [${i+1}] ${u}`));
}

main().catch(e=>{ console.error(e); process.exit(1); });
