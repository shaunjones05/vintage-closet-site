const fs = require('fs');
const vm = require('vm');

const checks = [
  { key: 'Vintage Dinosaur Jr Green Mind Tour Band Tee Grail', expected: 2100 },
  { key: 'Vintage Rare 1992 Jimi Hendrix Tee', expected: 135 },
  { key: 'Vintage 1990 Iron Maiden The Trooper Tee', expected: 90 },
  { key: 'Vintage 1992 Grateful Dead Lithuania', expected: 100 },
  { key: 'Vintage 90s Russell Athletic Brother Martin Athletics Hoodie', expected: 30 },
  { key: "Vintage 1970s Levi's 517 Sta-Prest Bootcut Polyester Trousers Navy", expected: 45 },
  { key: "Vintage Levi's 550 Relaxed Fit Orange Tab Jeans Made in USA", expected: 40 },
  { key: 'Vintage Starter 1998 Chicago Bulls Repeat 3-Peat NBA Champions Tee', expected: 35 },
  { key: "O'Neill Vintage Y2K Graphic Zip-Up Hoodie Waffle Lined", expected: 40 },
  { key: 'Vintage 1992 Grateful Dead Spring Tour Liquid Blue Tie Dye T-Shirt', expected: 100 },
  { key: "Levi's SilverTab Loose Fit Baggy Jeans", expected: 45 },
  { key: 'Vintage 1994 Harley-Davidson Daytona Bike Week Eagle T-Shirt Purple Tee', expected: 35 },
  { key: 'Vintage 1970s Champion University of Northern Colorado UNC Bears Football Quarter Sleeve Tee Shirt', expected: 40 },
  { key: 'Vintage 1993 Nike Town Orange County Swoosh T-Shirt', expected: 45 },
  { key: 'Vintage 90s Grateful Dead Liquid Blue Tie Dye Tee Single Stitch Purple', expected: 100 },
  { key: 'Vintage Grateful Dead Steal Your Face Marijuana Tie Dye Shirt', expected: 85 },
  { key: "Vintage 1997 Camel Cigarettes Where It's @ Promo T-Shirt", expected: 40 },
  { key: "Vintage 90s Tommy Hilfiger Vertical Stripe Crest Logo Knit Sweater, Men's Medium", expected: 40 },
  { key: 'Vintage 80s Portland Trail Blazers Chalk Line Satin Bomber Jacket - Made in US', expected: 85 },
  { key: 'Vintage 1980s The Smiths Hatful Of Hollow Band Tee Shirt', expected: 300 },
  { key: 'Carhartt Vintage Faded Denim Trucker Jacket XL Blue Button Up Workwear', expected: 100 },
  { key: 'Liquid Blue VTG 1993 AOP Skull Tee Shirt XL Single Stitch Grail', expected: 80 }
];

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const src = fs.readFileSync('js/app.js', 'utf8');
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

let ok = 0;
let fail = 0;
for (const row of checks) {
  const matches = products.filter((p) => normalize(p && p.name).includes(normalize(row.key)));
  if (matches.length !== 1) {
    fail++;
    console.log(`FAIL_MATCH ${row.key} count=${matches.length}`);
    continue;
  }
  const p = matches[0];
  const got = Number(p.price) || 0;
  if (got !== row.expected) {
    fail++;
    console.log(`FAIL_PRICE ${p.id} expected=${row.expected} got=${got}`);
  } else {
    ok++;
    console.log(`OK ${p.id} ${got}`);
  }
}

console.log(`SUMMARY ok=${ok} fail=${fail}`);
