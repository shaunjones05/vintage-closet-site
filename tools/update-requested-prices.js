const fs = require('fs');
const vm = require('vm');

const FILE = 'js/app.js';

const updates = [
  { key: 'Vintage Dinosaur Jr Green Mind Tour Band Tee Grail', price: 2100 },
  { key: 'Vintage Rare 1992 Jimi Hendrix Tee', price: 135 },
  { key: 'Vintage 1990 Iron Maiden The Trooper Tee', price: 90 },
  { key: 'Vintage 1992 Grateful Dead Lithuania', price: 100 },
  { key: 'Vintage 90s Russell Athletic Brother Martin Athletics Hoodie', price: 30 },
  { key: "Vintage 1970s Levi's 517 Sta-Prest Bootcut Polyester Trousers Navy", price: 45 },
  { key: "Vintage Levi's 550 Relaxed Fit Orange Tab Jeans Made in USA", price: 40 },
  { key: 'Vintage Starter 1998 Chicago Bulls Repeat 3-Peat NBA Champions Tee', price: 35 },
  { key: "O'Neill Vintage Y2K Graphic Zip-Up Hoodie Waffle Lined", price: 40 },
  { key: 'Vintage 1992 Grateful Dead Spring Tour Liquid Blue Tie Dye T-Shirt', price: 100 },
  { key: "Levi's SilverTab Loose Fit Baggy Jeans", price: 45 },
  { key: 'Vintage 1994 Harley-Davidson Daytona Bike Week Eagle T-Shirt Purple Tee', price: 35 },
  { key: 'Vintage 1970s Champion University of Northern Colorado UNC Bears Football Quarter Sleeve Tee Shirt', price: 40 },
  { key: 'Vintage 1993 Nike Town Orange County Swoosh T-Shirt', price: 45 },
  { key: 'Vintage 90s Grateful Dead Liquid Blue Tie Dye Tee Single Stitch Purple', price: 100 },
  { key: 'Vintage Grateful Dead Steal Your Face Marijuana Tie Dye Shirt', price: 85 },
  { key: "Vintage 1997 Camel Cigarettes Where It's @ Promo T-Shirt", price: 40 },
  { key: "Vintage 90s Tommy Hilfiger Vertical Stripe Crest Logo Knit Sweater, Men's Medium", price: 40 },
  { key: 'Vintage 80s Portland Trail Blazers Chalk Line Satin Bomber Jacket - Made in US', price: 85 },
  { key: 'Vintage 1980s The Smiths Hatful Of Hollow Band Tee Shirt', price: 300 },
  { key: 'Carhartt Vintage Faded Denim Trucker Jacket XL Blue Button Up Workwear', price: 100 },
  { key: 'Liquid Blue VTG 1993 AOP Skull Tee Shirt XL Single Stitch Grail', price: 80 }
];

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const src = fs.readFileSync(FILE, 'utf8');
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
const products = sandbox.products || [];

const hits = [];
const misses = [];

for (const req of updates) {
  const key = normalize(req.key);
  const matches = products.filter((p) => normalize(p && p.name).includes(key));
  if (matches.length === 1) {
    const prod = matches[0];
    const oldPrice = Number(prod.price) || 0;
    prod.price = req.price;
    hits.push({ key: req.key, id: prod.id, oldPrice, newPrice: req.price });
  } else {
    misses.push({ key: req.key, matchCount: matches.length, sample: matches.slice(0, 3).map((m) => ({ id: m.id, name: m.name })) });
  }
}

const outArray = JSON.stringify(products, null, 2);
const newSrc = src.slice(0, start) + outArray + src.slice(i + 1);
fs.writeFileSync(FILE, newSrc, 'utf8');

console.log('updated=' + hits.length);
for (const h of hits) {
  console.log(`OK ${h.id} ${h.oldPrice} -> ${h.newPrice}`);
}
console.log('misses=' + misses.length);
for (const m of misses) {
  console.log(`MISS ${m.matchCount} ${m.key}`);
  if (m.sample.length) {
    for (const s of m.sample) {
      console.log(`  CANDIDATE ${s.id} :: ${s.name}`);
    }
  }
}
