// Scrape listing data from e-commerce URLs (Depop, Poshmark, eBay, Mercari, etc.)
// Returns: { success, name, price, images, description, size, condition, category }

const https = require('https');
const http = require('http');
const { URL } = require('url');

function fetchUrl(urlString) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'no-cache'
      },
      timeout: 15000
    };

    client.get(options, (res) => {
      let data = '';

      // Handle compression
      if (res.headers['content-encoding'] === 'gzip') {
        const zlib = require('zlib');
        res.pipe(zlib.createGunzip()).on('data', chunk => data += chunk);
      } else {
        res.on('data', chunk => data += chunk);
      }

      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractFromMeta(html) {
  const data = {};

  // Extract Open Graph data
  const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  const ogPrice = html.match(/<meta\s+property=["']product:price:amount["']\s+content=["']([^"']+)["']/i);
  const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);

  if (ogTitle) data.name = ogTitle[1];
  if (ogPrice) data.price = ogPrice[1];
  if (ogDesc) data.description = ogDesc[1].substring(0, 500);
  if (ogImage) data.images = [ogImage[1]];

  return data;
}

function extractDepopData(html) {
  const data = extractFromMeta(html);

  // Depop-specific: look for product schema in page
  const jsonMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>({[\s\S]*?})<\/script>/i);
  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[1]);
      if (json.name) data.name = json.name;
      if (json.offers?.price) data.price = json.offers.price;
      if (json.description) data.description = json.description.substring(0, 500);
      if (json.image) {
        const imgs = Array.isArray(json.image) ? json.image : [json.image];
        data.images = imgs.map(img => typeof img === 'string' ? img : img.url).filter(Boolean);
      }
    } catch (e) {}
  }

  // Fallback: look for price in page text
  if (!data.price) {
    const priceMatch = html.match(/\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (priceMatch) data.price = priceMatch[1].replace(/,/g, '');
  }

  // Look for images in img tags
  if (!data.images || data.images.length === 0) {
    const imgMatches = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || [];
    const images = [];
    imgMatches.slice(0, 10).forEach(tag => {
      const match = tag.match(/src=["']([^"']+)["']/);
      if (match && (match[1].includes('cloudinary') || match[1].includes('depop') || match[1].includes('s3'))) {
        images.push(match[1]);
      }
    });
    if (images.length > 0) data.images = images.slice(0, 5);
  }

  return data;
}

function extractMercariData(html) {
  const data = extractFromMeta(html);

  // Mercari stores data in window.__INITIAL_STATE__ or similar
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;</);
  if (stateMatch) {
    try {
      const state = JSON.parse(stateMatch[1]);
      // Navigate the Mercari state object structure
      if (state.item?.name) data.name = state.item.name;
      if (state.item?.price) data.price = state.item.price;
      if (state.item?.description) data.description = state.item.description.substring(0, 500);
      if (state.item?.images) {
        data.images = state.item.images.map(img => typeof img === 'string' ? img : img.url).filter(Boolean);
      }
    } catch (e) {}
  }

  // Alternative: look for JSON-LD
  const jsonMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>({[\s\S]*?})<\/script>/i);
  if (jsonMatch && (!data.name || !data.price)) {
    try {
      const json = JSON.parse(jsonMatch[1]);
      if (json.name) data.name = json.name;
      if (json.offers?.price) data.price = json.offers.price;
      if (json.description) data.description = json.description.substring(0, 500);
      if (json.image) {
        const imgs = Array.isArray(json.image) ? json.image : [json.image];
        data.images = imgs.map(img => typeof img === 'string' ? img : img.url).filter(Boolean);
      }
    } catch (e) {}
  }

  // Fallback: extract from visible text
  if (!data.name) {
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (titleMatch) data.name = titleMatch[1].trim();
  }

  if (!data.price) {
    const priceMatch = html.match(/¥?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (priceMatch) data.price = priceMatch[1].replace(/[¥,]/g, '');
  }

  return data;
}

function scrapeListing(html, url) {
  let data = {
    name: '',
    price: '',
    description: '',
    size: '',
    condition: '',
    category: 'Vintage Clothing',
    images: []
  };

  if (url.includes('depop.com')) {
    data = { ...data, ...extractDepopData(html) };
  } else if (url.includes('mercari.com')) {
    data = { ...data, ...extractMercariData(html) };
  } else if (url.includes('poshmark.com')) {
    data = { ...data, ...extractFromMeta(html) };
  } else if (url.includes('ebay.com')) {
    data = { ...data, ...extractFromMeta(html) };
  } else {
    // Generic fallback
    data = { ...data, ...extractFromMeta(html) };
  }

  // Ensure images is an array
  if (!Array.isArray(data.images)) {
    data.images = data.images ? [data.images] : [];
  }

  return data;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const html = await fetchUrl(url);
    const data = scrapeListing(html, url);

    if (!data.name || !data.price) {
      return res.status(400).json({
        error: 'Could not extract listing details. Try manual import.',
        partial: data
      });
    }

    return res.status(200).json({
      success: true,
      ...data
    });

  } catch (err) {
    console.error('Scrape error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to scrape URL'
    });
  }
};

