#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const fetch = global.fetch || require('node-fetch');

const LINKS = [
  'https://www.ebay.com/itm/317664148959',
  'https://www.ebay.com/itm/317662994855',
  'https://www.ebay.com/itm/317663038780',
  'https://www.ebay.com/itm/317624659137',
  'https://www.ebay.com/itm/317665941836',
  'https://www.ebay.com/itm/317669913541',
  'https://www.ebay.com/itm/317670612819',
  'https://www.ebay.com/itm/317669597832',
  'https://www.ebay.com/itm/317669600593',
  'https://www.ebay.com/itm/317694601089'
];

const OUT = path.resolve(__dirname, '..', 'js', 'app.js');
const BACKUP = OUT + '.bak';

const STRIPE_CONST = 'JACKETS_STRIPE_LINK';
const STRIPE_FALLBACK = "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK";

const BUCKETS = [20,40,60,80,100,125,150,175,200,250,300];

function log(...a){ console.log(...a); }

async function fetchHtml(url){
  try{
    const res = await fetch(url, { headers: { 'User-Agent':'Mozilla/5.0 (compatible; VintageClosetBot/1.0)', 'Accept':'text/html' } , redirect:'follow' });
    if (!res.ok) return { blocked: true, html: '' };
    const t = await res.text();
    return { blocked:false, html: t };
  }catch(e){
    return { blocked:true, html: '' };
  }
}

function extractJsonLd(html){
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/ig;
  let m;
  while((m=re.exec(html))){
    try{ const j = JSON.parse(m[1]); out.push(j); }catch(e){}
  }
  return out;
}

function extractMetaImage(html){
  const out = [];
  const re = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/ig;
  let m; while((m=re.exec(html))){ out.push(m[1]); }
  return out;
}

function extractItempropImage(html){
  const out = [];
  const re1 = /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/ig;
  const re2 = /<img[^>]+itemprop=["']image["'][^>]+src=["']([^"']+)["']/ig;
  let m; while((m=re1.exec(html))){ out.push(m[1]); }
  while((m=re2.exec(html))){ out.push(m[1]); }
  return out;
}

function extractIebayUrls(html){
  const out = [];
  const re = /(https?:\/\/i\.ebayimg\.com[^"'<>\s]+)/ig;
  let m; while((m=re.exec(html))){ out.push(cleanUrl(m[1])); }
  return out;
}

function cleanUrl(u){
  return u.replace(/\s+/g,'').replace(/\)+$/,'');
}

function dedupePreserve(arr){
  const seen = new Set(); const out = [];
  for(const v of arr){ if(!v) continue; if(!seen.has(v)){ seen.add(v); out.push(v); } }
  return out;
}

function roundPrice(n, roundDown=false){
  let price = Number(n) || 0;
  // Cap at max bucket
  const max = BUCKETS[BUCKETS.length-1];
  if (price >= max) return max;
  if (!roundDown){
    for(const b of BUCKETS){ if (price <= b) return b; }
    return max;
  } else {
    // round down: find largest bucket <= price, or min bucket
    for(let i=BUCKETS.length-1;i>=0;i--){ if (price >= BUCKETS[i]) return BUCKETS[i]; }
    return BUCKETS[0];
  }
}

function guessSize(text){
  if(!text) return '';
  const s = String(text);
  const m = s.match(/\b(XXL|XL|L|M|S|XS|\d{2}\b)\b/i);
  return m? m[0].toUpperCase() : '';
}

function guessCondition(html, title, desc){
  const hay = (html||'') + '\n' + (title||'') + '\n' + (desc||'');
  const re = /Condition[:\s<]+([^<\n]+)/i;
  const m = hay.match(re);
  if(m && m[1]) return m[1].trim().replace(/[:;\-\s]+$/,'');
  return '';
}

function sanitizeDescription(s){
  if(!s) return '';
  let out = String(s);
  out = out.replace(/#\S+/g, '');
  // remove common bundle/discount promotional lines
  out = out.replace(/(?:bundle discount|get\s*\d+%?\s*off|\d+%?\s*off)/gi, '');
  out = out.replace(/(?:,\s*[^,]{1,40}){2,}\s*$/,'');
  out = out.replace(/\s+/g,' ').trim();
  out = out.replace(/^[,;:\-\s]+|[,;:\-\s]+$/g,'').trim();
  return out;
}

async function processUrl(url){
  const info = { url, blocked:false, images:[], title:'', price:0, description:'', itemNumber:'', size:'', condition:'' };
  const r = await fetchHtml(url);
  if(r.blocked){ info.blocked = true; return info; }
  const html = r.html;
  // item number from URL
  const it = (url.match(/\/(\d+)(?:$|\D)/) || [])[1];
  if(it) info.itemNumber = it;
  // JSON-LD
  try{
    const jlds = extractJsonLd(html);
    for(const j of jlds){
      if (j && j['@type'] && /product/i.test(j['@type'])){
        if (j.name) info.title = info.title || j.name;
        if (j.description) info.description = info.description || j.description;
        if (j.image){
          if (Array.isArray(j.image)) info.images.push(...j.image.map(cleanUrl));
          else info.images.push(cleanUrl(j.image));
        }
        if (j.offers && j.offers.price) info.price = info.price || j.offers.price;
      }
    }
  }catch(e){}

  // og:image
  extractMetaImage(html).forEach(u=>info.images.push(cleanUrl(u)));
  // itemprop image
  extractItempropImage(html).forEach(u=>info.images.push(cleanUrl(u)));
  // any i.ebayimg.com urls
  extractIebayUrls(html).forEach(u=>info.images.push(u));

  // try to find title if not present
  if(!info.title){
    const m = html.match(/<title>([^<]+)<\/title>/i);
    if(m) info.title = m[1].replace(/\s*\|\s*eBay.*$/i,'').trim();
  }
  // price heuristics
  if(!info.price){
    const m = html.match(/\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/);
    if(m) info.price = m[1].replace(/,/g,'');
  }

  // description guess
  if(!info.description){
    const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    if(m) info.description = m[1];
    else {
      const dd = html.match(/<div[^>]+id=["']viTabs_0_is["'][^>]*>([\s\S]*?)<\/div>/i);
      if(dd) info.description = dd[1].replace(/<[^>]+>/g,' ');
    }
  }

  // condition
  info.condition = guessCondition(html, info.title, info.description);

  // sanitize description
  info.description = sanitizeDescription(info.description || '');

  // dedupe images and prefer i.ebayimg.com first while preserving order
  const imgs = dedupePreserve(info.images);
  // sort to put i.ebayimg.com first but keep relative order
  imgs.sort((a,b)=>{ if(a.includes('i.ebayimg.com') && !b.includes('i.ebayimg.com')) return -1; if(b.includes('i.ebayimg.com') && !a.includes('i.ebayimg.com')) return 1; return 0; });
  info.images = imgs.map(cleanUrl);

  // size
  info.size = guessSize(info.title + ' ' + info.description) || '';

  // price rounding (special-case: round DOWN for 317680999752)
  const roundDownFor = '317680999752';
  const shouldRoundDown = info.itemNumber === roundDownFor;
  info.rounded = roundPrice(info.price, shouldRoundDown);

  return info;
}

function buildProductFromInfo(info){
  const id = info.itemNumber ? `eb-${info.itemNumber}` : `eb-${Date.now()}`;
  const code = info.itemNumber ? `JKT-${String(info.itemNumber).slice(-4)}` : `JKT-${Date.now()%10000}`;
  return {
    id,
    code,
    name: info.title || '',
    price: info.rounded || 0,
    size: info.size || '',
    condition: info.condition || '',
    description: info.description || '',
    images: info.images || [],
    status: 'available',
    stripeLink: typeof global.JACKETS_STRIPE_LINK !== 'undefined' ? global.JACKETS_STRIPE_LINK : STRIPE_FALLBACK,
    ebayItemNumber: info.itemNumber || '',
    ebayUrl: info.url || ''
  };
}

async function main(){
  const results = [];
  for(const url of LINKS){
    log('Fetching', url);
    const info = await processUrl(url);
    results.push(info);
    log('  images found:', info.images.length, 'blocked:', info.blocked);
  }

  // read existing js/app.js
  let appjs = '';
  try{ appjs = fs.readFileSync(OUT,'utf8'); }catch(e){ console.error('Unable to read', OUT); process.exit(1); }
  // ensure backup
  fs.writeFileSync(BACKUP, appjs, 'utf8');
  log('Wrote backup to', BACKUP);

  // determine if JACKETS_STRIPE_LINK exists
  if (!/const\s+JACKETS_STRIPE_LINK\s*=/.test(appjs)){
    appjs = `const JACKETS_STRIPE_LINK = '${STRIPE_FALLBACK}';\n` + appjs;
    log('Prepended fallback JACKETS_STRIPE_LINK');
  }

  // find existing products array
  const m = appjs.match(/const\s+products\s*=\s*\[([\s\S]*?)\];/m);
  if(!m){ console.error('Could not locate products array in', OUT); process.exit(1); }
  const existingBody = m[1];

  // parse existing ebayItemNumbers to dedupe
  const existingItems = new Set();
  const reEbay = /ebayItemNumber:\s*['"](\d+)['"]/g;
  let mm; while((mm=reEbay.exec(existingBody))){ existingItems.add(mm[1]); }

  const toAdd = [];
  for(const info of results){
    if(info.blocked){ continue; }
    if(!info.itemNumber){ continue; }
    if(existingItems.has(info.itemNumber)){
      log('Skipping existing item', info.itemNumber);
      continue;
    }
    const prod = buildProductFromInfo(info);
    toAdd.push(prod);
  }

  if(toAdd.length === 0){ log('No new products to add.'); return report(results, toAdd); }

  // serialize new products
  const pad = '\n  ';
  const newObjs = toAdd.map(p=> JSON.stringify(p, null, 2)).join(',\n\n  ');

  // insert before the closing bracket of products
  const replaced = appjs.replace(/(const\s+products\s*=\s*\[)([\s\S]*?)(\];)/m, (all, start, body, end)=> start + body.trim() + (body.trim()? ',\n\n  ' : '\n  ') + newObjs + '\n' + end);

  fs.writeFileSync(OUT, replaced, 'utf8');
  log('Appended', toAdd.length, 'new products to', OUT);

  return report(results, toAdd);
}

function report(results, added){
  const newCount = added.length;
  let withImages = 0, multi = 0;
  const blocked = [];
  for(const r of results){ if(r.blocked) blocked.push(r.url); if((r.images||[]).length>0) withImages++; if((r.images||[]).length>1) multi++; }
  console.log('\nFINAL REPORT');
  console.log('New products added:', newCount);
  console.log('Products with >=1 image:', withImages);
  console.log('Products with multiple images:', multi);
  console.log('Blocked or no-images URLs:');
  results.forEach(r=>{ if(r.blocked || (r.images||[]).length===0) console.log(' -', r.url); });
  return { results, added };
}

main().catch(e=>{ console.error(e); process.exit(1); });
