
const { chromium } = require('playwright');

const listings = [
  { id: 'depop-b681', url: 'https://www.depop.com/products/vintagecloset_tdx-1990s-san-francisco-49ers-red-b681/' },
  { id: 'depop-6f5b', url: 'https://www.depop.com/products/vintagec5oset_pdx-vintage-1970s-welgrume-sportswear-100-6f5b/' },
  { id: 'depop-c3a6', url: 'https://www.depop.com/products/vintagecl2set_pdx-vintage-1980s-surf-tee-vintage-c3a6/' },
  { id: 'depop-676f', url: 'https://www.depop.com/products/vintagecloset_pd5-vintage-1990s-phat-farm-corduroy-676f/' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const listing of listings) {
    const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' });
    const page = await ctx.newPage();
    const images = [];
    page.on('response', async resp => {
      const u = resp.url();
      if (u.includes('/b1/43131440/') && u.includes('/P') && u.endsWith('.jpg')) {
        if (!images.includes(u)) images.push(u);
      }
    });
    try {
      await page.goto(listing.url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);
    } catch(e) {}
    console.log(JSON.stringify({ id: listing.id, images: images.slice(0, 8) }));
    await ctx.close();
  }
  await browser.close();
})();
