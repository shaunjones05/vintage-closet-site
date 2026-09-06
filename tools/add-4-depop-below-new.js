const fs = require('fs');
const vm = require('vm');

const FILE = 'js/app.js';
const NEW_STAMP_COUNT = 26;
const EXCLUDED_NEW_ID = 'eb-317669998950';

function parseProductsFromSource(src) {
  const marker = 'const products =';
  const idx = src.indexOf(marker);
  const start = src.indexOf('[', idx);
  let i = start;
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) break;
    }
    if (ch === '"' || ch === '\'' || ch === '`') {
      const q = ch;
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') i += 2;
        else i++;
      }
    }
  }
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext('products=' + src.slice(start, i + 1), sandbox);
  return { products: sandbox.products || [], start, end: i };
}

function sanitizeDescription(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

const additions = [
  {
    id: 'depop-vintagecloset8pdx-vintage-1990s-polo-ralph-lauren-1eec',
    code: 'TEE-1EEC',
    name: "Vintage 1990s Polo Ralph Lauren Olive Green Cotton Button Up Shirt",
    price: 40,
    size: 'S',
    condition: 'Fair condition',
    description: "Vintage 1990s Polo Ralph Lauren olive green cotton button-up shirt. Fits like medium/small. Flaws as seen in photos. Color: Green/Khaki.",
    images: [
      'https://media-photos.depop.com/b1/43131440/repop_18380792_3874613978/4006744263_ee8de4f1db764e508227e45bfbed0ba3/P0.jpg',
      'https://media-photos.depop.com/b1/43131440/repop_18380792_3874613985/4006744290_b1bb01443e0749b6921f6d3186f0abff/P0.jpg',
      'https://media-photos.depop.com/b1/43131440/repop_18380792_3874613982/4006744295_132621c95ca649b1a8af6766821c403c/P0.jpg',
      'https://media-photos.depop.com/b1/43131440/repop_18380792_3874613990/4006744298_32e9f0b47f974517ba708c50aec2245b/P0.jpg',
      'https://media-photos.depop.com/b1/43131440/repop_18380792_3874613992/4006744276_a2c529cb2d4b4954b74d66c40e1b3458/P0.jpg'
    ],
    status: 'available',
    stripeLink: 'https://buy.stripe.com/REPLACE_WITH_YOUR_LINK',
    category: 'Tees',
    depopUrl: 'https://www.depop.com/products/vintagecloset8pdx-vintage-1990s-polo-ralph-lauren-1eec/'
  },
  {
    id: 'depop-vintagecloset_ndx-2000s-medium-rare-green-weezer-9ada',
    code: 'TEE-9ADA',
    name: '2000s Medium Rare Green Weezer Band Tee Shirt',
    price: 40,
    size: 'S',
    condition: 'Fair condition',
    description: '2000s medium rare green Weezer band tee shirt. Size small, fits medium. Measurements shown in photos. Color: Green.',
    images: [
      'https://media-photos.depop.com/r1/43131440/4166320519_bb5a972f2f2d4317901d1dd00def20cf/P0.jpg',
      'https://media-photos.depop.com/r1/43131440/4166319495_c6d21622738c493b999b28a2fbd1fdea/P0.jpg',
      'https://media-photos.depop.com/r1/43131440/4166320078_c37cdeeb843a41d988813be356262c2d/P0.jpg',
      'https://media-photos.depop.com/r1/43131440/4166320797_0b2f6eb0cec54433a2fddb2999e38ff3/P0.jpg',
      'https://media-photos.depop.com/r1/43131440/4166320613_d90fe0ae15cf4066a7008e93a066884c/P0.jpg',
      'https://media-photos.depop.com/r1/43131440/4166320443_0f81e3ba4f3e41799a6328e5904c57ee/P0.jpg',
      'https://media-photos.depop.com/r1/43131440/4166320520_5656e1b8d67c4d0d866ac653df40ff10/P0.jpg',
      'https://media-photos.depop.com/r1/43131440/4166320796_edfeb997131f41b59de2c9fd5f5ff1f8/P0.jpg'
    ],
    status: 'available',
    stripeLink: 'https://buy.stripe.com/REPLACE_WITH_YOUR_LINK',
    category: 'Tees',
    depopUrl: 'https://www.depop.com/products/vintagecloset_ndx-2000s-medium-rare-green-weezer-9ada/'
  },
  {
    id: 'depop-vintageclose1_pdx-rare-vintage-1996-ok-computer-c9b0',
    code: 'TEE-C9B0',
    name: 'Vintage 1996 Radiohead Band T-Shirt OK Computer Single Stitch',
    price: 400,
    size: 'L',
    condition: 'Brand new',
    description: 'Rare vintage 1996 OK Computer Radiohead band tee shirt. Made in USA single stitch. Mens large, measurements shown. Color: Black.',
    images: [
      'https://media-photos.depop.com/b1/43131440/4199634108_30b8782d74b4429c8d98ccc0f18ce18e/P0.jpg',
      'https://media-photos.depop.com/b1/43131440/4199633486_14b34a7f746d455e89433c125fc73eaa/P0.jpg',
      'https://media-photos.depop.com/b1/43131440/4199633919_a2bdf9dd440144d0866651165befb43a/P0.jpg',
      'https://media-photos.depop.com/b1/43131440/4199631769_835d899a29474866baff22dfb16c743d/P0.jpg',
      'https://media-photos.depop.com/b1/43131440/4199632863_936097514f6949bcbdf6d64c2bbba830/P0.jpg',
      'https://media-photos.depop.com/b1/43131440/4199632593_9424cd5d57e74a99b5924644b4b6c2f9/P0.jpg',
      'https://media-photos.depop.com/b1/43131440/4199633758_47620f6519a54374b6536352abe8d84f/P0.jpg',
      'https://media-photos.depop.com/b1/43131440/4199633842_94766fe8389048fbb9424b0b58d38e9a/P0.jpg'
    ],
    status: 'available',
    stripeLink: 'https://buy.stripe.com/REPLACE_WITH_YOUR_LINK',
    category: 'Tees',
    depopUrl: 'https://www.depop.com/products/vintageclose1_pdx-rare-vintage-1996-ok-computer-c9b0/'
  },
  {
    id: 'depop-vintzgecloset_pdx-vintage-2000s-y2k-era-lebron-4ab7',
    code: 'TEE-4AB7',
    name: 'Vintage 2000s Y2K Era Lebron James Cleveland Cavaliers NBA Jersey #23',
    price: 40,
    size: 'L',
    condition: 'Fair condition',
    description: 'Vintage 2000s Y2K era Lebron James Cleveland Cavaliers NBA jersey #23. Approx. 18.5 x 27. Large mens. Color: Burgundy/Red.',
    images: [
      'https://media-photos.depop.com/r1/43131440/4322060845_b36f38520f0e47a0999164963af5972a/P0.jpg',
      'https://media-photos.depop.com/r1/43131440/4322061412_45755f858528418590e9cb1ccfa5a012/P0.jpg',
      'https://media-photos.depop.com/r1/43131440/4322060316_e8cbe10a4c4f40dba66802eb28c843a3/P0.jpg',
      'https://media-photos.depop.com/r1/43131440/4322060184_1f65440542d7470b8755f3589d9ffb78/P0.jpg',
      'https://media-photos.depop.com/r1/43131440/4322059985_02ad4642559245e6ac9c7abb98f4e4a4/P0.jpg',
      'https://media-photos.depop.com/r1/43131440/4322060846_89613e7757cb4ed9ae26d3c2051df0b0/P0.jpg',
      'https://media-photos.depop.com/r1/43131440/4322061112_f7731c1e95fb46f6be1d631eae6594e1/P0.jpg',
      'https://media-photos.depop.com/r1/43131440/4322059843_885acd2bd836455b8fbc0f2c76675f89/P0.jpg'
    ],
    status: 'available',
    stripeLink: 'https://buy.stripe.com/REPLACE_WITH_YOUR_LINK',
    category: 'Tees',
    depopUrl: 'https://www.depop.com/products/vintzgecloset_pdx-vintage-2000s-y2k-era-lebron-4ab7/'
  }
];

const src = fs.readFileSync(FILE, 'utf8');
const parsed = parseProductsFromSource(src);
const products = parsed.products;

const existingIds = new Set(products.map(p => p && p.id).filter(Boolean));
const existingUrls = new Set(products.map(p => p && p.depopUrl).filter(Boolean));
const toInsert = additions
  .map((p) => ({ ...p, description: sanitizeDescription(p.description) }))
  .filter((p) => !existingIds.has(p.id) && !existingUrls.has(p.depopUrl));

if (toInsert.length === 0) {
  console.log('inserted=0 (all already existed)');
  process.exit(0);
}

const available = products.filter((p) => p && p.status !== 'sold' && p.id !== EXCLUDED_NEW_ID);
const newStampWindow = available.slice(-NEW_STAMP_COUNT);
const firstStampId = newStampWindow.length ? newStampWindow[0].id : null;
let insertIndex = products.length;
if (firstStampId) {
  const idx = products.findIndex((p) => p && p.id === firstStampId);
  if (idx >= 0) insertIndex = idx;
}

const merged = [
  ...products.slice(0, insertIndex),
  ...toInsert,
  ...products.slice(insertIndex)
];

const outArray = JSON.stringify(merged, null, 2);
const newSrc = src.slice(0, parsed.start) + outArray + src.slice(parsed.end + 1);
fs.writeFileSync(FILE, newSrc, 'utf8');

console.log(`inserted=${toInsert.length}`);
console.log(`insertIndex=${insertIndex}`);
for (const item of toInsert) {
  console.log(`added ${item.id} ${item.price}`);
}
