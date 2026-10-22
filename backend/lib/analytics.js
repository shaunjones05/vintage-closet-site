const { timingSafeEqual } = require('node:crypto');
const ORIGINS = ['https://vintageclosetpdx.com', 'https://www.vintageclosetpdx.com'];
const EVENTS = new Set(['page_view', 'add_to_cart', 'checkout_start']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function authorized(value, secret) {
  if (typeof value !== 'string' || !secret) return false;
  const a = Buffer.from(value), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
function page(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  const url = new URL(value, ORIGINS[0]);
  if (url.origin !== ORIGINS[0] || /admin|dashboard|import|order-status|debug/i.test(url.pathname)) return null;
  if (!/^\/[a-z0-9/_-]*(?:\.html)?$/i.test(url.pathname)) return null;
  const id = url.searchParams.get('id');
  const category = url.searchParams.get('category');
  const categories=['All','New Arrivals','Jackets','Tees','Crewnecks & Hoodies','Pants'];
  return (url.pathname === '/' || url.pathname === '/index.html' ? '/' : url.pathname) +
    (url.pathname === '/product.html' && id && /^[\w-]{1,100}$/.test(id) ? '?id=' + id : '') +
    (url.pathname === '/' || url.pathname === '/index.html' ? (url.searchParams.get('archive')==='1' ? '?archive=1' : categories.includes(category) ? '?category='+encodeURIComponent(category) : '') : '');
}
function normalize(body) {
  if (!body || !EVENTS.has(body.event) || !UUID.test(body.visitor_id) || !UUID.test(body.session_id) || !UUID.test(body.id)) return null;
  const path = page(body.path);
  if (!path) return null;
  let referrer = '';
  try { const u = new URL(body.referrer); if (u.protocol === 'https:' || u.protocol === 'http:') referrer = u.hostname.slice(0,150); } catch {}
  const product = typeof body.product_code === 'string' && /^[\w-]{1,100}$/.test(body.product_code) ? body.product_code : null;
  return { id: body.id, event: body.event, visitor_id: body.visitor_id, session_id: body.session_id,
    path, previous_path: page(body.previous_path) || null, referrer,
    product_code: product, device: ['mobile','tablet','desktop'].includes(body.device) ? body.device : 'unknown' };
}
function summarize(rows, days, now = new Date()) {
  const ranked = map => [...map].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label)).slice(0,20);
  const pages=new Map(),sources=new Map(),products=new Map(),paths=new Map(),devices=new Map(),daily=new Map(),sessions=new Map();
  const date = value => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  const bump=(map,key)=>map.set(key,(map.get(key)||0)+1);
  for(let i=days-1;i>=0;i--) daily.set(date(new Date(now.getTime()-i*86400000)),0);
  const views=rows.filter(r=>r.event==='page_view');
  for (const row of rows) { if(!sessions.has(row.session_id)) sessions.set(row.session_id,row); }
  for(const row of views) {
    bump(pages,row.path); bump(devices,row.device); bump(daily,date(row.created_at));
    if(row.product_code) bump(products,row.product_code);
    if(row.previous_path) bump(paths,row.previous_path+' → '+row.path);
  }
  for(const row of sessions.values()) bump(sources, row.referrer && !['vintageclosetpdx.com','www.vintageclosetpdx.com'].includes(row.referrer) ? row.referrer : 'Direct / unknown');
  return { visitors:new Set(views.map(r=>r.visitor_id)).size, sessions:sessions.size, page_views:views.length,
    add_to_cart:rows.filter(r=>r.event==='add_to_cart').length, checkout_start:rows.filter(r=>r.event==='checkout_start').length,
    pages:ranked(pages),sources:ranked(sources),products:ranked(products),paths:ranked(paths),devices:ranked(devices),
    daily:[...daily].sort(([a],[b])=>a.localeCompare(b)).map(([label,count])=>({label,count})) };
}
module.exports={ORIGINS,authorized,normalize,page,summarize};
