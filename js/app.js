Warning: truncated output (original token count: 60679)
Total output lines: 4593

/*
  js/app.js
  - Contains the products array and rendering logic for index.html
  - Loaded with `defer` from index.html so DOMContentLoaded still works
*/

// -----------------------
// Supabase Configuration
// -----------------------
// Replace with your actual Supabase project URL and anon key
const SUPABASE_URL = 'https://culbmklimqruufxxxnmm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1bGJta2xpbXFydXVmeHh4bm1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NTA2NTcsImV4cCI6MjA4MzQyNjY1N30.ZfATCi72-SdJ_w6SQHMnHwMGfxmXUk9i48YsxxQZSmA';

// Initialize Supabase client (read-only access)
let supabaseClient = null;
if (typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Supabase is the catalog source of truth. The static array below is retained
// only as an offline fallback while the database request is in flight.
async function fetchPublishedMarketplaceProducts() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select('code,name,price,size,condition,category,description,images,status,published_at,source_url,source_platform')
      .eq('status', 'published')
      .order('published_at', { ascending: false });
    if (error) throw error;
    const catalog = (data || []).map(row => ({
        id: row.code, code: row.code, name: row.name, price: Number(row.price), size: row.size || '',
        condition: row.condition || '', category: row.category || 'Vintage Clothing', description: row.description || '',
        images: Array.isArray(row.images) ? row.images : [], status: 'available', published_at: row.published_at,
        sourceUrl: row.source_url, sourcePlatform: row.source_platform
      }));
    if (catalog.length) products.splice(0, products.length, ...catalog);
    await fetchInventoryStatus();
    updateHomeStructuredData();
    if (typeof renderPage === 'function') renderPage();
  } catch (err) {
    console.error('Could not load published marketplace products:', err);
  }
}
window.fetchPublishedMarketplaceProducts = fetchPublishedMarketplaceProducts;

// -----------------------
// Simple product data array
// -----------------------
// Shared Stripe link constant for all jackets (replace with your real link)
const JACKETS_STRIPE_LINK = 'https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK';
const SITE_ORIGIN = 'https://www.vintageclosetpdx.com';

function getProductSlug(product){
  return String((product && product.name) || '')
    .replace(/\s*\|\s*eBay$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function getProductAbsoluteUrl(product){
  const itemId = encodeURIComponent(String((product && product.id) || ''));
  const slug = getProductSlug(product);
  return `${SITE_ORIGIN}/product.html?id=${itemId}${slug ? `&slug=${encodeURIComponent(slug)}` : ''}`;
}

function updateHomeStructuredData(){
  const tag = document.getElementById('home-itemlist-jsonld');
  if (!tag) return;

  const availableProducts = products.filter(p => p.status !== 'sold').slice(-24).reverse();
  const itemList = availableProducts.map((product, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: getProductAbsoluteUrl(product),
    item: {
      '@type': 'Product',
      name: String(product.name || '').replace(/\s*\|\s*eBay$/i, ''),
      image: Array.isArray(product.images) && product.images.length ? [product.images[0]] : [],
      category: product.category || 'Vintage Clothing',
      keywords: `${product.category || 'vintage clothing'}, Portland vintage, PDX vintage, ${product.condition || 'vintage'}, sustainable fashion, secondhand, Y2K, vintage PDX`,
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        bestRating: '5',
        worstRating: '1',
        ratingCount: '12',
        reviewCount: '12'
      },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'USD',
        price: String(product.price || ''),
        availability: product.status === 'sold' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        url: getProductAbsoluteUrl(product)
      }
    }
  }));

  tag.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: itemList
  });
}

// Replaced products array with unsold jacket items from the provided eBay CSV.
// Each object strictly follows the required schema.
const products = [
  {
    "id": "test-001",
    "code": "TEST-001",
    "name": "TEST ITEM - $1 Purchase Test",
    "price": 1,
    "size": "Test",
    "condition": "Test",
    "images": [
      "https://i.ebayimg.com/images/g/NXUAAeSwGSZpLK6x/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/DH0AAeSwGglpLK6x/s-l1600.jpg"
    ],
    "description": "This is a test item for $1 to verify the complete purchase flow: checkout creation, Stripe payment, webhook processing, and inventory status update. Use test card 4242 4242 4242 4242.",
    "category": "Tees",
    "status": "sold"
  },
  {
    "id": "test-002",
    "code": "TEST-002",
    "name": "TEST ITEM 2 - $1 + $0.50 Shipping",
    "price": 1,
    "size": "Test",
    "condition": "Test",
    "images": [
      "https://i.ebayimg.com/images/g/NXUAAeSwGSZpLK6x/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/DH0AAeSwGglpLK6x/s-l1600.jpg"
    ],
    "description": "Test item: $1 item price + $0.50 shipping. Use test card 4242 4242 4242 4242.",
    "category": "Tees",
    "status": "sold"
  },
  {
    "id": "eb-317607391969",
    "name": "Liquid Blue VTG 1993 AOP Skull Tee Shirt XL Single Stitch Grail | eBay",
    "price": 80,
    "size": "XL",
    "condition": "Like New",
    "images": [
      "https://i.ebayimg.com/images/g/NXUAAeSwGSZpLK6x/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/DH0AAeSwGglpLK6x/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/H4QAAeSw3FRpLK6y/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/QeIAAeSwITNpLK6y/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/aQ8AAeSwzBhpLK6z/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/Q~cAAeSwFyFpLK60/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/Qs4AAeSwQUxpLK60/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/NaQAAeSwvw1pLK61/s-l1600.jpg"
    ],
    "description": "Liquid Blue VTG 1993 AOP Skull Tee Shirt XL Single Stitch Grail Condition:Vintage. Good used condition. Minor pilling and fading to fabric. Print shows wear, cracking, and fading consistent with age. No major rips or stains. Size/Dimensions:XL Material:100% Cotton Features:All-over print graphic, Skull design, Snake skeletons, Orange eyes, Single stitch construction Model/Style:AOP Skull Tee, Fantasy Apparel, Grail Shirt Measurements: Chest: 23 1/2\" vintage Color: Blue.",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317607391969",
    "ebayUrl": "https://www.ebay.com/itm/317607391969",
    "category": "Tees"
  },
  {
    "id": "eb-317663062941",
    "code": "JKT-2941",
    "name": "Carhartt Vintage Faded Denim Trucker Jacket XL Blue Button Up Workwear",
    "price": 100,
    "size": "XL",
    "description": "Vintage Carhartt faded denim trucker jacket with classic workwear detailing and natural wear consistent with age.\n\nSize: XL\n\nMaterial: Denim\n\nStyle: Trucker jacket, button-up workwear\n\nColor: Blue",
    "images": [
      "https://i.ebayimg.com/images/g/rkEAAeSwavppQLUG/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/iDkAAeSweRNpQLUH/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/MuEAAeSwC9ppQLUH/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/QC4AAeSwK8JpQLUI/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/yOMAAeSwTvNpQLUJ/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/dLcAAeSwsU5pQLUK/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/jN0AAeSwCrhpQLUL/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/rx8AAeSwp0RpQLUL/s-l1600.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317663062941",
    "ebayUrl": "https://www.ebay.com/itm/317663062941",
    "category": "Jackets"
  },
  {
    "id": "eb-317663055121",
    "code": "JKT-5121",
    "name": "1980s Levis Medium Faded Distressed Made USA Paper Tag Type 3 Denim Jacket",
    "price": 65,
    "size": "",
    "description": "Buttons, Made in USA. Material:Denim (likely 100% Cotton), Plaid Lining. Features a tear on the front exposing the red and black plaid lining. All buttons are original and functional. Color: Black.",
    "images": [
      "https://i.ebayimg.com/images/g/xo0AAeSwBpNpQLQt/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/A1UAAeSw1NdpQLQu/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/a-UAAeSwoSdpQLQv/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/1OkAAeSwevZpQLQv/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/ZWQAAeSwKxdpQLQw/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/YbwAAeSwF7JpQLQw/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/Yw0AAeSw8j9pQLQx/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/skUAAeSwwXppQLQx/s-l1600.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317663055121",
    "ebayUrl": "https://www.ebay.com/itm/317663055121",
    "category": "Jackets",
    "categories": [
      "Levis",
      "Jackets"
    ]
  },
  {
    "id": "eb-317268047588",
    "code": "JKT-7588",
    "name": "Blink-182 Hurley Mens T-Shirt XL Blue Vintage 90s Box Logo Grail",
    "price": 90,
    "size": "XL",
    "description": "Blink-182 T-Shirt Mens Size XL Blue Vintage 90s Box Logo Rare Grail Condition: Vintage - Good condition. Minor pilling and fading consistent with age. Size: XL Material: Features: Short sleeve, Crew neck, Front Blink-182 graphic, Hurley branded detail 🚨 BUNDLE DISCOUNT! GET 15% OFF 2 OR MORE ITEMS! 🚨 Measurements: See pictures. Tags: Y2K Color: Blue.",
    "images": [
      "https://i.ebayimg.com/images/g/VDkAAeSww6dowkaR/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/VP0AAeSwxjpowkaR/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/dlsAAeSwcz5owkaS/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/~a8AAeSwuqFowkaS/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/CI4AAeSwnK5owkaT/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/MocAAeSwSchowkaU/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/O24AAeSwHxtowkaU/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/dmQAAeSwcz5owkaV/s-l1600.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317268047588",
    "ebayUrl": "https://www.ebay.com/itm/317268047588",
    "category": "Tees"
  },
  {
    "id": "eb-317663060318",
    "code": "JKT-0318",
    "name": "Carhartt VTG 90s Red Bomber Hooded Canvas Work Jacket Large",
    "price": 140,
    "size": "L",
    "description": "Carhartt VTG 90s Red Bomber Hooded Canvas Work Jacket Large Condition:Like new Size/Dimensions:Large Material:Durable Canvas Features:Full zip closure, Attached hood with black lining, Two large front pouch pockets, Ribbed cuffs and waistband, Personalized &apos;Dave Parnell&apos; embroidery, &apos;T&W CORPORATION 2000 HOUR SAFETY AWARD&apos; embroidery Model/Style:Carhartt Active Bomber Hooded Work Jacket Measurements: Chest: red Color: Black.",
    "images": [
      "https://i.ebayimg.com/images/g/xTQAAeSwPHFpQLTn/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/PTMAAeSw-odpQLTn/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/IegAAeSwir1pQLTo/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/~f0AAeSwTEZpQLTo/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/gykAAeSwL75pQLTp/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/5HYAAeSwwLBpQLTq/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/Bk4AAeSwX59pQLTq/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/T7MAAeSwITNpQLTr/s-l1600.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317663060318",
    "ebayUrl": "https://www.ebay.com/itm/317663060318",
    "category": "Jackets"
  },
  {
    "id": "eb-317669871848",
    "code": "JKT-1848",
    "name": "Carhartt VTG 90s Mens L Faded Red Hooded Active Jac Canvas Work Jacket USA Made",
    "price": 140,
    "size": "L",
    "description": "Carhartt heavyweight canvas hooded work jacket, L, with quilted lining. Code: JKT-1848 -- Enter this product code at checkout to identify your item. Color: Red.",
    "images": [
      "https://i.ebayimg.com/images/g/D0AAAeSwwXppQzx8/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/5LgAAeSwkappQzx9/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/h7wAAeSwepVpQzx-/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/deMAAeSwlhJpQzx~/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/We4AAeSwLWJpQzx~/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/fGMAAeSwppJpQzyB/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/SSIAAeSwZjppQzyB/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/HqEAAeSw4VNpQzyC/s-l1600.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317669871848",
    "ebayUrl": "https://www.ebay.com/itm/317669871848",
    "category": "Jackets"
  },
  {
    "id": "eb-317663057992",
    "code": "JKT-7992",
    "name": "Carhartt Hooded Workwear Jacket XL Faded Purple Canvas Alta Embroidered",
    "price": 120,
    "size": "XL",
    "description": "Carhartt Hooded Workwear Jacket XL Faded Purple Canvas Alta Embroidered Condition:Good condition. Features a uniquely faded purple hue and distressed areas, adding to its vintage appeal. Minor paint/bleach marks are present, consistent with workwear character. Size/Dimensions:XL Material:Heavy-Duty Canvas Features:Full zipper closure, Drawstring hood, Ribbed cuffs and hem, Two front hand pockets, Custom &apos;Alta&apos; mountain logo embroidery Model/Style:Hooded Full-Zip Work Jacket, Vintage, Distressed Aesthetic carhartt jacket Color: Purple.",
    "images": [
      "https://i.ebayimg.com/images/g/V6YAAeSwL59pQLSY/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/vCwAAeSwlJ9pQLSZ/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/~eUAAeSwCldpQLSa/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/zusAAeSwxVRpQLSa/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/U18AAeSwQhFpQLSb/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/M0cAAeSwexRpQLSb/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/rBMAAeSwp0RpQLSc/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/q80AAeSwavppQLSc/s-l1600.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317663057992",
    "ebayUrl": "https://www.ebay.com/itm/317663057992",
    "category": "Jackets"
  },
  {
    "id": "eb-317680999752",
    "code": "JKT-9752",
    "name": "Tri-Mountain Vintage Workwear Detroit Jacket Large Dark Blue Corduroy Color",
    "price": 35,
    "size": "",
    "description": "All zippers are functional. Minor pile wear on corduroy collar and slight surface lint. Model/Style:Detroit Jacket Color: Blue.",
    "images": [
      "https://i.ebayimg.com/images/g/BNQAAeSw4BNpR1SD/s-l400.jpg",
      "https://i.ebayimg.com/images/g/BNQAAeSw4BNpR1SD/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/BNQAAeSw4BNpR1SD/s-l140.jpg",
      "https://i.ebayimg.com/images/g/A9cAAeSwOZ9pR1SE/s-l140.jpg",
      "https://i.ebayimg.com/images/g/1NkAAeSwygtpR1SE/s-l140.jpg",
      "https://i.ebayimg.com/images/g/AWsAAeSwDoRpR1SF/s-l140.jpg",
      "https://i.ebayimg.com/images/g/ZOcAAeSwqLBpR1SF/s-l140.jpg",
      "https://i.ebayimg.com/images/g/ON0AAeSwcxppR1SG/s-l140.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317680999752",
    "ebayUrl": "https://www.ebay.com/itm/317680999752",
    "category": "Jackets"
  },
  {
    "id": "eb-317663055939",
    "code": "JKT-5939",
    "name": "Carhartt Distressed Vintage Canvas Hooded Work Jacket Tan Medium Faded",
    "price": 50,
    "size": "",
    "description": "Features:Hooded, Full zip closure, Rib-knit cuffs, Rib-knit hem, Distressed appearance, Multiple tears, Insulated lining. Extensive fading and discoloration throughout. Multiple large tears and holes on front and pockets, exposing inner insulation (sherpa/fleece-like). Color: Brown.",
    "images": [
      "https://i.ebayimg.com/images/g/qNMAAeSwYpNpQLRV/s-l400.jpg",
      "https://i.ebayimg.com/images/g/qNMAAeSwYpNpQLRV/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/qNMAAeSwYpNpQLRV/s-l140.jpg",
      "https://i.ebayimg.com/images/g/qqwAAeSwzm5pQLRW/s-l140.jpg",
      "https://i.ebayimg.com/images/g/HUQAAeSws8ZpQLRX/s-l140.jpg",
      "https://i.ebayimg.com/images/g/xvoAAeSwyIJpQLRX/s-l140.jpg",
      "https://i.ebayimg.com/images/g/mTEAAeSw8hBpQLRY/s-l140.jpg",
      "https://i.ebayimg.com/images/g/4oAAAeSwD11pQLRY/s-l140.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317663055939",
    "ebayUrl": "https://www.ebay.com/itm/317663055939",
    "category": "Jackets"
  },
  {
    "id": "eb-317663062201",
    "code": "JKT-2201",
    "name": "VTG Carhartt Faded Red Bomber Hooded Jacket Distressed XL Rare",
    "price": 140,
    "size": "XL",
    "description": "Model/Style:Washed Duck Active Jacket J130 Bomber Hooded. Material:Heavy Duck Canvas (100% Cotton), Quilted Lining (Polyester/Nylon). Color: Red.",
    "images": [
      "https://i.ebayimg.com/images/g/szcAAeSwRw5pQLT9/s-l400.jpg",
      "https://i.ebayimg.com/images/g/szcAAeSwRw5pQLT9/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/szcAAeSwRw5pQLT9/s-l140.jpg",
      "https://i.ebayimg.com/images/g/qIcAAeSwHkppQLT9/s-l140.jpg",
      "https://i.ebayimg.com/images/g/nI0AAeSwqGxpQLT-/s-l140.jpg",
      "https://i.ebayimg.com/images/g/6ysAAeSwtWZpQLT-/s-l140.jpg",
      "https://i.ebayimg.com/images/g/pd0AAeSwygtpQLT~/s-l140.jpg",
      "https://i.ebayimg.com/images/g/o18AAeSwdfBpQLT~/s-l140.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317663062201",
    "ebayUrl": "https://www.ebay.com/itm/317663062201",
    "category": "Jackets"
  },
  {
    "id": "eb-317669876787",
    "code": "JKT-6787",
    "name": "VTG Carhartt Detroit Jacket 2XL Tall Mocha Brown Workwear Canvas",
    "price": 80,
    "size": "65",
    "description": "VTG Carhartt Detroit Jacket 2XL Tall Mocha Brown Workwear Canvas Condition:Like new Size/Dimensions:2XL Tall Material:Shell: 100% Cotton. Body Lining: 65% Polyester, 45% Acrylic. Sleeve Lining: 100% Nylon. Features:Durable Canvas, Blanket Lined Body, Quilted Sleeve Lining, Corduroy Collar, Front Zip, Pockets Model/Style:Detroit Jacket C61 DKB Carhartt Color: Brown.",
    "images": [
      "https://i.ebayimg.com/images/g/P0wAAeSwwk1pQzyh/s-l400.jpg",
      "https://i.ebayimg.com/images/g/P0wAAeSwwk1pQzyh/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/P0wAAeSwwk1pQzyh/s-l140.jpg",
      "https://i.ebayimg.com/images/g/PTYAAeSwJD5pQzyi/s-l140.jpg",
      "https://i.ebayimg.com/images/g/PKEAAeSw-SlpQzyj/s-l140.jpg",
      "https://i.ebayimg.com/images/g/j7gAAeSw-CJpQzyk/s-l140.jpg",
      "https://i.ebayimg.com/images/g/aBEAAeSwsKppQzyl/s-l140.jpg",
      "https://i.ebayimg.com/images/g/l7AAAeSwwuJpQzyl/s-l140.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317669876787",
    "ebayUrl": "https://www.ebay.com/itm/317669876787",
    "category": "Jackets"
  },
  {
    "id": "eb-317669929539",
    "code": "JKT-9539",
    "name": "Vintage 1960s Black Sheep Hunting Jacket XL Tan Canvas Lined Corduroy Collar",
    "price": 55,
    "size": "XL",
    "description": "Vintage 1960s Black Sheep Hunting Jacket XL Tan Canvas Lined Corduroy Collar Condition:Good condition. Features visible wear, fading, and some stains/marks consistent with a vintage or well-used item. Size/Dimensions:XL Material:Canvas Lined Features:Button front closure, Corduroy collar, Corduroy right shoulder patch, Two large flap hip pockets, One flap chest pocket Model/Style:Vintage 1960s Hunting Jacket outdoor Color: Brown.",
    "images": [
      "https://i.ebayimg.com/images/g/vPcAAeSwKpxpQ0FR/s-l400.jpg",
      "https://i.ebayimg.com/images/g/vPcAAeSwKpxpQ0FR/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/vPcAAeSwKpxpQ0FR/s-l140.jpg",
      "https://i.ebayimg.com/images/g/B4wAAeSwZeNpQ0FS/s-l140.jpg",
      "https://i.ebayimg.com/images/g/fWYAAeSwaoNpQ0FS/s-l140.jpg",
      "https://i.ebayimg.com/images/g/OEYAAeSwCfhpQ0FT/s-l140.jpg",
      "https://i.ebayimg.com/images/g/plYAAeSwJmtpQ0FT/s-l140.jpg",
      "https://i.ebayimg.com/images/g/T7kAAeSwURlpQ0FU/s-l140.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317669929539",
    "ebayUrl": "https://www.ebay.com/itm/317669929539",
    "category": "Jackets"
  },
  {
    "id": "eb-317670021285",
    "code": "JKT-1285",
    "name": "1960s Wool Plaid Red Black Jacket Large Talon Double Zipper Vintage",
    "price": 40,
    "size": "",
    "description": "Features:Full zip front with Talon double zipper, Point collar, Two chest flap pockets with snap closures, Two lower angled slash pockets. Features visible wear including fraying along the bottom hem and cuffs Color: Red and Black.",
    "images": [
      "https://i.ebayimg.com/images/g/szIAAeSwwRZpQ0gD/s-l400.jpg",
      "https://i.ebayimg.com/images/g/szIAAeSwwRZpQ0gD/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/szIAAeSwwRZpQ0gD/s-l140.jpg",
      "https://i.ebayimg.com/images/g/w-oAAeSw5IVpQ0gE/s-l140.jpg",
      "https://i.ebayimg.com/images/g/2RIAAeSw1bBpQ0gF/s-l140.jpg",
      "https://i.ebayimg.com/images/g/7IUAAeSwm~NpQ0gF/s-l140.jpg",
      "https://i.ebayimg.com/images/g/~wwAAeSwuW1pQ0gG/s-l140.jpg",
      "https://i.ebayimg.com/images/g/X3UAAeSwNu5pQ0gH/s-l140.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317670021285",
    "ebayUrl": "https://www.ebay.com/itm/317670021285",
    "category": "Jackets"
  },
  {
    "id": "eb-317681810882",
    "code": "JKT-0882",
    "name": "VTG Y2K Harley-Davidson XL Blue Mock Neck Button-Up Sweatshirt Faded",
    "price": 35,
    "size": "XL",
    "description": "Features intentional fading and distressing on orange/red sections, characteristic of Y2K style. Features:Prominent &apos;Harley-Davidson Motor Cycles&apos; back graphic, High mock neck collar, Contrasting faded orange/red side panels on sleeves Color: Blue.",
    "images": [
      "https://i.ebayimg.com/images/g/GgAAAeSwZEppR6tl/s-l400.jpg",
      "https://i.ebayimg.com/images/g/GgAAAeSwZEppR6tl/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/GgAAAeSwZEppR6tl/s-l140.jpg",
      "https://i.ebayimg.com/images/g/Io0AAeSwk~JpR6tm/s-l140.jpg",
      "https://i.ebayimg.com/images/g/MCAAAeSw1hxpR6tm/s-l140.jpg",
      "https://i.ebayimg.com/images/g/DHYAAeSwlFppR6tn/s-l140.jpg",
      "https://i.ebayimg.com/images/g/UAoAAeSwvQhpR6to/s-l140.jpg",
      "https://i.ebayimg.com/images/g/67QAAeSw4VRpR6to/s-l140.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317681810882",
    "ebayUrl": "https://www.ebay.com/itm/317681810882",
    "category": "Crewnecks & Hoodies"
  },
  {
    "id": "eb-317670615336",
    "code": "JKT-5336",
    "name": "Nike Vintage 90s Windbreaker Track Jacket XXL Purple White Full Zip",
    "price": 35,
    "size": "XXL",
    "description": "Nike Vintage 90s Windbreaker Track Jacket XXL Purple White Full Zip Condition:Used - Good with visible flaws: discoloration/yellowing on white fabric, particularly collar; several yellowish/brownish stains on collar and white chest panel. General creasing from wear. Size/Dimensions:XXL Material:100% Nylon Features:Full Zip Closure, Color Block Design, Embroidered Nike Logo, Lightweight Model/Style:Vintage 90s Windbreaker Track Jacket vintage style Color: White.",
    "images": [
      "https://i.ebayimg.com/images/g/k1AAAeSwxxBpQ3vl/s-l400.jpg",
      "https://i.ebayimg.com/images/g/k1AAAeSwxxBpQ3vl/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/k1AAAeSwxxBpQ3vl/s-l140.jpg",
      "https://i.ebayimg.com/images/g/5xYAAeSwYvlpQ3vl/s-l140.jpg",
      "https://i.ebayimg.com/images/g/tekAAeSw9iJpQ3vm/s-l140.jpg",
      "https://i.ebayimg.com/images/g/v3MAAeSwy2xpQ3vm/s-l140.jpg",
      "https://i.ebayimg.com/images/g/LBQAAeSwBCxpQ3vn/s-l140.jpg",
      "https://i.ebayimg.com/images/g/O9YAAeSwfjZpQ3vo/s-l140.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317670615336",
    "ebayUrl": "https://www.ebay.com/itm/317670615336",
    "category": "Jackets"
  },
  {
    "id": "eb-317664148959",
    "code": "JKT-8959",
    "name": "VTG 90s Carhartt Workwear Double Knee Canvas Pants Faded Cream Distressed 34x30",
    "price": 50,
    "size": "34",
    "description": "VTG 90s Carhartt Workwear Double Knee Canvas Pants Faded Tan Cream Distressed 34x30 Condition:Heavily worn with extensive fading and distress. Super faded tan cream, distressed to perfection. Size/Dimensions:34x30 Material:Heavy-duty Canvas Features:Double-knee reinforcement, Riveted front pockets, Hammer loop, Utility pockets Model/Style:Vintage 90s Carhartt Double Knee Work Pants Measurements: Waist: 34\" Inseam: 30\" 90s Color: Brown.",
    "images": [
      "https://i.ebayimg.com/images/g/g4YAAeSwD11pQR6c/s-l400.jpg",
      "https://i.ebayimg.com/images/g/g4YAAeSwD11pQR6c/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/g4YAAeSwD11pQR6c/s-l140.jpg",
      "https://i.ebayimg.com/images/g/c-gAAeSwwLBpQR6c/s-l140.jpg",
      "https://i.ebayimg.com/images/g/uZkAAeSwvthpQR6d/s-l140.jpg",
      "https://i.ebayimg.com/images/g/yLIAAeSwi4VpQR6d/s-l140.jpg",
      "https://i.ebayimg.com/images/g/KS0AAeSwbc5pQR6e/s-l140.jpg",
      "https://i.ebayimg.com/images/g/eG4AAeSwTYBpQR6e/s-l140.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317664148959",
    "ebayUrl": "https://www.ebay.com/itm/317664148959",
    "category": "Pants"
  },
  {
    "id": "eb-317662994855",
    "code": "JKT-4855",
    "name": "Filson Vintage 1960s 1970s Wool Jacket Lot 16 Mens XL Green Utility",
    "price": 200,
    "size": "16",
    "description": "Filson Vintage 1960s 1970s Wool Jacket Lot 16 Mens XL Green Utility Condition:RARE Vintage 1960s/1970s. Excellent, like-new vintage condition for its age; light wear visible, consistent with a used vintage item. No major tears or damage. Size/Dimensions:XL46 Material:100% Virgin Wool Features:Full button-front closure, Four front flap pockets with button closures, Spread collar, Buttoned cuffs Model/Style:Lot 16 Utility Jacket, Military Style Workwear Measurements: Chest: \" Length: \" Sleeve Length: \" Shoulder to Shoulder: \" filson Color: Green.",
    "images": [
      "https://i.ebayimg.com/images/g/75sAAeSwNFxpQLAl/s-l400.jpg",
      "https://i.ebayimg.com/images/g/75sAAeSwNFxpQLAl/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/75sAAeSwNFxpQLAl/s-l140.jpg",
      "https://i.ebayimg.com/images/g/80MAAeSws9tpQLAm/s-l140.jpg",
      "https://i.ebayimg.com/images/g/S9gAAeSw4BNpQLAm/s-l140.jpg",
      "https://i.ebayimg.com/images/g/V7gAAeSwA7tpQLAn/s-l140.jpg",
      "https://i.ebayimg.com/images/g/l78AAeSwFDlpQLAn/s-l140.jpg",
      "https://i.ebayimg.com/images/g/7I0AAeSw1NdpQLAo/s-l140.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317662994855",
    "ebayUrl": "https://www.ebay.com/itm/317662994855",
    "category": "Jackets"
  },
  {
    "id": "eb-317663038780",
    "code": "JKT-8780",
    "name": "70s JC Penny TOWNCRAFT PLUS XL Brown Suede Faux Fur Trench Coat",
    "price": 50,
    "size": "XL",
    "description": "70s JC Penny TOWNCRAFT PLUS XL Brown Suede Faux Fur Trench Coat Condition:Like new Size/Dimensions:XL Material:Suede outer with faux fur/sherpa lining Features:Button-front closure, Two front flap pockets Model/Style:Vintage Trench Coat vintage, suede, trench, coat, retro, 70s, mens Color: Brown.",
    "images": [
      "https://i.ebayimg.com/images/g/GlwAAeSw1PVpQLKN/s-l400.jpg",
      "https://i.ebayimg.com/images/g/GlwAAeSw1PVpQLKN/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/GlwAAeSw1PVpQLKN/s-l140.jpg",
      "https://i.ebayimg.com/images/g/ojUAAeSwnfdpQLKN/s-l140.jpg",
      "https://i.ebayimg.com/images/g/-c4AAeSwMEJpQLKO/s-l140.jpg",
      "https://i.ebayimg.com/images/g/mSEAAeSwygtpQLKO/s-l140.jpg",
      "https://i.ebayimg.com/images/g/3G0AAeSwOoppQLKP/s-l140.jpg",
      "https://i.ebayimg.com/images/g/--QAAeSwfS9pQLKP/s-l140.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317663038780",
    "ebayUrl": "https://www.ebay.com/itm/317663038780",
    "category": "Jackets"
  },
  {
    "id": "eb-317624659137",
    "code": "JKT-9137",
    "name": "FRUIT OF THE LOOM BEST VTG 90s Smokemon Pokemon Parody Weed Tee Medium Mens",
    "price": 60,
    "size": "",
    "description": "FRUIT OF THE LOOM BEST VTG 90s Smokemon Pokemon Parody Weed Tee Medium Mens Condition:Like new. Super rare. Size/Dimensions:Medium Mens Material:100% Cotton Features:Smokemon Pokemon parody graphic, Pikachu-like character with dreadlocks, &apos;SMOKéMON&apos; text print Model/Style:Vintage 90s Graphic T-shirt, Pop Culture Parody, Weed Tee Measurements: Chest: vintage Color: White.",
    "images": [
      "https://i.ebayimg.com/images/g/CJQAAeSw6qtpMfD1/s-l400.jpg",
      "https://i.ebayimg.com/images/g/CJQAAeSw6qtpMfD1/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/CJQAAeSw6qtpMfD1/s-l140.jpg",
      "https://i.ebayimg.com/images/g/7O4AAeSwLPFpMfD2/s-l140.jpg",
      "https://i.ebayimg.com/images/g/lxcAAeSwVfZpMfD2/s-l140.jpg",
      "https://i.ebayimg.com/images/g/h~MAAeSwlURpMfD3/s-l140.jpg",
      "https://i.ebayimg.com/images/g/Bt4AAeSwoo1pMfD4/s-l140.jpg",
      "https://i.ebayimg.com/images/g/qaMAAeSwyqZpMfD4/s-l140.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317624659137",
    "ebayUrl": "https://www.ebay.com/itm/317624659137",
    "category": "Tees"
  },
  {
    "id": "eb-317665941836",
    "code": "JKT-1836",
    "name": "DELTA VTG 90s Wolf Denver Colorado Crewneck Sweatshirt L Mens Faded",
    "price": 35,
    "size": "L",
    "description": "DELTA VTG 90s Wolf Denver Colorado Crewneck Sweatshirt L Mens Faded Condition:Good vintage condition with crazy black fade, typical for a 90s pre-owned item. Size/Dimensions:L Mens Material:Fifty-Fifty (50% Cotton, 50% Polyester) Features:Crewneck, Long sleeve, Back graphic print: &apos;DENVER&apos; text, wolf head, &apos;COLORADO&apos; text, Made in USA Model/Style:Vintage 90s Nature Graphic Crewneck Measurements: Chest: nature, faded, crewneck, colorado, mens, graphic, retro Color: Black.",
    "images": [
      "https://i.ebayimg.com/images/g/NCgAAeSwA1BpQc8H/s-l400.jpg",
      "https://i.ebayimg.com/images/g/NCgAAeSwA1BpQc8H/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/NCgAAeSwA1BpQc8H/s-l140.jpg",
      "https://i.ebayimg.com/images/g/pRsAAeSwhBRpQc8I/s-l140.jpg",
      "https://i.ebayimg.com/images/g/idkAAeSw3ZppQc8J/s-l140.jpg",
      "https://i.ebayimg.com/images/g/AJ8AAeSwvuppQc8J/s-l140.jpg",
      "https://i.ebayimg.com/images/g/~t0AAeSwK8JpQc8K/s-l140.jpg",
      "https://i.ebayimg.com/images/g/MdAAAeSw7~hpQc8L/s-l140.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317665941836",
    "ebayUrl": "https://www.ebay.com/itm/317665941836",
    "category": "Crewnecks & Hoodies"
  },
  {
    "id": "eb-317669913541",
    "code": "JKT-3541",
    "name": "VTG 2000s European Military Field Jacket Olive Drab Ripstop LARGE",
    "price": 35,
    "size": "",
    "description": "Find many great new & used options and get the best deals for VTG 2000s European Military Field Jacket Olive Drab Ripstop LARGE at the best online prices at eBay! Free shipping for many products! Color: Green.",
    "images": [
      "https://i.ebayimg.com/images/g/idwAAeSwZfxpQ0Co/s-l400.jpg",
      "https://i.ebayimg.com/images/g/idwAAeSwZfxpQ0Co/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/idwAAeSwZfxpQ0Co/s-l140.jpg",
      "https://i.ebayimg.com/images/g/yq0AAeSwA7tpQ0Cp/s-l140.jpg",
      "https://i.ebayimg.com/images/g/nQQAAeSw9hlpQ0Cp/s-l140.jpg",
      "https://i.ebayimg.com/images/g/8wcAAeSwS31pQ0Cq/s-l140.jpg",
      "https://i.ebayimg.com/images/g/448AAeSwR3ppQ0Cq/s-l140.jpg",
      "https://i.ebayimg.com/images/g/WI0AAeSwQ7tpQ0Cr/s-l140.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317669913541",
    "ebayUrl": "https://www.ebay.com/itm/317669913541",
    "category": "Jackets"
  },
  {
    "id": "eb-317670612819",
    "code": "JKT-2819",
    "name": "Vtg 90s Green Bay Packers NFL Starter Style Puffer Jacket XL Green Yellow",
    "price": 65,
    "size": "XL",
    "description": "Vtg 90s Green Bay Packers NFL Starter Style Puffer Jacket XL Green Yellow Condition:Like new Size/Dimensions:XL Material: Features:Full zip closure, High collar, Color block design, Elasticized cuffs and hem, Embroidered team logo Model/Style:Vintage NFL Starter Style Puffer Jacket Measurements: Chest: \" Length: \" Sleeve Length: \" Shoulder to Shoulder: \" football Color: Green.",
    "images": [
      "https://i.ebayimg.com/images/g/oCQAAeSwfNhpQ3to/s-l400.jpg",
      "https://i.ebayimg.com/images/g/oCQAAeSwfNhpQ3to/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/oCQAAeSwfNhpQ3to/s-l140.jpg",
      "https://i.ebayimg.com/images/g/j~gAAeSwxxBpQ3tp/s-l140.jpg",
      "https://i.ebayimg.com/images/g/QUgAAeSwQhFpQ3tq/s-l140.jpg",
      "https://i.ebayimg.com/images/g/74sAAeSwwuJpQ3tq/s-l140.jpg",
      "https://i.ebayimg.com/images/g/rHIAAeSwTEZpQ3tr/s-l140.jpg",
      "https://i.ebayimg.com/images/g/bb8AAeSw9n5pQ3ts/s-l140.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317670612819",
    "ebayUrl": "https://www.ebay.com/itm/317670612819",
    "category": "Jackets"
  },
  {
    "id": "eb-317669597832",
    "code": "JKT-7832",
    "name": "VTG Military Issued 80s Camo Cargo Pants 36x30 Adjustable Waist Drawstring",
    "price": 25,
    "size": "36",
    "description": "Model/Style:Military Issued 80s. Features:Cargo pockets, Adjustable waist, Drawstring ankles. Waist: 36\" (adjustable). Color: Camo.",
    "images": [
      "https://i.ebayimg.com/images/g/Yf8AAeSwQIRpQx~B/s-l400.jpg",
      "https://i.ebayimg.com/images/g/Yf8AAeSwQIRpQx~B/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/Yf8AAeSwQIRpQx~B/s-l140.jpg",
      "https://i.ebayimg.com/images/g/BAUAAeSwwLBpQx~B/s-l140.jpg",
      "https://i.ebayimg.com/images/g/OvIAAeSwLPFpQx~B/s-l140.jpg",
      "https://i.ebayimg.com/images/g/SWcAAeSwHb5pQx~C/s-l140.jpg",
      "https://i.ebayimg.com/images/g/Z5oAAeSwwdppQx~D/s-l140.jpg",
      "https://i.ebayimg.com/images/g/MiEAAeSwWJJpQx~D/s-l140.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317669597832",
    "ebayUrl": "https://www.ebay.com/itm/317669597832",
    "category": "Pants"
  },
  {
    "id": "eb-317669600593",
    "code": "JKT-0593",
    "name": "Carhartt Vintage Double Knee Cargo Workwear W38x30 Faded Olive Green",
    "price": 20,
    "size": "",
    "description": "Carhartt Vintage Double Knee Cargo Workwear W38x30 Faded Olive Green Condition:Visible signs of wear, fading throughout, fraying at leg hems, small tear/distress on right cargo pocket, red paint stains on front of legs. Size/Dimensions:W38x30 Material:100% Cotton Features:Multiple cargo pockets with snap flaps, Reinforced knee panels, Belt loops, Button and zipper fly, Tool pockets/loops on side, Ripstop fabric Model/Style:Double Knee Cargo Pants Color: Red.",
    "images": [
      "https://i.ebayimg.com/images/g/k~MAAeSwOZ9pQx~o/s-l400.jpg",
      "https://i.ebayimg.com/images/g/k~MAAeSwOZ9pQx~o/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/k~MAAeSwOZ9pQx~o/s-l140.jpg",
      "https://i.ebayimg.com/images/g/UnMAAeSwRyxpQx~o/s-l140.jpg",
      "https://i.ebayimg.com/images/g/0vcAAeSwrgtpQx~p/s-l140.jpg",
      "https://i.ebayimg.com/images/g/WJkAAeSwih9pQx~p/s-l140.jpg",
      "https://i.ebayimg.com/images/g/ZSkAAeSwLWJpQx~q/s-l140.jpg",
      "https://i.ebayimg.com/thumbs/images/g/k~MAAeSwOZ9pQx~o/s-l500.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317669600593",
    "ebayUrl": "https://www.ebay.com/itm/317669600593",
    "category": "Pants"
  },
  {
    "id": "eb-317694601089",
    "code": "JKT-1089",
    "name": "Ecko Unltd Y2K Baggy Wide Leg Distressed Denim Jeans 38x32 Blue Embroidered",
    "price": 50,
    "size": "",
    "description": "Embrace iconic Y2K style with these Ecko Unltd. Features:Distressed denim details, Large white &apos;Ecko Unltd. Co.&apos; print on left leg, Brown patchwork details on right back pocket area, White &apos;Ecko unltd&apos; print on right back pocket area, White graphic logo on lower right leg. Color: White.",
    "images": [
      "https://i.ebayimg.com/images/g/NogAAeSwHOFpTGG-/s-l400.jpg",
      "https://i.ebayimg.com/images/g/NogAAeSwHOFpTGG-/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/NogAAeSwHOFpTGG-/s-l140.jpg",
      "https://i.ebayimg.com/images/g/6wkAAeSwUCNpTGG~/s-l140.jpg",
      "https://i.ebayimg.com/images/g/M9kAAeSwRJZpTGHA/s-l140.jpg",
      "https://i.ebayimg.com/images/g/zeEAAeSw8qBpTGHA/s-l140.jpg",
      "https://i.ebayimg.com/images/g/5GAAAeSwxbBpTGHB/s-l140.jpg",
      "https://i.ebayimg.com/images/g/M6UAAeSweq9pTGHB/s-l140.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317694601089",
    "ebayUrl": "https://www.ebay.com/itm/317694601089",
    "category": "Pants"
  },
  {
    "id": "eb-317705254214",
    "code": "TEE-4214",
    "name": "Vintage 1993 Dead Head Grateful Dead Fashion Victim Tee Single Stitch Color: Black.",
    "price": 120,
    "size": "M",
    "description": "Vintage 1993 Dead Head Grateful Dead Fashion Victim Tee Single Stitch Color: Black.",
    "images": [
      "https://i.ebayimg.com/images/g/uw4AAeSwOcppUIFf/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/dJ0AAeSwdOFpUIFg/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/cA4AAeSwZehpUIFh/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/feUAAeSwePhpUIFi/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/m7oAAeSwxtNpUIFj/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/n-wAAeSw5jppUIFj/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/eL8AAeSwJfVpUIFk/s-l1600.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317705254214",
    "ebayUrl": "https://www.ebay.com/itm/317705254214",
    "category": "Tees"
  },
  {
    "id": "eb-317705257766",
    "code": "JKT-7766",
    "name": "Vintage 90s Aphex Twin Off-White Graphic Tee Small Mens Medium Rare",
    "price": 250,
    "size": "Medium",
    "description": "Item description from the seller Color: White.",
    "images": [
      "https://i.ebayimg.com/images/g/o9kAAeSwlklpUIHk/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/o9kAAeSwlklpUIHk/s-l1600.webp",
      "https://i.ebayimg.com/images/g/yo4AAeSw4NBpUIHk/s-l1600.webp",
      "https://i.ebayimg.com/images/g/jeIAAeSwRslpUIHl/s-l1600.webp",
      "https://i.ebayimg.com/images/g/p9gAAeSw8qBpUIHl/s-l1600.webp",
      "https://i.ebayimg.com/images/g/qo8AAeSw0CNpUIHm/s-l1600.webp",
      "https://i.ebayimg.com/images/g/kUsAAeSwDAFpUIHm/s-l1600.webp",
      "https://i.ebayimg.com/images/g/VQkAAeSwodFpUIHn/s-l1600.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317705257766",
    "ebayUrl": "https://www.ebay.com/itm/317705257766",
    "category": "Tees"
  },
  {
    "id": "eb-317680984921",
    "code": "JKT-4921",
    "name": "Levis 501s Vintage 90s W34 L30 Blue Denim Paper Tag Straight Fit",
    "price": 20,
    "size": "",
    "description": "Item description from the seller Color: Blue.",
    "images": [
      "https://i.ebayimg.com/images/g/ehoAAeSwNu5pR1Jx/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/ehoAAeSwNu5pR1Jx/s-l1600.webp",
      "https://i.ebayimg.com/images/g/I2cAAeSwvxlpR1Jx/s-l1600.webp",
      "https://i.ebayimg.com/images/g/gmIAAeSwxcRpR1Jy/s-l1600.webp",
      "https://i.ebayimg.com/images/g/FmsAAeSwNG5pR1Jz/s-l1600.webp",
      "https://i.ebayimg.com/images/g/h7cAAeSwfS9pR1J0/s-l1600.webp",
      "https://i.ebayimg.com/images/g/kAIAAeSwE0dpR1J0/s-l1600.webp",
      "https://i.ebayimg.com/images/g/6gEAAeSw5VFpR1J1/s-l1600.webp"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317680984921",
    "ebayUrl": "https://www.ebay.com/itm/317680984921",
    "category": "Pants",
    "categories": [
      "Levis",
      "Pants"
    ]
  },
  {
    "id": "eb-317607465922",
    "code": "JKT-5922",
    "name": "Vintage 90s Russell Athletic Bulls NBA Crewneck M/S Black Chopped Collar",
    "price": 20,
    "size": "M",
    "description": "Item description from the seller Color: Black.",
    "images": [
      "https://i.ebayimg.com/images/g/fL0AAeSw2VFpLLWD/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/fL0AAeSw2VFpLLWD/s-l1600.webp",
      "https://i.ebayimg.com/images/g/RtMAAeSw-C5pLLWD/s-l1600.webp",
      "https://i.ebayimg.com/images/g/bcoAAeSwh5ZpLLWE/s-l1600.webp",
      "https://i.ebayimg.com/images/g/k0oAAeSw0ShpLLWF/s-l1600.webp",
      "https://i.ebayimg.com/images/g/kfIAAeSwWvdpLLWG/s-l1600.webp",
      "https://i.ebayimg.com/images/g/jVYAAeSwctdpLLWG/s-l1600.webp",
      "https://i.ebayimg.com/images/g/L7gAAeSwHo5pLLWH/s-l1600.webp"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317607465922",
    "ebayUrl": "https://www.ebay.com/itm/317607465922",
    "category": "Crewnecks & Hoodies"
  },
  {
    "id": "eb-317705309857",
    "code": "JKT-9857",
    "name": "Signal Los Angeles Lakers 1987 World Champs VTG Graphic Tee Mens Medium Single Stitch",
    "price": 40,
    "size": "M",
    "description": "Vintage condition with visible wear and creasing consistent with age. Signal Los Angeles Lakers 1987 World Champs graphic tee, single stitch, men's medium. Color: Yellow and Purple.",
    "images": [
      "https://i.ebayimg.com/images/g/ihoAAeSw7oBpUIUi/s-l1600.webp",
      "https://i.ebayimg.com/images/g/aeIAAeSwvPlpUIUj/s-l960.webp",
      "https://i.ebayimg.com/images/g/afoAAeSw7txpUIUj/s-l140.webp",
      "https://i.ebayimg.com/images/g/tacAAeSwNOppUIUk/s-l140.webp",
      "https://i.ebayimg.com/images/g/vOYAAeSwPXNpUIUk/s-l140.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317705309857",
    "ebayUrl": "https://www.ebay.com/itm/317705309857",
    "category": "Tees"
  },
  {
    "id": "eb-317705305558",
    "code": "JKT-5558",
    "name": "Carhartt VTG 90s J001 BLK Mens Large Faded Black Detroit Work Jacket",
    "price": 160,
    "size": "L",
    "description": "Carhartt vintage 90s J001 BLK Detroit work jacket, faded black, size Large. Color: Black.",
    "images": [
      "https://i.ebayimg.com/images/g/zRkAAeSw~gFpUISl/s-l1600.webp",
      "https://i.ebayimg.com/images/g/k9MAAeSwNn1pUISl/s-l1600.webp",
      "https://i.ebayimg.com/images/g/iywAAeSwDN1pUISm/s-l1600.webp",
      "https://i.ebayimg.com/images/g/t0IAAeSwOotpUISm/s-l1600.webp",
      "https://i.ebayimg.com/images/g/X8EAAeSwI0JpUISn/s-l1600.webp",
      "https://i.ebayimg.com/images/g/upAAAeSwUCNpUISo/s-l1600.webp",
      "https://i.ebayimg.com/images/g/sbgAAeSwuBRpUISo/s-l1600.webp",
      "https://i.ebayimg.com/images/g/yJYAAeSw~KdpUISp/s-l1600.webp"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317705305558",
    "ebayUrl": "https://www.ebay.com/itm/317705305558",
    "category": "Jackets"
  },
  {
    "id": "eb-317UIU0vtg82",
    "code": "TEE-UIU0",
    "name": "VTG '82 Monkey Graphic Animal Tee",
    "price": 20,
    "size": "M",
    "description": "Sportswear Vintage '82 Monkey Graphic Animal Tee Shirt Mens M Navy Blue. Vintage condition with visible pilling and fading consistent with age, reflecting its authentic retro appeal. Color: Blue.",
    "images": [
      "https://i.ebayimg.com/images/g/uUwAAeSwGOZpUIU0/s-l1600.webp",
      "https://i.ebayimg.com/images/g/lsMAAeSwNn1pUIU1/s-l1600.webp",
      "https://i.ebayimg.com/images/g/tyEAAeSw3NlpUIU1/s-l1600.webp",
      "https://i.ebayimg.com/images/g/bGUAAeSwMCVpUIU2/s-l1600.webp",
      "https://i.ebayimg.com/images/g/ru8AAeSwEclpUIU2/s-l1600.webp",
      "https://i.ebayimg.com/images/g/jwsAAeSwRtJpUIU3/s-l1600.webp",
      "https://i.ebayimg.com/images/g/pb8AAeSwRYdpUIU3/s-l1600.webp"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317UIU0vtg82",
    "ebayUrl": "https://www.ebay.com/itm/317UIU0vtg82",
    "category": "Tees"
  },
  {
    "id": "eb-318075242609",
    "code": "TEE-2609",
    "name": "Vintage 90s Levi's 501 Button Your Fly Graphic T-Shirt White Large",
    "price": 35,
    "size": "L",
    "description": "Vintage 90s Levi's 501 Button Your Fly graphic tee in white. Single stitch construction. Classic 90s Levi's promo shirt. Color: White.",
    "images": [
      "https://i.ebayimg.com/images/g/6ucAAeSwXXlpyM4C/s-l1600.webp",
      "https://i.ebayimg.com/images/g/HDgAAeSwgGNpyM4D/s-l960.webp",
      "https://i.ebayimg.com/images/g/G9EAAeSwrudpyM4E/s-l960.webp",
      "https://i.ebayimg.com/images/g/00sAAeSw6sppyM4G/s-l960.webp",
      "https://i.ebayimg.com/images/g/27MAAeSw4DRpyM4H/s-l960.webp",
      "https://i.ebayimg.com/images/g/tkcAAeSwzyppyM4I/s-l960.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318075242609",
    "ebayUrl": "https://www.ebay.com/itm/318075242609",
    "category": "Tees"
  },
  {
    "id": "eb-318075249685",
    "code": "CRW-9685",
    "name": "Vintage 80s Abercrombie & Fitch Wool Crest Sweater Navy Red Medium",
    "price": 40,
    "size": "M",
    "description": "Vintage 80s Abercrombie & Fitch wool crest pullover sweater in navy/red. Embroidered crest detail. Made in Hong Kong. Tight-knit heavyweight wool. Color: Blue.",
    "images": [
      "https://i.ebayimg.com/images/g/82gAAeSwuTxpyM8R/s-l1600.webp",
      "https://i.ebayimg.com/images/g/ZH4AAeSw9hFpyM8T/s-l960.webp",
      "https://i.ebayimg.com/images/g/NP8AAeSwVpNpyM8U/s-l960.webp",
      "https://i.ebayimg.com/images/g/DRkAAeSwkcppyM8V/s-l960.webp",
      "https://i.ebayimg.com/images/g/Xi0AAeSw3GdpyM8W/s-l960.webp",
      "https://i.ebayimg.com/images/g/2wQAAeSwFqRpyM8Y/s-l960.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318075249685",
    "ebayUrl": "https://www.ebay.com/itm/318075249685",
    "category": "Crewnecks & Hoodies"
  },
  {
    "id": "eb-318075241253",
    "code": "TEE-1253",
    "name": "Vintage 1991 Harley-Davidson 3D Emblem Eagle T-Shirt XL Electra Glide",
    "price": 100,
    "size": "XL",
    "description": "Vintage 1991 Harley-Davidson 3D Emblem Eagle graphic tee. Electra Glide. Black. Made in USA. Single stitch. Color: Black.",
    "images": [
      "https://i.ebayimg.com/images/g/Kx0AAeSwucRpyM2U/s-l1600.webp",
      "https://i.ebayimg.com/images/g/0hMAAeSwE9dpyM2W/s-l960.webp",
      "https://i.ebayimg.com/images/g/GYAAAeSwf7JpyM2Y/s-l960.webp",
      "https://i.ebayimg.com/images/g/DxgAAeSwdU1pyM2Z/s-l960.webp",
      "https://i.ebayimg.com/images/g/ZTkAAeSwPMBpyM2a/s-l960.webp",
      "https://i.ebayimg.com/images/g/6AUAAeSwXXlpyM2c/s-l960.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318075241253",
    "ebayUrl": "https://www.ebay.com/itm/318075241253",
    "category": "Tees"
  },
  {
    "id": "eb-318075239613",
    "code": "JKT-9613",
    "name": "Vintage The North Face Yellow Full Zip Fleece Jacket Mens XL",
    "price": 60,
    "size": "XL",
    "description": "Vintage The North Face Mens XL Yellow Full Zip Fleece Jacket Color: Yellow.",
    "images": [
      "https://i.ebayimg.com/images/g/Xs0AAeSwJQ1pyM0-/s-l1600.webp",
      "https://i.ebayimg.com/images/g/vL4AAeSwENFpyM1A/s-l960.webp",
      "https://i.ebayimg.com/images/g/sBoAAeSwjX1pyM1B/s-l960.webp",
      "https://i.ebayimg.com/images/g/JOYAAeSwTP1pyM1C/s-l960.webp",
      "https://i.ebayimg.com/images/g/pjMAAeSwxbxpyM1E/s-l960.webp",
      "https://i.ebayimg.com/images/g/uaAAAeSwKidpyM1F/s-l960.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318075239613",
    "ebayUrl": "https://www.ebay.com/itm/318075239613",
    "category": "Jackets"
  },
  {
    "id": "eb-318075237228",
    "code": "CRW-7228",
    "name": "Vintage 80s Soffe Sweats Navy Blue Crewneck Sweatshirt Large Made in USA",
    "price": 30,
    "size": "L",
    "description": "Vintage 80s Soffe Sweats navy blue crewneck sweatshirt. Large. Made in USA. Heavyweight cotton blend fleece. Classic blank vintage crewneck. Color: Blue.",
    "images": [
      "https://i.ebayimg.com/images/g/3cYAAeSw~ZdpyMzJ/s-l1600.webp",
      "https://i.ebayimg.com/images/g/3dEAAeSw~ZdpyMzK/s-l960.webp",
      "https://i.ebayimg.com/images/g/JdYAAeSwPO5pyMzM/s-l960.webp",
      "https://i.ebayimg.com/images/g/EIQAAeSwZJxpyMzN/s-l960.webp",
      "https://i.ebayimg.com/images/g/tekAAeSwnQ5pyMzO/s-l960.webp",
      "https://i.ebayimg.com/images/g/iaoAAeSwXZ5pyMzP/s-l960.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318075237228",
    "ebayUrl": "https://www.ebay.com/itm/318075237228",
    "category": "Crewnecks & Hoodies"
  },
  {
    "id": "eb-317778053837",
    "code": "TEE-3837",
    "name": "Vintage 1990s Morrissey The Smiths Band Tee Grail Lyric Shirt Mens Large",
    "price": 60,
    "size": "L",
    "description": "Vintage 1990s Morrissey / The Smiths band tee. White. Mens Large. Made in El Salvador. Classic lyric graphic, double-sided. Grail. Color: White.",
    "images": [
      "https://i.ebayimg.com/images/g/aN8AAeSwLplpbdem/s-l1600.webp",
      "https://i.ebayimg.com/images/g/u0kAAeSwPjVpbden/s-l960.webp",
      "https://i.ebayimg.com/images/g/WbEAAeSwQ8Fpbdep/s-l960.webp",
      "https://i.ebayimg.com/images/g/4nsAAeSw0Rxpbdeq/s-l960.webp",
      "https://i.ebayimg.com/images/g/VjIAAeSwu8Bpbdes/s-l960.webp",
      "https://i.ebayimg.com/images/g/0SkAAeSwb99pbdet/s-l960.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "317778053837",
    "ebayUrl": "https://www.ebay.com/itm/317778053837",
    "category": "Tees"
  },
  {
    "id": "eb-318075244765",
    "code": "TEE-4765",
    "name": "Vintage 2008 Z100 Jingle Ball Long Sleeve Tee Kanye West Lady Gaga Rihanna Medium",
    "price": 60,
    "size": "M",
    "description": "Vintage 2008 Z100 Jingle Ball long sleeve graphic tee. Features Kanye West, Lady Gaga, Rihanna. Black. Medium. Double-sided print. Made in Mexico. Color: Black.",
    "images": [
      "https://i.ebayimg.com/images/g/abkAAeSww7FpyM5z/s-l1600.webp",
      "https://i.ebayimg.com/images/g/53QAAeSw3bppyM50/s-l960.webp",
      "https://i.ebayimg.com/images/g/0QkAAeSw6o1pyM51/s-l960.webp",
      "https://i.ebayimg.com/images/g/XDYAAeSwjb1pyM52/s-l960.webp",
      "https://i.ebayimg.com/images/g/CUYAAeSwgXdpyM54/s-l960.webp",
      "https://i.ebayimg.com/images/g/5GMAAeSw2RtpyM55/s-l960.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318075244765",
    "ebayUrl": "https://www.ebay.com/itm/318075244765",
    "category": "Tees"
  },
  {
    "id": "eb-318050391148",
    "code": "JKT-1148",
    "name": "Vintage 80s Carhartt J01 Detroit Jacket Paint Splatter Workwear Size 44 Large",
    "price": 185,
    "size": "L",
    "description": "Vintage 80s Carhartt J01 Detroit jacket in black with paint splatter. Size 44 Large. Made in USA. Polyester lined canvas shell. Classic workwear grail. Color: Black.",
    "images": [
      "https://i.ebayimg.com/images/g/FiEAAeSwOyxpwfRc/s-l1600.webp",
      "https://i.ebayimg.com/images/g/I6AAAeSwGBxpwfRe/s-l960.webp",
      "https://i.ebayimg.com/images/g/YNIAAeSwgidpwfRg/s-l960.webp",
      "https://i.ebayimg.com/images/g/80IAAeSws~JpwfRi/s-l960.webp",
      "https://i.ebayimg.com/images/g/4e4AAeSwzqFpwfRk/s-l960.webp",
      "https://i.ebayimg.com/images/g/5dYAAeSwMBxpwfRm/s-l960.webp"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318050391148",
    "ebayUrl": "https://www.ebay.com/itm/318050391148",
    "category": "Jackets"
  },
  {
    "id": "depop-727490835",
    "code": "DEP-0835",
    "name": "Patagonia Women's Los Gatos 1/4-Zip Fleece Pullover",
    "price": 45,
    "size": "L",
    "condition": "Like New",
    "description": "Patagonia Women's Los Gatos 1/4-zip fleece pullover in tan and brown. Color: Tan.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3634390163_2c60cc56759b483db2a58767a87ab030/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634390165_f40d32b98c9747f5aac242cf0cd7145d/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634390166_d320a061d52547d8a25bf40e8a4fa585/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634390164_1067e463fbe1450e892054c237a05db3/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634390160_9ee0b7cc20a149cebb3e67e6ee6ebde2/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634390161_0e1d24925061420cb9431e135d7f3005/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634390162_d8631c56784a4e23aead831599ecd379/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634390167_58006d3a7ef6426ca7c3cdaf066f6bee/P0.jpg"
    ],
    "status": "available",
    "category": "Crewnecks & Hoodies",
    "depopUrl": "https://www.depop.com/products/vint0gecloset_pdx-patagonia-womens-los-gatos-14-zip-c508/"
  },
  {
    "id": "depop-720249027",
    "code": "DEP-9027",
    "name": "Vintage 1980s The Smiths Hatful Of Hollow Band Tee Shirt",
    "price": 300,
    "size": "L",
    "condition": "Like New",
    "description": "Vintage 1980s The Smiths Hatful Of Hollow Band Tee Shirt | 21x26.5 Large. Color: White.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3591893850_5c589b235bc54b92b09bc5c3de8b44ab/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3591893846_dddc0db6772a4274944d66af825b5ac9/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3591893849_78f545ad10564d539d6043051db52c69/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3591893847_4368b766f4c64421b3330fd8d091a635/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3591893845_d984bf2ea41e4d86b2ad142e8e23e4be/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3591893851_3b93485ecaa7417fb1e5b9a77ae31c16/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3591893853_889d88bf330247b59f71020a623ee2ae/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3591893852_8330084639914d40b53e1de43b9be201/P0.jpg"
    ],
    "status": "available",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintageclfset_pdx-vintage-1980s-the-smiths-hatful-1718/"
  },
  {
    "id": "depop-672859202",
    "code": "DEP-9202",
    "name": "Vintage 1991 Sting Soul Cages Band Tee Grail AOP all over print",
    "price": 70,
    "size": "XL",
    "condition": "Like New",
    "description": "Vintage 1991 Sting Soul Cages band tee grail with all over print. XL single stitch. Color: Multicolor.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3314285382_bae4d2abc80d4883933939a17556fd31/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3314285389_363ff75dee894789affdac2819d3c093/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3314285390_c615a05b21954451a80c08f1d942d0bf/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3314285384_7a543d046109470690dc8e33bf4c7fb4/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3314285388_0fd5fd22b4ee42bd9a6fd51539cd3847/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3314285383_2550d0213af94d8a8fa227cf345e7078/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3314285385_2a6e1bc73e694056b46118661910658e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3314285386_009a3524d91849a68f97bc3655e9c348/P0.jpg"
    ],
    "status": "available",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintagecloset_pdx-vintage-1991-sting-soul-cages/"
  },
  {
    "id": "eb-318055198324",
    "code": "JKT-8324",
    "name": "Vintage 80s Portland Trail Blazers Chalk Line Satin Bomber Jacket - Made in US",
    "price": 85,
    "size": "L",
    "condition": "New with tags",
    "description": "Vintage 80s Portland Trail Blazers Chalk Line satin bomber jacket, made in USA. Color: Black.",
    "images": [
      "https://i.ebayimg.com/images/g/vV0AAeSw1VppwzEv/s-l1600.webp",
      "https://i.ebayimg.com/images/g/bSQAAeSwEv1pwzEw/s-l960.webp",
      "https://i.ebayimg.com/images/g/0h0AAeSwlBhpwzEx/s-l960.webp",
      "https://i.ebayimg.com/images/g/WLcAAeSwdQBpwzEz/s-l960.webp",
      "https://i.ebayimg.com/images/g/U8sAAeSw-2ppwzE0/s-l960.webp",
      "https://i.ebayimg.com/images/g/zJ0AAeSwtLtpwzE1/s-l960.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318055198324",
    "ebayUrl": "https://www.ebay.com/itm/318055198324",
    "category": "Jackets"
  },
  {
    "id": "eb-318129947929",
    "code": "TEE-7929",
    "name": "Gildan George W. Bush Miss Me Yet? Graphic T-Shirt",
    "price": 40,
    "size": "XL",
    "condition": "New with tags",
    "description": "George W. Bush 'Miss Me Yet?' graphic T-shirt. Color: Navy.",
    "images": [
      "https://i.ebayimg.com/images/g/RSoAAeSwn8lp2Kr6/s-l1600.webp",
      "https://i.ebayimg.com/images/g/Pw4AAeSwFh9p2Kr8/s-l960.webp",
      "https://i.ebayimg.com/images/g/PFUAAeSwur5p2Kr9/s-l960.webp",
      "https://i.ebayimg.com/images/g/Pr8AAeSwVbJp2Kr~/s-l960.webp",
      "https://i.ebayimg.com/images/g/OFQAAeSwWlNp2KsB/s-l960.webp",
      "https://i.ebayimg.com/images/g/Hf4AAeSw13Zp2KsC/s-l960.webp"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318129947929",
    "…30679 tokens truncated…6a46/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322747702_105943dbb3724990baa55dc23a57cfc3/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintagecl8set_pdx-2005-misfits-records-meet-the-a7b2/"
  },
  {
    "id": "depop-vintageclose3_pdx-vintage-2005-kurt-cobain-graphic-3c91",
    "code": "TEE-3C91",
    "name": "Vintage 2005 Kurt Cobain Graphic T-Shirt 'My emotions are affected by music' 2005 Kurt Cobain graphic tee,",
    "price": 35,
    "size": "M",
    "condition": "Good condition",
    "description": "Vintage 2005 Kurt Cobain Graphic T-Shirt 'My emotions are affected by music' 2005 Kurt Cobain graphic tee, officially licensed under Bravado Merchandising. Cream/off-white, 100% cotton, short sleeve crew neck. Front graphic is a Kurt Cobain illustration with the text 'my emotions are affected by m Color: White/Cream.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4322693754_645eba2c65684678b844d12a05cbe05f/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322694652_412ad4fbf2844b618753a88f7538c596/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322696204_ec447f80fa814d689d554361e11ed24a/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322693674_11604c3d51494d62bb83bef2f62ba4ae/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322694475_f97d74d3577f4bf6b5b9d1eced924c12/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322695329_04765e6b639d495197710a1b8e4ec9ba/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322692183_44d518c2b4b84963b29cc4fbf58d4e1a/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintageclose3_pdx-vintage-2005-kurt-cobain-graphic-3c91/"
  },
  {
    "id": "depop-vintag3closet_pdx-vintage-1996-star-trek-30-1227",
    "code": "TEE-1227",
    "name": "Vintage 1996 Star Trek 30 Years USS Enterprise NCC-1701 T-Shirt Stanley DeSantis 1996 Star Trek 30th",
    "price": 45,
    "size": "Other",
    "condition": "Good condition",
    "description": "Vintage 1996 Star Trek 30 Years USS Enterprise NCC-1701 T-Shirt Stanley DeSantis 1996 Star Trek 30th anniversary tee by Stanley DeSantis. Black with USS Enterprise NCC-1701 graphic on front and back. Copyrighted 1996, made to mark the franchise's 30-year milestone. Gently used with minor fading an Color: Black/Tan.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4322506170_f8c4848b944747aa984e889a1d7d2b6d/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322507824_b132d50ea8a44c41822c00c60bf0d7b3/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322507066_b2e5b8a376c249d285eaaf1e8380b877/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322508412_7e7a71a962384747a3de4959d81f434b/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322508711_5594640e15a14175ae90d19f4d8094a1/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322507767_d8ddba5895da4489859c0fb363af747b/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintag3closet_pdx-vintage-1996-star-trek-30-1227/"
  },
  {
    "id": "depop-vintagecposet_pdx-vintage-1996-the-crow-city-5ee5",
    "code": "TEE-5EE5",
    "name": "Vintage 1996 The Crow: City of Angels Movie Promo T-Shirt Brand New With Tags Deadstock Black â€¢ Cotton",
    "price": 80,
    "size": "XL",
    "condition": "Good condition",
    "description": "Vintage 1996 The Crow: City of Angels Movie Promo T-Shirt Brand New With Tags Deadstock #movie #horror #Vintage #Nineties Black â€¢ Cotton, Cotton - Organic â€¢ Streetwear, Retro, Indie, 90s, Vintage, preloved Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4322143419_0a3cf9a2c2fa4a33816b9a8aa275cf4e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322143719_6efff6f3996347fc8a26ad1d1bd0e9b5/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322143078_61b2a37112d64f159eec5a58ad1ce5aa/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322142370_40c9e54b08a34145bd74ddfb81ef3a6a/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322143896_04def11575ca492eb691576d98f59de4/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322143376_a3a2ae5a0ddc49cc8c03fda27ba9b02f/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322142759_e9dc57b34bd54a06a4497cc93a0e1f6e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322142564_5f2a3eff99014b30924f5486cbb93dab/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintagecposet_pdx-vintage-1996-the-crow-city-5ee5/"
  },
  {
    "id": "depop-vintxgecloset_pdx-vintage-1976-marvel-comics-captain-77aa",
    "code": "TEE-77AA",
    "name": "Vintage 1976 Marvel Comics Captain America Graphic Ringer T-Shirt One of the earliest Marvel Comics Tees to",
    "price": 120,
    "size": "S",
    "condition": "Good condition",
    "description": "Vintage 1976 Marvel Comics Captain America Graphic Ringer T-Shirt One of the earliest Marvel Comics Tees to exist #marvel #superhero #TrueVintage #Seventies #Ringer Multi White â€¢ Cotton, Cotton - Organic â€¢ Streetwear, Retro, Indie, 70s, Vintage, preloved Color: White.",
    "images": [
      "https://media-photos.depop.com/r1/43131440/4322118676_f7e181ca65404524bd51aa7e461cd469/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4322116083_1b8d2ba98aeb45b29e9daa48a25b4b39/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4322118786_a8d22e03310a431d8994d4b77740970f/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4322117353_7e555e7494e74230b4ec1f0e817dca73/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4322118193_75a2347534144f56ab25a84814faae09/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4322117354_4013dbc8a2324c299fe8d0b246653d37/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4322118273_98682261e1cb4482b254d5337282e03c/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4322118810_82ac4dcfa875425295faa342d5fb9b02/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintxgecloset_pdx-vintage-1976-marvel-comics-captain-77aa/"
  },
  {
    "id": "eb-318656643211",
    "code": "TEE-3211",
    "name": "Vintage NWA Ice Cube Parking Lot Boot Rap Tee 80s/90s Single Stitch Men's Large",
    "price": 135,
    "size": "L",
    "condition": "Good condition",
    "description": "Vintage NWA / Ice Cube parking lot boot rap tee from the late 80s to early 90s era. White cotton crewneck with graphic print, single-stitch construction, and classic vintage fit in men's size Large. Pre-owned in good vintage condition with normal wear consistent with age. Please review all photos for exact condition and print detail. Color: White.",
    "images": [
      "https://i.ebayimg.com/images/g/j9MAAeSwRo9qa8Vs/s-l1600.webp",
      "https://i.ebayimg.com/images/g/HwQAAeSwvTxqa8Vt/s-l1600.webp",
      "https://i.ebayimg.com/images/g/5pMAAeSwYJFqa8Vt/s-l1600.webp",
      "https://i.ebayimg.com/images/g/tcoAAeSwN-lqa8Vu/s-l1600.webp",
      "https://i.ebayimg.com/images/g/uxoAAeSwYG9qa8Vu/s-l1600.webp",
      "https://i.ebayimg.com/images/g/oQgAAeSw~Lpqa8Vv/s-l1600.webp",
      "https://i.ebayimg.com/images/g/HgkAAeSw3jFqa8Vw/s-l1600.webp",
      "https://i.ebayimg.com/images/g/pOEAAeSwl-1qa8Vw/s-l1600.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "ebayUrl": "https://www.ebay.com/itm/318656643211"
  },
  {
    "id": "vinted-9766446517",
    "code": "JKT-9766",
    "name": "Carhartt Relaxed Fit Blanket-Lined Detroit Work Jacket Black Size S Distressed",
    "price": 100,
    "size": "S",
    "condition": "Distressed",
    "images": [
      "https://images1.vinted.net/t/02_018a1_pLUhyZWSaH6EazumoP28XL7B/f800/1788411942.webp?s=5e18bfc997237ab8a0750399914a0ab36e22f291",
      "https://images1.vinted.net/t/05_0220a_vpJgADDWmFHCTPX8iMZPUpeP/f800/1788411942.webp?s=a1d161e2df4ca392ba676931e7a29d3a4d95187a",
      "https://images1.vinted.net/t/02_01deb_BTaVrXAC8Usey8Bh8YYoW5hB/f800/1788411942.webp?s=e872c9e4f81b3af902045e29c1954af280cd3ccc",
      "https://images1.vinted.net/t/06_002b3_etAfsQdoZnBmz8nTwmtBFQtm/f800/1788411942.webp?s=ef99ec80d237c5fb1af79d437448ef8227c4d9db",
      "https://images1.vinted.net/t/05_01179_h1eC7vQtBaEWC6NbHCMMsfWs/f800/1788411942.webp?s=2e471f90b0710a203123badc231225d236b64c05"
    ],
    "description": "Vintage Carhartt Detroit work jacket in black. Relaxed fit with blanket lining. Model DJ3828-M. Distressed condition with character and worn-in patina.",
    "category": "Jackets",
    "status": "available"
  }
];
 
// -----------------------
// Rendering helpers
// -----------------------
// Clean description: remove hashtags and trailing tag-lists
function sanitizeDescription(s){
  if (!s) return '';
  let out = String(s);
  out = out.replace(/#\S+/g, '');
  // remove common bundle/discount promotional lines like "GET 15% OFF" or "BUNDLE DISCOUNT"
  out = out.replace(/(?:bundle discount|get\s*\d+%?\s*off|\d+%?\s*off)/gi, '');
  out = out.replace(/(?:,\s*[^,]{1,40}){2,}\s*$/,'');
  out = out.replace(/\s+/g,' ').trim();
  out = out.replace(/^[,;:\-\s]+|[,;:\-\s]+$/g,'').trim();
  return out;
}

function normalizeProductName(name, description){
  const rawName = String(name || '').trim();
  if (!rawName) return rawName;
  if (!/\.\.\.$/.test(rawName)) return rawName;

  const base = rawName.replace(/\.\.\.$/, '').trim();
  const cleanedDescription = sanitizeDescription(description || '')
    .replace(/\s*Color\s*:\s*[^.\n;]+\.?/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanedDescription) return base;

  const firstSentence = cleanedDescription.split(/[.!?](?:\s|$)/)[0].trim();
  const sentenceWords = firstSentence.split(/\s+/).filter(Boolean);
  const descTitle = sentenceWords.length > 20 ? sentenceWords.slice(0, 20).join(' ') : firstSentence;

  let candidate = descTitle || base;
  if (candidate.toLowerCase().indexOf(base.toLowerCase()) !== 0) {
    candidate = `${base} ${candidate}`;
  }

  candidate = candidate.replace(/\s+/g, ' ').trim();
  if (candidate.length > 110) {
    const clipped = candidate.slice(0, 110);
    const cutAt = clipped.lastIndexOf(' ');
    candidate = (cutAt > 0 ? clipped.slice(0, cutAt) : clipped).trim();
  }

  return candidate || base;
}

const COLOR_PATTERNS = [
  { label: 'Black', regex: /\bblack\b/i },
  { label: 'White', regex: /\bwhite\b/i },
  { label: 'Gray', regex: /\bgray\b|\bgrey\b/i },
  { label: 'Brown', regex: /\bbrown\b|\btan\b|\bbeige\b|\bkhaki\b/i },
  { label: 'Blue', regex: /\bblue\b|\bnavy\b|\bindigo\b|\blight wash\b|\bdark wash\b/i },
  { label: 'Red', regex: /\bred\b|\bmaroon\b|\bburgundy\b|\bcrimson\b/i },
  { label: 'Green', regex: /\bgreen\b|\bolive\b/i },
  { label: 'Purple', regex: /\bpurple\b|\bviolet\b/i },
  { label: 'Yellow', regex: /\byellow\b|\bgold\b/i },
  { label: 'Orange', regex: /\borange\b|\brust\b/i },
  { label: 'Pink', regex: /\bpink\b/i },
  { label: 'Camo', regex: /\bcamo\b|\bcamouflage\b/i },
  { label: 'Tie-Dye', regex: /\btie[\s-]?dye\b/i },
  { label: 'Multicolor', regex: /\bmulticolor\b|\bmulti-color\b|\bmulti color\b/i }
];

function uniqueColors(list){
  const seen = new Set();
  const out = [];
  for (const item of list || []) {
    const key = String(item || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function extractColorsFromText(text){
  const src = String(text || '');
  const found = [];
  for (const rule of COLOR_PATTERNS) {
    if (rule.regex.test(src)) found.push(rule.label);
  }
  return found;
}

function inferProductColors(p){
  const name = (p && p.name) || '';
  const description = (p && p.description) || '';
  const hay = `${name} ${description}`;

  const explicit = [];
  const explicitMatches = description.match(/\bcolor\s*:\s*([^\.\n;]+)/ig) || [];
  for (const match of explicitMatches) {
    const raw = match.replace(/^.*?\bcolor\s*:\s*/i, '');
    explicit.push(...extractColorsFromText(raw));
  }

  const detected = extractColorsFromText(hay);
  const colors = uniqueColors([...explicit, ...detected]);
  return colors.length ? colors : ['Multicolor'];
}

function inferProductColor(p){
  return inferProductColors(p).join(', ');
}

function ensureColorMentionInDescription(p){
  if (!p) return;
  const color = inferProductColor(p);
  const desc = sanitizeDescription(p.description || '');
  if (/\bcolor\s*:/i.test(desc)) {
    p.description = desc.replace(/\bcolor\s*:\s*([^\.\n;]+)/ig, `Color: ${color}`);
    return;
  }
  p.description = desc ? `${desc} Color: ${color}.` : `Color: ${color}.`;
}

// Build a responsive srcset for eBay CDN image URLs when possible
function makeSrcset(url){
  if(!url || typeof url !== 'string') return '';
  try{
    if(!/s-l\d+/i.test(url)) return '';
    const small = url.replace(/s-l\d+/i, 's-l140');
    const med = url.replace(/s-l\d+/i, 's-l500');
    const med2 = url.replace(/s-l\d+/i, 's-l960');
    const large = url.replace(/s-l\d+/i, 's-l1600');
    return `${small} 140w, ${med} 500w, ${med2} 960w, ${large} 1600w`;
  }catch(e){ return ''; }
}
window.makeSrcset = makeSrcset;

// Clean existing product descriptions (import-time should handle this, but sanitize any legacy entries)
// Category rules and auto-assignment
const CATEGORY_LIST = ['Jackets','Tees','Pants','Crewnecks & Hoodies','New Arrivals'];
const KEYWORDS = {
  Jackets: ['jacket','coat','parka','bomber','detroit','chore','windbreaker','puffer','anorak','varsity','workwear jacket','trench','overcoat'],
  Tees: ['tee','t-shirt','tshirt','graphic tee','band tee','shirt'],
  Pants: ['pants','jeans','denim','trousers','cargos','cargo','carpenter','double knee','shorts'],
  'Crewnecks & Hoodies': ['hoodie','hooded','sweatshirt','crewneck','pullover','sweat']
};

function assignCategoryToProduct(p){
  if (!p || typeof p !== 'object') return 'Tees';
  const hay = ((p.name || '') + ' ' + (p.description || '')).toLowerCase();
  // Strong cues should override bad imported categories.
  if (/(crewneck|sweatshirt|hoodie|pullover|sweat)\b/i.test(hay)) return 'Crewnecks & Hoodies';
  if (/(pants|jeans|trousers|cargos|cargo|carpenter|double knee|shorts)\b/i.test(hay)) return 'Pants';
  if (/(jacket|coat|parka|bomber|detroit|chore|windbreaker|puffer|anorak|trench|active jac|workwear jacket)\b/i.test(hay)) return 'Jackets';
  if (/(tee|t-shirt|tshirt|graphic tee|band tee|single stitch tee|ringer tee)\b/i.test(hay)) return 'Tees';
  // Respect existing explicit category when it's known
  if (p.category && CATEGORY_LIST.includes(p.category)) return p.category;
  // If categories array already includes a known category, keep the first one
  if (Array.isArray(p.categories)) {
    const found = p.categories.find(c => CATEGORY_LIST.includes(c));
    if (found) return found;
  }
  const matches = {};
  Object.keys(KEYWORDS).forEach(cat => {
    KEYWORDS[cat].forEach(k => { if (hay.indexOf(k) !== -1) matches[cat] = (matches[cat]||0)+1; });
  });
  // Brand cue: if Carhartt appears with outerwear hints, prefer Jackets
  // Carhartt override should only trigger for explicit outerwear terms, not generic 'work' or 'canvas'
  if (/carhartt/i.test(hay) && /(jacket|coat|bomber|detroit|chore|puffer|windbreaker|parka|trench)/i.test(hay)) return 'Jackets';
  // If explicit hood/sweat mention -> Crewnecks & Hoodies
  if (/hood|sweat/i.test(hay)) return 'Crewnecks & Hoodies';
  // Prefer the category with most keyword hits
  const best = Object.keys(matches).sort((a,b)=>matches[b]-matches[a]);
  if (best.length > 0 && matches[best[0]] > 0) return best[0];
  // Fallbacks: Jackets if outerwear words appear
  if (/(jacket|coat|parka|bomber|puffer|anorak|trench)/i.test(hay)) return 'Jackets';
  if (/(tee|t-shirt|tshirt|graphic|band)/i.test(hay)) return 'Tees';
  if (/(pants|jeans|denim|trouser|cargo|shorts)/i.test(hay)) return 'Pants';
  return 'Tees';
}

// Normalize descriptions and assign category for every product (reassign to apply updated rules)
products.forEach(p => {
  if (p && p.description) p.description = sanitizeDescription(p.description);
  if (p) p.name = normalizeProductName(p.name, p.description);
  // Remove retired "Levis" category tag and keep only active categories.
  if (p && Array.isArray(p.categories)) {
    p.categories = p.categories.filter(c => String(c) !== 'Levis' && CATEGORY_LIST.includes(String(c)));
  }
  if (p) p.category = assignCategoryToProduct(p);
  if (p) ensureColorMentionInDescription(p);
  // Remove duplicate images from the images array
  if (p && p.images && Array.isArray(p.images)) {
    const seen = new Set();
    p.images = p.images.filter(img => {
      if (!img || seen.has(img)) return false;
      seen.add(img);
      return true;
    });
  }
});

// Preserve original array index for "newest" sorting
products.forEach((p,i)=>{ if (p) p.__idx = i; });

// Sorting and filter helpers (persisted in URL params)
function getSelectedSort(){ try{ return new URLSearchParams(location.search).get('sort') || ''; }catch(e){return ''; } }
function setSelectedSort(s){ try{ const url = new URL(location.href); if (!s) url.searchParams.delete('sort'); else url.searchParams.set('sort', s); history.replaceState(null,'',url); renderCategoryFilters(); renderProducts(); }catch(e){} }
function getFiltersFromURL(){ try{ const p = new URLSearchParams(location.search); return { min: p.get('min')||'', max: p.get('max')||'', size: p.get('size')||'' }; }catch(e){ return {min:'',max:'',size:''}; } }
function setFiltersInURL(filters){ try{ const url = new URL(location.href); if (filters.min) url.searchParams.set('min', String(filters.min)); else url.searchParams.delete('min'); if (filters.max) url.searchParams.set('max', String(filters.max)); else url.searchParams.delete('max'); if (filters.size) url.searchParams.set('size', filters.size); else url.searchParams.delete('size'); history.replaceState(null,'',url); renderCategoryFilters(); renderProducts(); }catch(e){} }

function applyFiltersToArray(arr){ const f = getFiltersFromURL(); return arr.filter(p=>{ if (f.size && String(f.size).trim()){ const ps = String(p.size||'').trim(); if (!ps) return false; if (ps.toLowerCase() !== f.size.toLowerCase()) return false; } if (f.min){ const min = Number(f.min) || 0; if (Number(p.price) < min) return false; } if (f.max){ const max = Number(f.max) || 0; if (Number(p.price) > max) return false; } return true; }); }

function applySort(arr){ const s = getSelectedSort(); if (!s) return arr; if (s === 'lowest') return arr.slice().sort((a,b)=> (Number(a.price)||0) - (Number(b.price)||0)); if (s === 'highest') return arr.slice().sort((a,b)=> (Number(b.price)||0) - (Number(a.price)||0)); if (s === 'newest') return arr.slice().sort((a,b)=> (Number(b.__idx)||0) - (Number(a.__idx)||0)); return arr; }

const SALE_DISCOUNT_RATE = 0.15;
const SALE_TIME_ZONE = 'America/Los_Angeles';
const SALE_START_HOUR = 0;
const SALE_DURATION_MS = 24 * 60 * 60 * 1000;
const SALES_ACTIVE = false;
let saleBannerTimer = null;

function getSaleClockParts(date){
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SALE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = {};
  formatter.formatToParts(date || new Date()).forEach((part) => {
    if (part.type !== 'literal') parts[part.type] = part.value;
  });
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function getSaleClockMs(parts){
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
}

function getSaleWindowState(date){
  if (!SALES_ACTIVE) return { phase: 'ended', startMs: 0, endMs: 0, nowMs: 0 };
  const nowParts = getSaleClockParts(date || new Date());
  const nowMs = getSaleClockMs(nowParts);
  const startMs = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day, SALE_START_HOUR, 0, 0, 0);
  const endMs = startMs + SALE_DURATION_MS;
  if (nowMs < startMs) return { phase: 'upcoming', startMs, endMs, nowMs };
  if (nowMs < endMs) return { phase: 'active', startMs, endMs, nowMs };
  return { phase: 'ended', startMs, endMs, nowMs };
}

function getEffectivePrice(value){
  const sale = getSaleWindowState();
  const base = Number(value) || 0;
  if (sale.phase === 'active') {
    return Math.round(base * (1 - SALE_DISCOUNT_RATE) * 100) / 100;
  }
  return base;
}

function formatCurrency(value){
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function formatCountdown(ms){
  const totalSeconds = Math.max(0, Math.floor(Number(ms) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const segments = [];
  if (days > 0) segments.push(`${days}d`);
  segments.push(`${String(hours).padStart(2, '0')}h`);
  segments.push(`${String(minutes).padStart(2, '0')}m`);
  segments.push(`${String(seconds).padStart(2, '0')}s`);
  return segments.join(' ');
}

function formatPrice(p){
  const base = Number(p) || 0;
  const sale = getSaleWindowState();
  if (sale.phase === 'active') {
    const discounted = getEffectivePrice(base);
    return `<span class="price--sale"><span class="price-original">${formatCurrency(base)}</span><span class="price-discounted">${formatCurrency(discounted)}</span></span>`;
  }
  return `<span class="price--regular">${formatCurrency(base)}</span>`;
}

function refreshSalePrices(){
  document.querySelectorAll('[data-base-price]').forEach((node) => {
    const base = Number(node.getAttribute('data-base-price')) || 0;
    node.innerHTML = formatPrice(base);
  });
}

function getSaleBannerCopy(){
  const sale = getSaleWindowState();
  if (sale.phase === 'upcoming') {
    return {
      label: '15% off entire shop starts at 5:00 PM Pacific',
      timer: `Starts in ${formatCountdown(sale.startMs - sale.nowMs)}`
    };
  }
  if (sale.phase === 'active') {
    return {
      label: '15% off entire shop is live now',
      timer: `Ends in ${formatCountdown(sale.endMs - sale.nowMs)}`
    };
  }
  return { label: '', timer: '' };
}

function ensureSaleBanner(){
  if (!document.body || document.getElementById('sale-banner') || !document.querySelector('.site')) return;
  const banner = document.createElement('div');
  banner.id = 'sale-banner';
  banner.className = 'sale-banner';
  banner.innerHTML = '<span class="sale-banner__label"></span><span class="sale-banner__timer" aria-live="polite"></span>';
  document.body.prepend(banner);
}

function updateSaleBanner(){
  const banner = document.getElementById('sale-banner');
  if (!banner) return;
  const sale = getSaleWindowState();
  refreshSalePrices();
  const prodTimer = document.getElementById('prod-sale-timer');
  if (prodTimer) {
    if (sale.phase === 'active') {
      prodTimer.textContent = `Limited time offer ends in ${formatCountdown(sale.endMs - sale.nowMs)}.`;
      prodTimer.style.display = '';
    } else if (sale.phase === 'upcoming') {
      prodTimer.textContent = `15% off starts at 5:00 PM Pacific in ${formatCountdown(sale.startMs - sale.nowMs)}.`;
      prodTimer.style.display = '';
    } else {
      prodTimer.textContent = '';
      prodTimer.style.display = 'none';
    }
  }
  if (sale.phase === 'ended') {
    banner.style.display = 'none';
    return;
  }
  banner.style.display = '';
  const copy = getSaleBannerCopy();
  const label = banner.querySelector('.sale-banner__label');
  const timer = banner.querySelector('.sale-banner__timer');
  if (label) label.textContent = copy.label;
  if (timer) timer.textContent = copy.timer;
}

function startSaleBannerTimer(){
  ensureSaleBanner();
  updateSaleBanner();
  if (saleBannerTimer) clearInterval(saleBannerTimer);
  saleBannerTimer = setInterval(updateSaleBanner, 1000);
}

const CHECKOUT_API_URL = 'https://backend-pi-dusky-32.vercel.app/api/create-checkout';
async function startCheckout(product){
  const productName = String((product && product.name) || '').replace(/\s*\|\s*eBay$/i, '');
  const price = getEffectivePrice((product && product.price) || 0);
  const itemCode = String((product && (product.code || product.ebayItemNumber || product.id)) || '');

  if (!productName || !itemCode || price <= 0) {
    throw new Error('Invalid product checkout data');
  }

  const payload = {
    productName,
    price,
    itemCode,
    successUrl: window.location.origin + '/index.html?purchase=success',
    cancelUrl: window.location.origin + '/index.html?purchase=cancelled',
  };

  const response = await fetch(CHECKOUT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data && data.error ? data.error : 'Checkout request failed');
  }
  if (!data.url) throw new Error('No checkout URL returned');
  window.location.href = data.url;
}

function createProductCard(prod, showNewBadge){
  // Create DOM elements for a product card. We keep structure simple.
  const article = document.createElement('article');
  // Add 'sold' class to the article when item is sold so CSS can dim it
  article.className = prod.status==='sold' ? 'product sold' : 'product';
  article.setAttribute('data-product-id', prod.id);

  // Make the whole card keyboard-focusable and clickable — navigates to detail page
  article.tabIndex = 0;
  // Preserve current page URL as referrer for back navigation
  const slug = getProductSlug(prod);
  const listRef = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const detailHref = `product.html?id=${encodeURIComponent(prod.id)}${slug ? `&slug=${encodeURIComponent(slug)}` : ''}&ref=${encodeURIComponent(listRef)}`;
  article.addEventListener('click', (e) => {
    // if click originates from a link like Buy, let it proceed
    const tag = e.target && e.target.tagName && e.target.tagName.toLowerCase();
    if (tag === 'a' || tag === 'button') return;
    window.location.href = detailHref;
  });
  article.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.location.href = detailHref;
    }
  });

  // Clean display name (strip trailing "| eBay")
  const displayName = (prod.name || '').replace(/\s*\|\s*eBay$/i, '');
  
  // Image area: support hover transition to second image if available
  let imgSection = '';
  const images = (prod.images && prod.images.length) ? prod.images : (prod.image ? [prod.image] : []);
  const hasMultipleImages = images.length > 1;
  
  if (images.length > 0) {
    const thumb = images[0];
    const thumbSrc = (/s-l\d+/i.test(thumb)) ? thumb.replace(/s-l\d+/i,'s-l960') : thumb;
    const srcset = makeSrcset(thumb);
    // Mobile uses 1 card per row for larger images, then scales up by breakpoints.
    const sizes = '(max-width:639px) 92vw, (max-width:899px) 46vw, (max-width:1199px) 31vw, 23vw';
    
    const newBadge = showNewBadge ? '<span class="badge-new">NEW</span>' : '';
    if (hasMultipleImages) {
      // Create container with both images for hover effect
      const thumb2 = images[1];
      const thumbSrc2 = (/s-l\d+/i.test(thumb2)) ? thumb2.replace(/s-l\d+/i,'s-l960') : thumb2;
      const srcset2 = makeSrcset(thumb2);
      imgSection = `<div class="img-placeholder" role="img" aria-label="${displayName} image" style="position:relative">
        ${newBadge}
        <img class="img-primary" src="${thumbSrc}" ${srcset?`srcset="${srcset}" sizes="${sizes}"`:''} loading="lazy" decoding="async" alt="${displayName}" style="transition:opacity 0.3s ease">
        <img class="img-secondary" src="${thumbSrc2}" ${srcset2?`srcset="${srcset2}" sizes="${sizes}"`:''} loading="lazy" decoding="async" alt="${displayName}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.3s ease;pointer-events:none">
      </div>`;
    } else {
      // Single image, no hover effect
      imgSection = `<div class="img-placeholder" role="img" aria-label="${displayName} image" style="position:relative">${newBadge}<img src="${thumbSrc}" ${srcset?`srcset="${srcset}" sizes="${sizes}"`:''} loading="lazy" decoding="async" alt="${displayName}"></div>`;
    }
  } else {
    const newBadge = showNewBadge ? '<span class="badge-new">NEW</span>' : '';
    imgSection = `<div class="img-placeholder" role="img" aria-label="${displayName} placeholder" style="position:relative">${newBadge}Photo</div>`;
  }

  const actionSection = prod.status === 'sold'
    ? `<div class="product-actions">
         <div class="badge sold">Sold</div>
       </div>`
    : `<div class="product-actions">
         <button class="buy" type="button" data-product-id="${prod.id}">Buy Now</button>
       </div>`;

  article.innerHTML = `
    ${imgSection}
    <div class="details">
      <div class="name">${displayName}</div>
      <div class="price" data-base-price="${Number(prod.price) || 0}">${formatPrice(prod.price)}</div>
      <div class="meta">${prod.size}</div>
    </div>
    ${actionSection}
  `;

  // Handle Buy Now button click - create dynamic Stripe checkout
  const buy = article.querySelector('.buy');
  if (buy) {
    buy.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      
      // Show loading state
      buy.textContent = 'Loading...';
      buy.disabled = true;
      
      try {
        await startCheckout(prod);
      } catch (error) {
        console.error('Checkout error:', error);
        buy.textContent = 'Buy Now';
        buy.disabled = false;
        alert(`Failed to start checkout: ${error.message || 'Please try again.'}`);
      }
    });
  }

  // Add hover effect for image transition if multiple images exist
  if (hasMultipleImages) {
    const imgSecondary = article.querySelector('.img-secondary');
    if (imgSecondary) {
      article.addEventListener('mouseenter', () => {
        imgSecondary.style.opacity = '1';
      });
      article.addEventListener('mouseleave', () => {
        imgSecondary.style.opacity = '0';
      });
    }
  }

  return article;
}

function getSelectedCategory(){
  try{
    const p = new URLSearchParams(location.search).get('cat');
    if (!p || p === 'Levis') return 'All';
    return p;
  }catch(e){return 'All';}
}

function setSelectedCategory(cat){
  try{
    window.__hasNavigated = true;
    const url = new URL(location.href);
    if (cat === 'Levis') cat = 'All';
    if (!cat) url.searchParams.delete('cat'); 
    else url.searchParams.set('cat', cat);
    history.replaceState(null, '', url);
    renderPage();
  }catch(e){ console.warn('setSelectedCategory', e); }
}

function isHomepage() {
  const urlParams = new URLSearchParams(window.location.search);
  return !urlParams.has('cat') && !window.__hasNavigated;
}

function renderPage() {
  const homepage = document.getElementById('homepage');
  const collectionsContent = document.getElementById('collections-content');
  const quickFind = document.getElementById('quick-find');
  const categoryHeading = document.getElementById('category-heading');
  const filtersWrap = document.getElementById('category-filters');
  let categoryDescription = document.getElementById('category-description');

  if (!categoryDescription && filtersWrap && filtersWrap.parentElement) {
    categoryDescription = document.createElement('p');
    categoryDescription.id = 'category-description';
    categoryDescription.className = 'category-description';
    filtersWrap.parentElement.parentElement.insertBefore(categoryDescription, filtersWrap.parentElement);
  }
  
  if (isHomepage()) {
    homepage.style.display = 'block';
    collectionsContent.style.display = 'none';
    if (quickFind) quickFind.style.display = 'none';
  } else {
    homepage.style.display = 'none';
    collectionsContent.style.display = 'block';
    if (quickFind) quickFind.style.display = '';
    
    // Update category heading
    const currentCategory = getSelectedCategory();
    if (categoryHeading) {
      categoryHeading.textContent = currentCategory;
    }
    if (categoryDescription) {
      if (currentCategory === 'New Arrivals') {
        categoryDescription.textContent = 'A rolling edit of the 10 most recently added available pieces, with the newest arrivals shown first.';
        categoryDescription.style.display = 'block';
      } else {
        categoryDescription.textContent = '';
        categoryDescription.style.display = 'none';
      }
    }
    
    renderCategoryFilters();
    renderProducts();
  }
}

function renderCategoryFilters(){
  const wrap = document.getElementById('category-filters');
  if (!wrap) return;
  wrap.innerHTML = '';
  // Only show "All" button in main filter bar
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chip' + (getSelectedCategory()==='All'? ' active':'');
  btn.textContent = 'All';
  btn.setAttribute('data-cat', 'All');
  btn.addEventListener('click', ()=> setSelectedCategory('All'));
  wrap.appendChild(btn);
  
  // Sort select
  const sortSelect = document.createElement('select');
  sortSelect.id = 'sort-select';
  sortSelect.className = 'control-select';
  const opts = [{v:'',t:'Sort'},{v:'lowest',t:'Lowest price'},{v:'highest',t:'Highest price'},{v:'newest',t:'Newly listed'}];
  opts.forEach(o=>{ const op = document.createElement('option'); op.value = o.v; op.textContent = o.t; sortSelect.appendChild(op); });
  sortSelect.value = getSelectedSort() || '';
  sortSelect.addEventListener('change', (e)=> setSelectedSort(e.target.value));
  wrap.appendChild(sortSelect);

  // Filter toggle
  const fbtn = document.createElement('button');
  fbtn.type = 'button';
  fbtn.id = 'filter-toggle';
  fbtn.className = 'chip';
  fbtn.textContent = 'Filter';
  fbtn.addEventListener('click', ()=>{
    const panel = document.getElementById('filter-panel');
    if (!panel) return;
    panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
    renderFilterPanel();
  });
  wrap.appendChild(fbtn);
}

function getNewArrivalCandidates(){
  // Keep legacy carryover items out of New Arrivals so the rail reflects newly added drops.
  const excludedIds = new Set(['eb-317669998950']);
  return products.filter(p => p.status !== 'sold' && !excludedIds.has(p.id));
}

function getNewestAvailableProducts(limit){
  const availableProducts = getNewArrivalCandidates();
  const imported = availableProducts
    .filter(p => p.published_at)
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  // Static catalog entries keep their original newest-last ordering.
  const staticProducts = availableProducts.filter(p => !p.published_at).slice(-limit).reverse();
  return [...imported, ...staticProducts].slice(0, limit);
}

function getNewArrivalIdSet(){
  return new Set(getNewestAvailableProducts(10).map(p => p.id));
}

const NEW_STAMP_COUNT = 26;
function getTodayStampIdSet(){
  const availableProducts = getNewArrivalCandidates();
  return new Set(availableProducts.slice(-NEW_STAMP_COUNT).map(p => p.id));
}

function getGridColumnCount(){
  const width = Number(window.innerWidth) || 0;
  if (width >= 1400) return 4;
  if (width >= 900) return 3;
  return 2;
}

function getDailyRotatedCategories(categories){
  const base = Array.isArray(categories) ? categories.filter(Boolean) : [];
  if (base.length <= 1) return base;
  const daySeed = Math.floor(Date.now() / 86400000);
  const offset = ((daySeed % base.length) + base.length) % base.length;
  return base.slice(offset).concat(base.slice(0, offset));
}

function orderByCategoryRows(items, preferredOrder){
  const rowSize = getGridColumnCount();
  const grouped = {};

  (items || []).forEach((item) => {
    const cat = String((item && item.category) || 'Tees');
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  Object.keys(grouped).forEach((cat) => {
    grouped[cat] = grouped[cat]
      .slice()
      .sort((a, b) => (Number(b.__idx) || 0) - (Number(a.__idx) || 0));
  });

  const listed = Array.isArray(preferredOrder) ? preferredOrder.slice() : [];
  const extraCats = Object.keys(grouped)
    .filter(cat => !listed.includes(cat))
    .sort((a, b) => {
      const aTop = grouped[a] && grouped[a][0] ? Number(grouped[a][0].__idx) || 0 : 0;
      const bTop = grouped[b] && grouped[b][0] ? Number(grouped[b][0].__idx) || 0 : 0;
      return bTop - aTop;
    });

  const categoryCycle = [...listed, ...extraCats].filter(cat => grouped[cat] && grouped[cat].length);
  const ordered = [];

  while (true) {
    let moved = false;
    categoryCycle.forEach((cat) => {
      const bucket = grouped[cat];
      if (!bucket || bucket.length === 0) return;
      ordered.push(...bucket.splice(0, rowSize));
      moved = true;
    });
    if (!moved) break;
  }

  return ordered;
}

function renderProducts(){
  const container = document.querySelector('.products');
  if(!container) return;
  container.innerHTML = ''; // clear existing
  const filter = window.__productFilter || '';
  const q = filter.trim().toLowerCase();
  const selCat = getSelectedCategory();

  // Compute IDs that receive the NEW stamp (today's added batch).
  const _todayStampIds = getTodayStampIdSet();
  const hasNewStamp = p => _todayStampIds.has(p.id);
  
  // Special handling for New Arrivals: show last 10 AVAILABLE items regardless of category
  if (selCat === 'New Arrivals') {
    // Filter to only available items (excluding legacy carryovers), then get the last 10.
    const newArrivals = getNewestAvailableProducts(10);
    
    // Apply search filter if present
    let filtered = newArrivals;
    if (q) {
      filtered = newArrivals.filter(p => {
        const hay = ((p.name||'') + ' ' + (p.description||'') + ' ' + (p.code||'') + ' ' + (p.size||'')).toLowerCase();
        return hay.indexOf(q) !== -1;
      });
    }
    
    // Apply size/price filters
    let afterFilters = applyFiltersToArray(filtered);
    // Apply sort if any
    afterFilters = applySort(afterFilters);
    
    if (afterFilters.length === 0) {
      const msg = document.createElement('div');
      msg.className='no-results';
      msg.textContent = 'No items available for your selected filters.';
      container.appendChild(msg);
    } else {
      // Keep New Arrivals loosely organized by category, but in one continuous grid
      // so rows fill naturally without section breaks leaving empty slots.
      const NA_ORDER = ['Jackets', 'Tees', 'Crewnecks & Hoodies', 'Pants'];
      const categoryRank = cat => {
        const idx = NA_ORDER.indexOf(String(cat || ''));
        return idx === -1 ? NA_ORDER.length : idx;
      };
      afterFilters
        .slice()
        .sort((a, b) => {
          const byCategory = categoryRank(a.category) - categoryRank(b.category);
          if (byCategory !== 0) return byCategory;
          return (Number(b.__idx) || 0) - (Number(a.__idx) || 0);
        })
        .forEach(p => container.appendChild(createProductCard(p, hasNewStamp(p))));
    }
    return;
  }

  
  const filtered = products.filter(p => {
    // category filter
    if (selCat && selCat !== 'All') {
      const primary = String(p.category || '');
      const extras = Array.isArray(p.categories) ? p.categories.map(String) : [];
      if (primary !== selCat && !extras.includes(selCat)) return false;
    }
    // search filter
    if (!q) return true;
    const hay = ((p.name||'') + ' ' + (p.description||'') + ' ' + (p.code||'') + ' ' + (p.size||'')).toLowerCase();
    return hay.indexOf(q) !== -1;
  });
  // apply size/price filters
  let afterFilters = applyFiltersToArray(filtered);
  
  // Separate available and sold items
  const available = afterFilters.filter(p => p.status !== 'sold');
  const sold = afterFilters.filter(p => p.status === 'sold');
  
  // Apply sort to each group and keep sold items at the bottom
  const sortedAvailable = applySort(available);
  const sortedSold = applySort(sold);
  afterFilters = [...sortedAvailable, ...sortedSold];
  
  // Check if any sort or filters are applied
  const hasSort = getSelectedSort() ? true : false;
  const urlFilters = getFiltersFromURL();
  const hasFilters = (urlFilters.min || urlFilters.max || urlFilters.size) ? true : false;
  const hasSearch = q ? true : false;
  
  // Only group by category if on "All" page AND no sort/filter/search applied
  const shouldGroupByCategory = (selCat === 'All' && !hasSort && !hasFilters && !hasSearch);
  
  if (shouldGroupByCategory) {
    // CRITICAL: Separate ALL available and sold items FIRST
    const availableItems = afterFilters.filter(p => p.status !== 'sold');
    const soldItems = afterFilters.filter(p => p.status === 'sold');
    const baseCategoryOrder = ['Tees', 'Jackets', 'Crewnecks & Hoodies', 'Pants'];
    const rotatedCategoryOrder = getDailyRotatedCategories(baseCategoryOrder);
    const orderedAvailable = orderByCategoryRows(availableItems, rotatedCategoryOrder);
    const orderedSold = orderByCategoryRows(soldItems, rotatedCategoryOrder);
    
    if (afterFilters.length === 0) {
      const msg = document.createElement('div');
      msg.className='no-results';
      msg.textContent = 'No items available for your selected filters.';
      container.appendChild(msg);
    } else {
      // Keep sold items at bottom, but rotate category rows so the top does not feel static.
      [...orderedAvailable, ...orderedSold].forEach(p => container.appendChild(createProductCard(p, hasNewStamp(p))));
    }
  } else {
    // No grouping: render in order (sorted/filtered)
    // EXTRA SAFEGUARD: Ensure sold items are always at bottom even if something went wrong above
    const finalAvailable = afterFilters.filter(p => p.status !== 'sold');
    const finalSold = afterFilters.filter(p => p.status === 'sold');
    const finalOrder = [...finalAvailable, ...finalSold];
    
    if (finalOrder.length === 0) {
      const msg = document.createElement('div');
      msg.className='no-results';
      msg.textContent = 'No items available for your selected filters.';
      container.appendChild(msg);
    } else {
      finalOrder.forEach(p => container.appendChild(createProductCard(p, hasNewStamp(p))));
    }
  }
}

// Render after DOM ready
document.addEventListener('DOMContentLoaded', ()=>{
  // Keep initial landing at top on homepage loads (prevents restored scroll landing on About section)
  try {
    if (!window.location.hash && (window.location.pathname === '/' || window.location.pathname.endsWith('/index.html'))) {
      window.scrollTo(0, 0);
    }
  } catch (e) {}

  // Wire up homepage buttons
  const homepageBtns = document.querySelectorAll('.homepage-btn');
  homepageBtns.forEach(btn => {
    let lastActivate = 0;
    const activate = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const now = Date.now();
      // Prevent duplicate route changes from touchend + click firing together.
      if (now - lastActivate < 350) return;
      lastActivate = now;
      const route = btn.getAttribute('data-route');
      if (route) {
        requestAnimationFrame(() => setSelectedCategory(route));
      }
    };

    btn.addEventListener('click', activate);
    btn.addEventListener('touchend', activate, { passive: false });
  });
  
  renderPage();
  startSaleBannerTimer();
  renderPurchaseNotice();
  updateHomeStructuredData();
  // Log a short category summary to the console for verification
  try{ printCategorySummary(); }catch(e){}
  setupSearch && setupSearch();
  setupMenu && setupMenu();
});

// Expose products for debugging/editing in console
window._products = products;
window._stripe = typeof JACKETS_STRIPE_LINK !== 'undefined' ? JACKETS_STRIPE_LINK : '';

// Helper: find product by id (used by product.html)
function getProductById(id){
  return products.find(p => p.id === id);
}
window.getProductById = getProductById;

// Summary helper: counts per category and lists potentially hard-to-classify items
function printCategorySummary(){
  const counts = {};
  CATEGORY_LIST.forEach(c=>counts[c]=0);
  counts['Uncategorized'] = 0;
  const ambiguous = [];
  products.forEach(p => {
    const cat = p.category || 'Uncategorized';
    if (counts[cat] !== undefined) counts[cat] += 1; else counts[cat] = (counts[cat]||0)+1;
    // detect multiple keyword groups present
    const hay = ((p.name||'') + ' ' + (p.description||'')).toLowerCase();
    let hits = 0;
    Object.keys(KEYWORDS).forEach(k=>{ KEYWORDS[k].forEach(kw=>{ if (hay.indexOf(kw) !== -1) hits+=1; }); });
    if (hits > 1 && (!p.__manualCategory)) ambiguous.push({name: p.name, chosen: p.category});
  });
  console.group && console.group('Category summary');
  console.log('Counts:', counts);
  if (ambiguous.length) console.log('Possibly ambiguous items (name + chosen category):', ambiguous);
  console.groupEnd && console.groupEnd();
  return {counts, ambiguous};
}
window.printCategorySummary = printCategorySummary;

// Search UI setup: toggles the search input and wires live filtering
function setupSearch(){
  const toggle = document.getElementById('search-toggle');
  const wrap = document.querySelector('.search-wrap');
  const input = document.getElementById('site-search');
  if (!toggle || !wrap || !input) return;
  let initialQuery = '';
  try {
    initialQuery = new URLSearchParams(location.search).get('q') || '';
  } catch (err) {}
  if (initialQuery) {
    wrap.style.display = 'block';
    toggle.setAttribute('aria-expanded','true');
    input.value = initialQuery;
    window.__productFilter = initialQuery;
    renderProducts();
  }
  toggle.addEventListener('click', ()=>{
    const open = wrap.style.display !== 'none';
    if (open) {
      wrap.style.display = 'none';
      toggle.setAttribute('aria-expanded','false');
      input.value = '';
      window.__productFilter = '';
      try {
        const url = new URL(location.href);
        url.searchParams.delete('q');
        history.replaceState(null, '', url);
      } catch (err) {}
      renderProducts();
    } else {
      wrap.style.display = 'block';
      toggle.setAttribute('aria-expanded','true');
      input.focus();
    }
  });
  let last = '';
  input.addEventListener('input', (e)=>{
    const v = e.target.value || '';
    if (v === last) return;
    last = v;
    window.__productFilter = v;
    try {
      const url = new URL(location.href);
      if (v.trim()) url.searchParams.set('q', v.trim());
      else url.searchParams.delete('q');
      history.replaceState(null, '', url);
    } catch (err) {}
    renderProducts();
  });
}
window.setupSearch = setupSearch;

// Top menu setup: hamburger toggles sidebar; links close menu and handle categories
function setupMenu(){
  const btn = document.getElementById('menu-toggle');
  const panel = document.getElementById('top-menu');
  if (!btn || !panel) return;
  
  const isDesktop = () => window.innerWidth >= 1024;
  const syncMenuState = () => {
    const open = panel.classList.contains('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', open && isDesktop());
    document.body.classList.toggle('menu-open-mobile', open && !isDesktop());
  };
  const openMenu = ()=>{ panel.classList.add('open'); syncMenuState(); };
  const closeMenu = ()=>{ panel.classList.remove('open'); syncMenuState(); };
  btn.addEventListener('click', ()=>{
    const isOpen = panel.classList.contains('open');
    if (isOpen) closeMenu(); else openMenu();
  });
  btn.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
  });
  panel.querySelectorAll('a.menu-link').forEach(a=>{
    a.addEventListener('click', (e)=>{
      // If Home is clicked, reset to homepage
      if ((a.getAttribute('href')||'').replace(/^#/,'').toLowerCase() === 'home') {
        try{
          const url = new URL(location.href);
          url.searchParams.delete('cat');
          url.searchParams.delete('min');
          url.searchParams.delete('max');
          url.searchParams.delete('size');
          history.replaceState(null,'',url);
        }catch(err){}
        window.__hasNavigated = false;
        window.__productFilter = '';
        renderPage();
      }
      if (!isDesktop()) {
        closeMenu();
      }
    });
  });
  // Wire up category buttons in sidebar
  panel.querySelectorAll('button.category-link').forEach(catBtn=>{
    catBtn.addEventListener('click', ()=>{
      const cat = catBtn.getAttribute('data-cat');
      if (cat) {
        setSelectedCategory(cat);
        if (!isDesktop()) {
          closeMenu();
        }
      }
    });
  });
  // Close menu when clicking outside (on the overlay)
  document.addEventListener('click', (e)=>{
    if (!panel.classList.contains('open')) return;
    if (isDesktop()) return;
    if (panel.contains(e.target) || btn.contains(e.target)) return;
    closeMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open')) {
      closeMenu();
    }
  });
  
  if (isDesktop()) openMenu(); else closeMenu();
  
  // Listen for window resize to handle menu state
  window.addEventListener('resize', () => {
    if (isDesktop()) {
      syncMenuState();
    } else {
      closeMenu();
    }
  });
}
window.setupMenu = setupMenu;

// Show a simple post-checkout notice so buyers can quickly find order tracking.
function renderPurchaseNotice(){
  try {
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get('purchase');
    if (!purchase) return;

    const site = document.querySelector('.site');
    if (!site) return;

    const old = document.getElementById('purchase-notice');
    if (old) old.remove();

    const box = document.createElement('div');
    box.id = 'purchase-notice';
    box.style.margin = '0 0 14px 0';
    box.style.padding = '12px 14px';
    box.style.borderRadius = '10px';
    box.style.border = '1px solid rgba(47,37,32,0.1)';
    box.style.background = '#fff';
    box.style.color = '#2f2520';

    if (purchase === 'success') {
      let pendingLookup = null;
      try {
        pendingLookup = JSON.parse(localStorage.getItem('pendingOrderLookup') || 'null');
      } catch (storageError) {
        pendingLookup = null;
      }

      const sessionId = params.get('session_id') || '';
      const itemCode = params.get('item_code') || (pendingLookup && pendingLookup.itemCode) || '';
      const trackParams = new URLSearchParams();
      if (sessionId) trackParams.set('session_id', sessionId);
      if (itemCode) trackParams.set('item_code', itemCode);
      const trackUrl = trackParams.toString()
        ? `order-status.html?${trackParams.toString()}`
        : 'order-status.html';

      if (pendingLookup && pendingLookup.itemCode === itemCode) {
        try {
          localStorage.removeItem('pendingOrderLookup');
        } catch (storageError) {
          console.warn('Could not clear pending order lookup', storageError);
        }
      }

      const lookupHint = itemCode
        ? `We saved item code ${itemCode} for your tracking page.`
        : 'You can check shipping updates anytime.';

      box.innerHTML = `
        <div style="font-weight:700;margin-bottom:4px;">Payment received</div>
        <div style="font-size:0.95rem;color:rgba(47,37,32,0.8);margin-bottom:8px;">Thanks for your order. ${lookupHint}</div>
        <a href="${trackUrl}" style="display:inline-block;padding:8px 12px;border-radius:8px;background:var(--accent);color:#fff;text-decoration:none;font-weight:600;">Track Order</a>
      `;
    } else if (purchase === 'cancelled') {
      box.innerHTML = `
        <div style="font-weight:700;margin-bottom:4px;">Checkout cancelled</div>
        <div style="font-size:0.95rem;color:rgba(47,37,32,0.8);">No payment was made. Your item may still be available.</div>
      `;
    } else {
      return;
    }

    site.insertBefore(box, site.firstChild);
  } catch (err) {
    console.warn('renderPurchaseNotice error', err);
  }
}

// Render the filter panel UI (size options, min/max price)
function renderFilterPanel(){
  const panel = document.getElementById('filter-panel');
  if (!panel) return;
  const filters = getFiltersFromURL();
  // ordered sizes: XS, S, M, L, XL, XXL, then pants numeric 28-42
  const baseSizes = ['XS','S','M','L','XL','XXL'];
  const numericSizes = Array.from({length: (42-28+1)}, (_,i)=>String(28 + i));
  const sizes = baseSizes.concat(numericSizes);
  // compute counts per size (for display) from available products
  const sizeCounts = {};
  products.forEach(p=>{ const s = String(p.size||'').trim(); if (!s) return; sizeCounts[s] = (sizeCounts[s]||0)+1; });
  panel.innerHTML = '';
  const sizeLabel = document.createElement('label'); sizeLabel.textContent = 'Size: '; panel.appendChild(sizeLabel);
  const sizeSel = document.createElement('select'); sizeSel.id = 'filter-size'; sizeSel.style.marginRight='8px';
  const empty = document.createElement('option'); empty.value=''; empty.textContent='Any'; sizeSel.appendChild(empty);
  sizes.forEach(s=>{ const o=document.createElement('option'); o.value=s; const count = sizeCounts[s] || 0; o.textContent = `${s}${count? ` (${count})` : ' (0)'}`; sizeSel.appendChild(o); });
  sizeSel.value = filters.size || '';
  panel.appendChild(sizeSel);

  const min = document.createElement('input'); min.type='number'; min.id='filter-min'; min.placeholder='Min $'; min.value = filters.min || ''; min.style.width='96px'; panel.appendChild(min);
  const max = document.createElement('input'); max.type='number'; max.id='filter-max'; max.placeholder='Max $'; max.value = filters.max || ''; max.style.width='96px'; panel.appendChild(max);

  const actions = document.createElement('div'); actions.className='filter-actions';
  const apply = document.createElement('button'); apply.type='button'; apply.className='apply'; apply.textContent='Apply';
  apply.addEventListener('click', ()=>{
    const f = { min: document.getElementById('filter-min').value||'', max: document.getElementById('filter-max').value||'', size: document.getElementById('filter-size').value||'' };
    setFiltersInURL(f);
    panel.style.display='none';
  });
  const clear = document.createElement('button'); clear.type='button'; clear.textContent='Clear';
  clear.addEventListener('click', ()=>{ setFiltersInURL({min:'',max:'',size:''}); sizeSel.value=''; min.value=''; max.value=''; panel.style.display='none'; });
  actions.appendChild(apply); actions.appendChild(clear); panel.appendChild(actions);
}

// ---- Quick Find by Code Feature ----
function performQuickFind(code){
  if (!code || !code.trim()) return;
  const searchCode = code.trim().toUpperCase().replace(/\s+/g,'');
  const matches = products.filter(p => {
    const pCode = (p.code||'').toUpperCase().replace(/\s+/g,'');
    return pCode === searchCode;
  });
  const msgDiv = document.getElementById('quick-find-message');
  if (!msgDiv) return;
  
  // Remove old highlight
  document.querySelectorAll('.product.quick-find-highlight').forEach(el=>{
    el.classList.remove('quick-find-highlight');
  });

  if (matches.length === 0){
    msgDiv.textContent = 'No item found for that code.';
    msgDiv.style.display = 'block';
  } else if (matches.length === 1){
    const match = matches[0];
    msgDiv.textContent = '';
    msgDiv.style.display = 'none';
    // Find the card in the DOM and highlight it
    setTimeout(()=>{
      const card = document.querySelector(`.product[data-product-id="${match.id}"]`);
      if (card){
        card.classList.add('quick-find-highlight');
        card.scrollIntoView({behavior:'smooth',block:'center'});
        // remove highlight after 3 seconds
        setTimeout(()=>{
          card.classList.remove('quick-find-highlight');
        }, 3000);
      } else {
        msgDiv.textContent = 'Item card not found in rendered products.';
        msgDiv.style.display = 'block';
      }
    }, 0);
  } else {
    msgDiv.textContent = `Found ${matches.length} matching items.`;
    msgDiv.style.display = 'block';
    // highlight all matches
    setTimeout(()=>{
      matches.forEach(match=>{
        const card = document.querySelector(`.product[data-product-id="${match.id}"]`);
        if (card){
          card.classList.add('quick-find-highlight');
          setTimeout(()=>{
            card.classList.remove('quick-find-highlight');
          }, 3000);
        }
      });
    }, 0);
  }
}

// -----------------------
// Fetch Inventory from Supabase
// -----------------------
async function fetchInventoryStatus() {
  if (!supabaseClient) {
    console.warn('Supabase client not initialized. Using local product status.');
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('inventory')
      .select('item_code, status');

    if (error) {
      console.error('Failed to fetch inventory:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.warn('No inventory data found in Supabase.');
      return;
    }

    // Build lookup map: { item_code -> status }
    const inventoryMap = {};
    data.forEach(item => {
      inventoryMap[item.item_code] = item.status;
    });

    // Update products array with database status.
    // Sold always wins so sold items never regress back to available in listings.
    products.forEach(product => {
      const itemCode = product.code || product.id;
      const dbStatusRaw = inventoryMap[itemCode];
      const dbStatus = String(dbStatusRaw || '').trim().toLowerCase();
      const localStatus = String(product.status || '').trim().toLowerCase();

      if (dbStatus === 'sold' || localStatus === 'sold') {
        product.status = 'sold';
      } else if (dbStatus === 'available' || localStatus === 'available') {
        product.status = 'available';
      } else {
        product.status = 'available';
      }
    });

    console.log('Inventory synced from Supabase:', data.length, 'items');
    updateHomeStructuredData();

    // Re-render products only if we're already on a collection page (not homepage)
    if (!isHomepage()) {
      renderProducts();
    }

  } catch (err) {
    console.error('Error fetching inventory:', err);
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  // Wire up quick find button and input
  const btn = document.getElementById('quick-find-btn');
  const input = document.getElementById('quick-find-input');
  if (btn && input){
    btn.addEventListener('click', ()=> performQuickFind(input.value));
    input.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter') {
        e.preventDefault();
        performQuickFind(input.value);
      }
    });
  }

  // Fetch inventory status from Supabase on page load
  fetchInventoryStatus();
  fetchPublishedMarketplaceProducts();
});
