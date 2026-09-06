// Try multiple UA strategies to get eBay data
const https = require('https');

const items = [
  '317778058261', '317877525093', '317877520075', '318055200990',
  '318055198324', '317728917308', '318075235384', '317886446378',
  '318050547196', '317877522698', '318075238264'
];

const UAs = [
  'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  'Googlebot/2.1 (+http://www.google.com/bot.html)',
  'WhatsApp/2.21.1 A',
  'TelegramBot (like TwitterBot)',
];

function fetchUrl(url, ua) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, ua).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({status: res.statusCode, body, url}));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  // Try first item with all UAs to find one that works
  const id = items[0];
  const url = 'https://www.ebay.com/itm/' + id;
  
  for (const ua of UAs) {
    process.stdout.write(`UA: ${ua.substring(0, 40)}... `);
    try {
      const {status, body} = await fetchUrl(url, ua);
      const blocked = body.includes('Checking your browser') || body.includes('SG_SS') || body.includes('challenge');
      const og_title = body.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i);
      console.log(blocked ? 'BLOCKED' : `OK - title: ${og_title ? og_title[1].substring(0,60) : 'no-title'}`);
      if (!blocked && og_title) {
        console.log('FOUND WORKING UA:', ua);
        break;
      }
    } catch(e) {
      console.log('ERROR:', e.message);
    }
  }
}

main();
