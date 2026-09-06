// Regenerate sitemap.xml, excluding sold items and test items
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
// Extract products array from lines 76-2002 of app.js (hardcoded for reliability)
const lines = code.split('\n');
const startIdx = lines.findIndex(l => l.trimStart().startsWith('const products = ['));
if (startIdx === -1) { console.error('Could not find products array'); process.exit(1); }
// Extract just the JSON array portion (after "const products = ")
const arrayStart = lines[startIdx].indexOf('[');
// Find the end: a line that is exactly "];" 
let endIdx = -1;
for (let i = startIdx + 1; i < lines.length; i++) {
  if (lines[i].trim() === '];') { endIdx = i; break; }
}
if (endIdx === -1) { console.error('Could not find end of products array'); process.exit(1); }
const rawLines = lines.slice(startIdx, endIdx + 1);
rawLines[0] = rawLines[0].slice(arrayStart); // strip "const products = "
rawLines[rawLines.length - 1] = ']'; // strip trailing semicolon
const arrayText = rawLines.join('\n');
const products = JSON.parse(arrayText);

const activeProducts = products.filter(p => p.status !== 'sold' && !String(p.id).startsWith('test-'));
console.log(`Active products for sitemap: ${activeProducts.length} (excluded ${products.length - activeProducts.length} sold/test)`);

function getSlug(product) {
  return String((product && product.name) || '')
    .replace(/\s*\|\s*eBay$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const today = new Date().toISOString().slice(0, 10);

const staticPages = [
  { loc: 'https://www.vintageclosetpdx.com/', changefreq: 'daily', priority: '1.0' },
  { loc: 'https://www.vintageclosetpdx.com/about.html', changefreq: 'monthly', priority: '0.6' },
  { loc: 'https://www.vintageclosetpdx.com/vintage-carhartt.html', changefreq: 'weekly', priority: '0.8' },
  { loc: 'https://www.vintageclosetpdx.com/vintage-graphic-tees.html', changefreq: 'weekly', priority: '0.8' },
  { loc: 'https://www.vintageclosetpdx.com/vintage-jackets.html', changefreq: 'weekly', priority: '0.8' },
];

let urls = staticPages.map(p => `  <url>
    <loc>${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`);

for (const p of activeProducts) {
  const slug = getSlug(p);
  const loc = `https://www.vintageclosetpdx.com/product.html?id=${p.id}&amp;slug=${slug}`;
  urls.push(`  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(root, 'sitemap.xml'), xml);
console.log(`sitemap.xml written with ${urls.length} URLs`);
