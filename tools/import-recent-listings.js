#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const APP_JS = path.join(ROOT, 'js', 'app.js');

const LISTINGS = [
  'https://www.depop.com/products/vinpagecloset_pdx-vintage-dinosaur-jr-white-t-shirt-f935/',
  'https://www.depop.com/products/vintagevloset_pdx-carhartt-b73-dst-loose-original-fit-4182/',
  'https://www.depop.com/products/vintageclyset_pdx-vintage-iron-maiden-powerslave-graphic-df5a/',
  'https://www.depop.com/products/vintageclosmt_pdx-vintage-1992-nirvana-smiley-logo-41ef/',
  'https://www.depop.com/products/vintagecroset_pdx-vintage-jesse-james-work-wear-3f73/',
  'https://www.depop.com/products/vintaaecloset_pdx-vintage-2005-danzig-il-demonio-880e/',
  'https://www.depop.com/products/vintagecdoset_pdx-vintage-interstate-denim-jorts-baggy-7c58/',
  'https://www.depop.com/products/vintagecnoset_pdx-vintage-90s-usa-thunder-leader-5440/',
  'https://www.depop.com/products/vintagecloset_pdx-vintage-90s-sunrise-sportswear-the-03b0/',
  'https://www.depop.com/products/vcntagecloset_pdx-jnco-the-low-down-wide-dc4f/',
  'https://www.depop.com/products/vintageclose7_pdx-vintage-status-quo-double-sided-c61d/',
  'https://www.depop.com/products/vintagycloset_pdx-vintage-1998-liquid-blue-kevin-b194/',
  'https://www.depop.com/products/vintageclrset_pdx-2005-vintage-misfits-skull-fiend-2f9d/',
  'https://www.depop.com/products/vintageclolet_pdx-vintage-nwa-ice-cube-t-caa2/',
  'https://www.depop.com/products/vintageclopet_pdx-vintage-rob-zombie-spooks-a-poppin-triple-b793/',
  'https://www.depop.com/products/vintagecnoset_pdx-rare-vintage-2005-snoop-dogg-d791/',
  'https://www.depop.com/products/vintageclosetlpdx-rare-vintage-90s-the-doors-0271/',
  'https://www.depop.com/products/vintagecloset_sdx-vintage-late-90s-distressed-street-67fe/',
  'https://www.depop.com/products/vintagecloset_pds-vintage-1988-mighty-mouse-here-a8e2/',
  'https://www.depop.com/products/vintagecl8set_pdx-2005-misfits-records-meet-the-a7b2/',
  'https://www.depop.com/products/vintageclose3_pdx-vintage-2005-kurt-cobain-graphic-3c91/',
  'https://www.depop.com/products/vintag3closet_pdx-vintage-1996-star-trek-30-1227/',
  'https://www.depop.com/products/vintagecposet_pdx-vintage-1996-the-crow-city-5ee5/',
  'https://www.depop.com/products/vintxgecloset_pdx-vintage-1976-marvel-comics-captain-77aa/',
  'https://www.ebay.com/itm/318665600900',
  'https://www.ebay.com/itm/318656643211'
];

function proxyUrl(url) {
  const clean = String(url || '').trim().replace(/^https?:\/\//i, '');
  return `https://r.jina.ai/http://${clean}`;
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.depop.com'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sourceIdFromUrl(url) {
  const ebay = url.match(/\/itm\/(\d+)/i);
  if (ebay) return `eb-${ebay[1]}`;
  const depop = url.match(/\/products\/([^/]+)\/?$/i);
  if (depop) return `depop-${depop[1]}`;
  return `item-${Buffer.from(url).toString('hex').slice(0, 12)}`;
}

function codeFromUrl(url) {
  const compact = sourceIdFromUrl(url).replace(/[^a-z0-9]/gi, '');
  return `VC-${compact.slice(-4).toUpperCase()}`;
}

function roundPrice(price) {
  const num = Number(price) || 0;
  const discounted = num * 0.8;
  return Math.max(5, Math.ceil(discounted / 5) * 5);
}

function detectSize(text) {
  const source = normalizeText(text);
  const patterns = [
    /\b(XXXL|XXL|XL|L|M|S|XS)\b/i,
    /\b(Extra\s+Large|Extra\s+Small|Small|Medium|Large)\b/i,
    /\b(\d{2}x\d{2})\b/i,
    /\b(W\d{2,3}\s*L\d{2,3})\b/i,
    /\b(size\s*)([A-Z0-9xX\-\s]{1,12})\b/i
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const value = (match[2] || match[1] || match[0]).trim();
    if (/^extra\s+large$/i.test(value)) return 'XL';
    if (/^extra\s+small$/i.test(value)) return 'XS';
    if (/^small$/i.test(value)) return 'S';
    if (/^medium$/i.test(value)) return 'M';
    if (/^large$/i.test(value)) return 'L';
    return value.replace(/\s+/g, '').toUpperCase();
  }

  return '';
}

const COLOR_RULES = [
  ['off-white', 'White'],
  ['cream', 'Cream'],
  ['ivory', 'Cream'],
  ['white', 'White'],
  ['black', 'Black'],
  ['gray', 'Gray'],
  ['grey', 'Gray'],
  ['blue', 'Blue'],
  ['navy', 'Navy'],
  ['red', 'Red'],
  ['green', 'Green'],
  ['yellow', 'Yellow'],
  ['purple', 'Purple'],
  ['pink', 'Pink'],
  ['orange', 'Orange'],
  ['brown', 'Brown'],
  ['tan', 'Tan'],
  ['beige', 'Beige'],
  ['olive', 'Olive'],
  ['camo', 'Camo'],
  ['khaki', 'Khaki'],
  ['teal', 'Teal'],
  ['gold', 'Gold'],
  ['silver', 'Silver'],
  ['maroon', 'Maroon'],
  ['burgundy', 'Burgundy'],
  ['multicolor', 'Multicolor']
];

function detectColors(text) {
  const source = normalizeText(text).toLowerCase();
  const found = [];
  for (const [needle, label] of COLOR_RULES) {
    if (source.includes(needle) && !found.includes(label)) found.push(label);
  }
  return found;
}

function deriveCategory(text) {
  const source = normalizeText(text).toLowerCase();
  if (/pants|jeans|jorts|cargo|shorts/.test(source)) return 'Pants';
  if (/hoodie|sweatshirt|crewneck|sweater|pullover/.test(source)) return 'Crewnecks & Hoodies';
  if (/jacket|coat|windbreaker|bomber|outerwear|chore|detroit/.test(source)) return 'Jackets';
  return 'Tees';
}

function extractImages(html) {
  const patterns = [
    /https?:\/\/media-photos\.depop\.com\/[^\s"'<>]+/gi,
    /https?:\/\/i\.depopcdn\.com\/[^\s"'<>]+/gi,
    /https?:\/\/i\.ebayimg\.com\/images\/g\/[A-Za-z0-9_~\-]+\/s-l\d+\.(?:jpg|jpeg|png|webp)/gi,
    /https?:\/\/i\.ebayimg\.com\/thumbs\/images\/g\/[A-Za-z0-9_~\-]+\/s-l\d+\.(?:jpg|jpeg|png|webp)/gi
  ];

  const images = new Set();
  for (const pattern of patterns) {
    const matches = html.match(pattern) || [];
    for (const url of matches) {
      images.add(url.replace(/&amp;/g, '&').replace(/s-l\d+/i, 's-l1600'));
    }
  }

  return [...images].slice(0, 8);
}

function normalizeTitle(title) {
  return normalizeText(title)
    .replace(/\s*\|\s*eBay\s*$/i, '')
    .replace(/\s*\|\s*Depop\s*$/i, '')
    .replace(/^Depop\s+/i, '')
    .trim();
}

function extractTitle(text) {
  const lines = String(text || '').split(/\r?\n/).map(normalizeText).filter(Boolean);
  for (const line of lines) {
    if (/^#\s+/.test(line)) return normalizeTitle(line.replace(/^#\s+/, ''));
  }
  for (const line of lines) {
    if (/^##\s+/.test(line)) return normalizeTitle(line.replace(/^##\s+/, ''));
  }
  return normalizeTitle(lines.find(Boolean) || '');
}

function extractPrice(text, title) {
  const source = String(text || '');
  const anchor = title ? source.indexOf(title) : -1;
  const searchArea = anchor >= 0 ? source.slice(anchor, anchor + 4000) : source;
  const moneyMatches = [...searchArea.matchAll(/(?:US\s*)?\$\s*([\d,]+(?:\.\d{2})?)/gi)];
  for (const match of moneyMatches) {
    const num = Number(String(match[1]).replace(/,/g, ''));
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
}

function extractDescription(text, title) {
  const source = String(text || '');
  const titleIndex = title ? source.indexOf(title) : -1;
  const endMarkers = ['More from this seller', 'Item specifics', 'About this seller', 'Recent reviews', 'Shop by color', 'Related searches', 'Additional Links'];
  let endIndex = source.length;
  for (const marker of endMarkers) {
    const idx = source.indexOf(marker);
    if (idx !== -1 && idx < endIndex) endIndex = idx;
  }
  const startIndex = titleIndex >= 0 ? titleIndex + title.length : 0;
  const slice = source.slice(startIndex, Math.min(endIndex, startIndex + 4000));
  return normalizeText(slice)
    .replace(/^[-–—:|\s]+/, '')
    .replace(/(?:\bhelp & report\b|\bpage title\b|\burl\b|\brecent events\b)/ig, '')
    .trim();
}

function extractFromHtml(text, url) {
  const plain = normalizeText(String(text || ''));
  const title = extractTitle(plain);
  const rawPrice = extractPrice(plain, title);
  const description = extractDescription(plain, title) || title;
  const size = detectSize(`${title} ${description} ${plain}`);
  const colors = detectColors(`${title} ${description} ${plain}`);
  const category = deriveCategory(`${title} ${description}`);
  let finalDescription = description || title;
  if (size && !/\bsize\b/i.test(finalDescription)) finalDescription = `${finalDescription} Size: ${size}`.trim();
  if (colors.length && !/\bcolor\b/i.test(finalDescription)) finalDescription = `${finalDescription} Color: ${colors.join('/')}`.trim();

  const images = extractImages(text);
  if (images.length === 0) {
    images.push(url.includes('depop.com')
      ? 'https://media-photos.depop.com/b1/43131440/3242367533_da68f1f0f5b046bc8a2fa0c715434ed8/P0.jpg'
      : 'https://i.ebayimg.com/images/g/placeholder/s-l1600.jpg');
  }

  return {
    id: sourceIdFromUrl(url),
    code: codeFromUrl(url),
    name: title,
    price: roundPrice(rawPrice),
    size,
    description: finalDescription,
    images,
    status: 'available',
    stripeLink: 'https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK',
    sourceUrl: url,
    category
  };
}

function extractProductsArray(source) {
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
    if (ch === '"' || ch === '\'' || ch === '`') {
      const quote = ch;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') i += 2;
        else i++;
      }
    }
  }

  return { start, end: i, arrayText: source.slice(start, i + 1) };
}

function stringifyProduct(product) {
  const esc = value => String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const images = (Array.isArray(product.images) ? product.images : []).map(url => `'${esc(url)}'`).join(', ');
  return `
  {
    id: '${esc(product.id)}',
    code: '${esc(product.code)}',
    name: '${esc(product.name)}',
    price: ${Number(product.price) || 0},
    size: '${esc(product.size)}',
    description: '${esc(product.description)}',
    images: [${images}],
    status: 'available',
    stripeLink: JACKETS_STRIPE_LINK,
    sourceUrl: '${esc(product.sourceUrl)}',
    category: '${esc(product.category || 'Tees')}'
  }`;
}

async function main() {
  console.log('Fetching', LISTINGS.length, 'recent listings...\n');

  const products = [];
  for (const url of LISTINGS) {
    const label = sourceIdFromUrl(url);
    console.log(`Fetching ${label}...`);
    let text = '';
    try {
      text = await httpsGet(proxyUrl(url));
    } catch (proxyError) {
      text = await httpsGet(url);
    }
    const product = extractFromHtml(text, url);
    products.push(product);
    console.log(`  ✓ ${product.name}`);
    console.log(`    Price: $${product.price} (20% off, rounded up to $5)`);
    console.log(`    Size: ${product.size || '(none)'}`);
    console.log(`    Color: ${(detectColors(`${product.name} ${product.description}`).join('/') || '(none)')}`);
    console.log(`    Images: ${product.images.length}\n`);
  }

  const source = fs.readFileSync(APP_JS, 'utf8');
  const { start, end, arrayText } = extractProductsArray(source);

  const sandbox = { JACKETS_STRIPE_LINK: 'https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK' };
  vm.createContext(sandbox);
  vm.runInContext('products=' + arrayText, sandbox);
  const existingProducts = sandbox.products || [];
  const existingIds = new Set(existingProducts.map(product => product && product.id));
  const toAdd = products.filter(product => !existingIds.has(product.id));

  if (toAdd.length === 0) {
    console.log('All recent listings already exist in app.js. No changes made.');
    return;
  }

  const backup = APP_JS + '.bak-recent-' + Date.now();
  fs.writeFileSync(backup, source, 'utf8');
  console.log('Backup:', backup);

  const before = source.slice(0, end);
  const after = source.slice(end);
  const appended = toAdd.map(stringifyProduct).join(',');
  const newSource = before.replace(/\]$/, '') + (existingProducts.length ? ',' : '') + appended + ']' + after.slice(1);

  fs.writeFileSync(APP_JS, newSource, 'utf8');

  console.log(`\n✓ Added ${toAdd.length} new products to app.js`);
  console.log('Added IDs:', toAdd.map(product => product.id).join(', '));
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});