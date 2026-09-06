#!/usr/bin/env node
// Temporary script to fetch 11 new eBay listings and print extracted data
const https = require('https');

const URLS = [
  'https://www.ebay.com/itm/317778058261',
  'https://www.ebay.com/itm/317877525093',
  'https://www.ebay.com/itm/317877520075',
  'https://www.ebay.com/itm/318055200990',
  'https://www.ebay.com/itm/318055198324',
  'https://www.ebay.com/itm/317728917308',
  'https://www.ebay.com/itm/318075235384',
  'https://www.ebay.com/itm/317886446378',
  'https://www.ebay.com/itm/318050547196',
  'https://www.ebay.com/itm/317877522698',
  'https://www.ebay.com/itm/318075238264',
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1'
      }
    };
    https.get(url, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

function extract(html, itemNum) {
  const og_title = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i);
  const title = og_title ? og_title[1].replace(/\s*\|\s*eBay\s*$/, '').trim() : '';

  const priceM = html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)/i)
    || html.match(/"price":"([\d.]+)"/);
  const price = priceM ? parseFloat(priceM[1]) : 0;

  // images/g/HASH/s-l1600
  const imgRe = /https:\/\/i\.ebayimg\.com\/images\/g\/([A-Za-z0-9_~-]+)\/s-l\d+\.jpg/g;
  const imageSet = new Set();
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    imageSet.add('https://i.ebayimg.com/images/g/' + m[1] + '/s-l1600.jpg');
  }
  const images = [...imageSet].slice(0, 8);

  const sizeM = title.match(/\b(XS|S\/M|M\/L|XS\/S|XL\/XXL|XS|SM|MED|LG|XL|XXL|XXXL|Small|Medium|Large|X-Large|XX-Large|XSmall|3XL|2XL|S|M|L)\b/i);
  const size = sizeM ? sizeM[0].toUpperCase() : '';

  return { itemNum, title, price, size, images };
}

async function main() {
  for (const url of URLS) {
    const itemNum = url.split('/').pop();
    process.stdout.write(`Fetching ${itemNum}... `);
    try {
      const { status, body } = await fetchUrl(url);
      if (body.includes('Checking your browser')) {
        console.log(`BLOCKED (status ${status})`);
        continue;
      }
      const data = extract(body, itemNum);
      console.log('OK');
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
  }
}

main();
