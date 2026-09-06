const https = require('https');
const items = ['317778058261', '317877525093', '317877520075', '318055200990', '318055198324', '317728917308', '318075235384', '317886446378', '318050547196', '317877522698', '318075238264'];

function fetchUrl(url, hdrs) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: hdrs }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, hdrs).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({status: res.statusCode, body}));
    }).on('error', reject);
  });
}

async function tryItem(id) {
  const url = 'https://www.ebay.com/itm/' + id;
  const hdrs = {
    'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8'
  };
  const {status, body} = await fetchUrl(url, hdrs);
  const blocked = body.includes('Checking your browser') || body.includes('SG_SS');
  const og_title = body.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i);
  const og_price = body.match(/property=["']og:price:amount["'][^>]*content=["']([^"']+)/i);
  const price_meta = body.match(/itemprop=["']price["'][^>]*content=["']([^"']+)/i);
  const price_json = body.match(/"price":"([0-9.]+)"/);
  const img = body.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i);
  console.log(JSON.stringify({
    id,
    blocked,
    status,
    title: og_title ? og_title[1].replace(' | eBay', '') : null,
    price: og_price ? og_price[1] : (price_meta ? price_meta[1] : (price_json ? price_json[1] : null)),
    img: img ? img[1] : null,
    bodyLen: body.length
  }));
}

(async () => {
  for (const id of items) {
    await tryItem(id);
  }
})();
