const { createClient } = require('@supabase/supabase-js');

const MAX_URLS = 25;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://vintageclosetpdx.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-import-password');
}

function decodeHtml(value = '') {
  return value.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]*>/g, '').trim();
}

function meta(html, property) {
  const escaped = property.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  for (const pattern of [new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'), new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')]) {
    const found = html.match(pattern); if (found) return decodeHtml(found[1]);
  }
  return '';
}

function listingId(url) { const found = url.match(/\/items\/(\d+)/); if (!found) throw new Error('Vinted URL must include an item ID.'); return found[1]; }
function extractImages(html) { return [...new Set([...html.matchAll(/https:\\?\/\\?\/images\d+\.vinted\.net[^"'\\\s<]+?\/f800\/[^"'\\\s<]+/g)].map((m) => m[0].replace(/\\u0026/g, '&').replace(/\\\//g, '/')))]; }
function parseTextValue(html, testId) { const found = html.match(new RegExp(`data-testid=["']${testId}["'][\\s\\S]{0,1600}?<span[^>]*>([^<]+)<`, 'i')); return found ? decodeHtml(found[1]) : ''; }

async function fetchResponse(url, type) {
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: type === 'html' ? 'text/html,application/xhtml+xml' : 'image/avif,image/webp,image/*,*/*;q=0.8', 'accept-language': 'en-US,en;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(type === 'html' ? 20000 : 30000) });
  if (!response.ok) throw new Error(`Could not download ${type} (${response.status}).`); return response;
}

async function scrapeVinted(sourceUrl) {
  const html = await (await fetchResponse(sourceUrl, 'html')).text();
  const id = listingId(sourceUrl), name = meta(html, 'og:title').replace(/\s*\|\s*Vinted\s*$/i, ''), description = meta(html, 'og:description');
  const price = Number(html.match(/"originalAskingAmount":\{"amount":"([\d.]+)"/)?.[1]), images = extractImages(html);
  if (!name || !Number.isFinite(price) || price <= 0 || !images.length) throw new Error('Vinted did not return the required title, price, or photos.');
  return { id, name, description, price, images, size: parseTextValue(html, 'item-attributes-size'), condition: parseTextValue(html, 'item-attributes-status'), category: 'Jackets', platform: 'vinted' };
}

async function scrapeDepop(sourceUrl) {
  // Seller dashboard links end in /manage/. They require a Depop login and
  // return 403 from Vercel, while the matching public product URL is usable.
  const publicUrl = sourceUrl.replace(/\/manage\/?(?=[?#]|$)/i, '/');
  const html = await (await fetchResponse(publicUrl, 'html')).text();
  const id = publicUrl.match(/products\/[^/?#]+/i)?.[0].replace(/^products\//i, '') || `depop-${Buffer.from(publicUrl).toString('base64url').slice(0, 20)}`;
  const name = meta(html, 'og:title').replace(/\s*\|\s*Depop\s*$/i, '');
  const description = meta(html, 'og:description');
  const price = Number((meta(html, 'product:price:amount') || html.match(/\$\s*([\d,.]+)/)?.[1] || '').replace(/,/g, ''));
  const images = [...new Set([...html.matchAll(/https?:\/\/media-photos\.depop\.com\/[^"'\\s<]+/g)].map((m) => m[0]))];
  if (!name || !Number.isFinite(price) || price <= 0 || !images.length) throw new Error('Depop did not return the required title, price, or photos.');
  return { id, name, description, price, images, size: '', condition: '', category: 'Vintage Clothing', platform: 'depop' };
}

async function copyImages(supabase, listing) {
  const urls = [];
  for (const [index, imageUrl] of listing.images.entries()) {
    const response = await fetchResponse(imageUrl, 'image'), bytes = Buffer.from(await response.arrayBuffer()), type = response.headers.get('content-type') || 'image/webp';
    const ext = type.includes('png') ? 'png' : type.includes('jpeg') ? 'jpg' : 'webp', path = `${listing.platform || 'vinted'}/${listing.id}/${String(index + 1).padStart(2, '0')}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, bytes, { contentType: type, upsert: true, cacheControl: '31536000' });
    if (error) throw new Error(`Storage upload failed for photo ${index + 1}: ${error.message}`);
    urls.push(supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

async function publish(supabase, listing, sourceUrl) {
  const code = `${listing.platform === 'depop' ? 'DPP' : 'VTD'}-${listing.id}`, images = await copyImages(supabase, listing);
  const product = { code, name: listing.name, price: listing.price, size: listing.size || null, condition: listing.condition || null, category: listing.category, description: listing.description || null, images, source_url: sourceUrl, source_platform: listing.platform || 'vinted', status: 'published', published_at: new Date().toISOString() };
  const { data: saved, error: productError } = await supabase.from('products').upsert(product, { onConflict: 'source_url' }).select().single();
  if (productError) throw new Error(`Product publish failed: ${productError.message}`);
  const { error: inventoryError } = await supabase.from('inventory').upsert({ item_code: code, status: 'available', sold_at: null, stripe_session_id: null }, { onConflict: 'item_code' });
  if (inventoryError) throw new Error(`Inventory update failed: ${inventoryError.message}`);
  return { product: saved, imageCount: images.length, code };
}

module.exports = async (req, res) => {
  setCors(res); if (req.method === 'OPTIONS') return res.status(204).end(); if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.IMPORT_PASSWORD || req.headers['x-import-password'] !== process.env.IMPORT_PASSWORD) return res.status(401).json({ error: 'Invalid importer password.' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Supabase is not configured on this Vercel project.' });
  const urls = [...new Set((req.body?.urls || []).map((url) => String(url).trim()).filter(Boolean))];
  const mode = req.body?.mode === 'preview' ? 'preview' : 'publish';
  if (!urls.length || urls.length > MAX_URLS || urls.some((url) => !/^https:\/\/(www\.)?(vinted\.com\/items\/\d+|depop\.com\/products\/)/i.test(url))) return res.status(400).json({ error: `Provide 1–${MAX_URLS} valid Vinted or Depop item URLs.` });
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }), results = [];
  for (const url of urls) { try { const listing = /depop\.com/i.test(url) ? await scrapeDepop(url) : await scrapeVinted(url); results.push(mode === 'preview' ? { success: true, sourceUrl: url, draft: listing } : { success: true, sourceUrl: url, ...(await publish(supabase, listing, url)) }); } catch (error) { results.push({ success: false, sourceUrl: url, error: error.message }); } }
  const success = results.filter((result) => result.success).length; return res.status(success === urls.length ? 201 : 207).json({ success, failed: urls.length - success, results });
};
