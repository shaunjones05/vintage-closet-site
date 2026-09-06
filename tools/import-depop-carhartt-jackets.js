#!/usr/bin/env node
// tools/import-depop-carhartt-jackets.js
// Best-effort importer for Depop product pages (Carhartt jackets only).
// Usage (no Playwright):
//   node tools/import-depop-carhartt-jackets.js
// Usage (with Playwright installed):
//   node tools/import-depop-carhartt-jackets.js --use-playwright

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const ROOT = path.join(__dirname, '..');
const APP_JS = path.join(ROOT, 'js', 'app.js');

// Source Depop manage URLs (user-provided list)
const DEPOP_URLS = [
  'https://www.depop.com/products/vintagecloset_pdx-vintage-blk-90s-carhartt-hooded/manage/',
  'https://www.depop.com/products/vintagecloset_pdx-liquid-blue-vtg-1993-aop/manage/',
  'https://www.depop.com/products/vintagecloset_pdx-cream-vintage-90s-carhartt-jacket/manage/',
  'https://www.depop.com/products/vintagecloset_pdx-1980s-levis-medium-faded-distressed/manage/',
  'https://www.depop.com/products/vintagecloset_pdx-carhartt-distressed-vintage-canvas-hooded/manage/',
  'https://www.depop.com/products/vintagecloset_pdx-carhartt-hooded-workwear-jacket-xl/manage/',
  'https://www.depop.com/products/vintagecloset_pdx-vtg-carhartt-faded-red-bomber-514c/manage/',
  'https://www.depop.com/products/vintagecloset_pdx-carhartt-vtg-90s-mens-l/manage/',
  'https://www.depop.com/products/vintagecloset_pdx-vtg-carhartt-detroit-jacket-2xl/manage/',
  'https://www.depop.com/products/vintagecloset_pdx-carhartt-vtg-90s-red-bomber-caee/manage/',
  'https://www.depop.com/products/vintagecloset_pdx-carhartt-vintage-faded-denim-chore-3d8d/manage/',
  'https://www.depop.com/products/vintagecloset_pdx-blink-182-t-shirt-mens-size-xl-87df/manage/',
  'https://www.depop.com/products/vintagecloset_pdx-vintage-1960s-black-sheep-hunting/manage/',
  'https://www.depop.com/products/vintagecloset_pdx-lee-1980s-true-vintage-faded/manage/',
  'https://www.depop.com/products/vintagecloset_pdx-nike-vintage-90s-windbreaker-track/manage/',
  'https://www.depop.com/products/vintagecloset_pdx-fruit-of-the-loom-best-75e9/manage/'
];

const BUCKETS = [20,40,60,80,100,125,150,175,200,250,300];

function roundUpBucket(n){
  for (const b of BUCKETS) if (n <= b) return b;
  return BUCKETS[BUCKETS.length-1];
}

function slugFromUrl(u){
  try { const p = new URL(u).pathname; const parts = p.split('/').filter(Boolean); return parts[parts.length-2] || parts[parts.length-1] || ''; } catch(e){ return '' }
}

function codeFromSlug(slug){
  const s = slug.replace(/[^a-z0-9]/gi,'');
  return 'JKT-' + (s.slice(-4).toUpperCase() || Math.floor(1000+Math.random()*9000));
}

function fetchUrl(url){
  return new Promise((resolve,reject)=>{
    try{
      const u = new URL(url);
      const opts = { protocol:u.protocol, hostname:u.hostname, path:u.pathname+u.search, headers:{
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':'en-US,en;q=0.9',
        'Referer':'https://www.depop.com'
      }};
      https.get(opts, res=>{
        let body=''; res.on('data', d=> body+=d); res.on('end', ()=> resolve(body));
      }).on('error', reject);
    }catch(e){ reject(e); }
  });
}

function extractBasic(html){
  if (!html) return {};
  const out = {};
  const t = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (t) out.title = t[1].trim();
  const p = html.match(/<meta[^>]+property=["']product:price:amount["'][^>]*content=["']([^"']+)["']/i) || html.match(/\"price\"\s*:\s*\"(\d+(?:\.\d+)?)\"/i);
  if (p) out.price = Number(p[1]);
  const desc = html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  if (desc) out.description = desc[1].trim();
  const img = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (img) out.images = [img[1]];
  return out;
}

function findEbayStyleImages(html){
  if (!html) return [];
  const regex = /https?:\/\/i\.depopcdn\.com\/[^\s"'<>]*/g; // depop CDN guess
  const matches = html.match(regex) || [];
  return Array.from(new Set(matches));
}

async function renderWithPlaywright(url){
  try{
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);
    const title = await page.$eval('h1', el=>el.innerText).catch(()=>null);
    const price = await page.$eval('[data-testid="price"]', el=>el.innerText).catch(()=>null);
    const desc = await page.$eval('[data-testid="description"]', el=>el.innerText).catch(()=>null);
    const imgs = await page.$$eval('img', imgs=>imgs.map(i=>i.src)).catch(()=>[]);
    await browser.close();
    let priceNum = null;
    if (price) {
      const m = price.replace(/[^0-9\.]/g,''); priceNum = Number(m) || null;
    }
    return { title, price: priceNum, description: desc, images: imgs };
  }catch(e){ return null; }
}

function makeJsLiteral(arr){
  const parts = arr.map(prod=>{
    const lines = []; lines.push('  {');
    const fields = ['id','code','name','price','size','condition','description','images','status','stripeLink','depopUrl'];
    for (const k of fields){
      const v = prod[k];
      if (k === 'stripeLink') { lines.push('    stripeLink: JACKETS_STRIPE_LINK,'); continue; }
      if (k === 'images') { lines.push(`    images: ${JSON.stringify(v)},`); continue; }
      if (typeof v === 'string') {
        const esc = v.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        lines.push(`    ${k}: '${esc}',`);
      } else if (typeof v === 'number') { lines.push(`    ${k}: ${v},`); }
      else lines.push(`    ${k}: ${JSON.stringify(v)},`);
    }
    if (lines.length){ const last = lines[lines.length-1]; lines[lines.length-1] = last.replace(/,$/, ''); }
    lines.push('  }'); return lines.join('\n');
  });
  return '[\n' + parts.join(',\n') + '\n]';
}

async function main(){
  console.log('Processing', DEPOP_URLS.length, 'Depop links');
  const usePlaywright = process.argv.includes('--use-playwright');
  const items = [];
  const failed = [];
  for (const u of DEPOP_URLS){
    const publicUrl = u.replace(/\/manage\/?$/, '');
    const slug = slugFromUrl(publicUrl);
    const id = slug || ('depop-' + Math.floor(100000+Math.random()*900000));
    const code = codeFromSlug(slug);
    let rec = { id, code, name: '', price: 0, size: '', condition: '', description: '', images: [], status: 'available', stripeLink: 'JACKETS_STRIPE_LINK', depopUrl: publicUrl };
    try{
      const html = await fetchUrl(publicUrl).catch(()=>null);
      let data = extractBasic(html || '');
      if ((!data.title || !data.price) && usePlaywright){
        console.log('  -> falling back to Playwright for', publicUrl);
        const r = await renderWithPlaywright(publicUrl);
        if (r) data = Object.assign({}, data, r);
      }
      // Trust the provided URLs — skip only if no title (no product data)
      const title = (data.title || '').trim();
      if (!title) { console.log('  -> skipping (no product title found):', publicUrl); continue; }
      rec.name = title;
      rec.price = data.price ? roundUpBucket(Number(data.price)) : 0;
      rec.description = data.description || '';
      rec.images = data.images && data.images.length ? data.images : (findEbayStyleImages(html || '') || []);
      // try parse size from title/description
      const m = title.match(/\b(XS|S|M|L|XL|XXL|XXXL|Small|Medium|Large|Extra Large)\b/i);
      if (m) rec.size = (m[1].length > 2) ? (m[1].toUpperCase().startsWith('EX') ? 'XL' : m[1]) : m[1].toUpperCase();
      // basic condition guess
      rec.condition = (data.condition || '').toString() || '';
      items.push(rec);
      console.log('  -> imported:', rec.name, rec.price, rec.size, 'images', rec.images.length);
      await new Promise(r=>setTimeout(r, 600));
    }catch(e){ failed.push(publicUrl); console.log('  -> failed:', publicUrl); }
  }

  // dedupe by first image or title+price
  const final = [];
  for (const it of items){
    const dup = final.find(f=> (f.images[0] && it.images[0] && f.images[0] === it.images[0]) || (f.name.toLowerCase() === it.name.toLowerCase() && f.price === it.price));
    if (!dup) final.push(it); else console.log('  -> deduped', it.name);
  }

  // Write to js/app.js replacing products array
  const src = fs.readFileSync(APP_JS, 'utf8');
  const marker = 'const products =';
  const idx = src.indexOf(marker);
  if (idx === -1){ console.error('products marker not found'); process.exit(1); }
  const start = src.indexOf('[', idx);
  let i = start; let depth = 0;
  for (; i < src.length; i++){
    const ch = src[i]; if (ch === '[') depth++; else if (ch === ']'){ depth--; if (depth === 0) break; }
    if (ch === '"' || ch === "'" || ch === '`') { const q = ch; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i+=2; else i++; } }
  }
  const end = i;
  const newArray = makeJsLiteral(final.map(f=> Object.assign({}, f, { stripeLink: 'JACKETS_STRIPE_LINK' })));
  const before = src.slice(0, start);
  const after = src.slice(end+1);
  fs.writeFileSync(APP_JS + '.bak', src, 'utf8');
  fs.writeFileSync(APP_JS, before + newArray + after, 'utf8');

  console.log('\nReport:');
  console.log(' Total Depop links processed:', DEPOP_URLS.length);
  console.log(' Imported items:', final.length);
  console.log(' Duplicates removed:', items.length - final.length);
  console.log(' Items with >=1 image:', final.filter(f=>f.images && f.images.length>0).length);
  console.log(' Failed links (blocked/login):', failed.length);
  if (failed.length) console.log(' Failed list:', failed.join('\n'));
}

main().catch(e=>{ console.error(e); process.exit(1); });
