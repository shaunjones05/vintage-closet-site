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

// Product detail pages use this direct lookup so an imported item can always
// render even while the full catalog is still loading in the background.
async function fetchPublishedProductByCode(code) {
  if (!supabaseClient || !code) return null;
  const { data, error } = await supabaseClient
    .from('products')
    .select('code,name,price,size,condition,category,description,images,status,published_at,source_url,source_platform')
    .eq('code', String(code))
    .eq('status', 'published')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // The products record stays published for archive visibility. Inventory is
  // the source of truth for whether the product can still be purchased.
  const { data: inventory, error: inventoryError } = await supabaseClient
    .from('inventory')
    .select('status')
    .eq('item_code', data.code)
    .maybeSingle();
  if (inventoryError) console.error('Could not load inventory status for product detail:', inventoryError);
  const inventoryStatus = String(inventory && inventory.status ? inventory.status : '').trim().toLowerCase();
  return {
    id: data.code, code: data.code, name: data.name, price: Number(data.price), size: data.size || '',
    condition: data.condition || '', category: data.category || 'Vintage Clothing', description: data.description || '',
    images: Array.isArray(data.images) ? data.images : [], status: inventoryStatus === 'sold' ? 'sold' : 'available', published_at: data.published_at,
    sourceUrl: data.source_url, sourcePlatform: data.source_platform
  };
}
window.fetchPublishedProductByCode = fetchPublishedProductByCode;

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
    "ebayUrl": "https://www.ebay.com/itm/318129947929",
    "category": "Tees"
  },
  {
    "id": "eb-318050547196",
    "code": "TEE-7196",
    "name": "Vintage 2004 Ramones Faded Band Tee, CBGB 1978 Graphic, Size M",
    "price": 45,
    "size": "M",
    "condition": "New with tags",
    "description": "Vintage 2004 Ramones faded band tee with CBGB 1978 graphic. Color: Black.",
    "images": [
      "https://i.ebayimg.com/images/g/IJYAAeSwqLFpwfx4/s-l1600.webp",
      "https://i.ebayimg.com/images/g/Qm8AAeSwQytpwfx5/s-l960.webp",
      "https://i.ebayimg.com/images/g/QngAAeSwQytpwfx7/s-l960.webp",
      "https://i.ebayimg.com/images/g/WtIAAeSwzadpwfx9/s-l960.webp",
      "https://i.ebayimg.com/images/g/XWUAAeSwGVBpwfx-/s-l960.webp",
      "https://i.ebayimg.com/images/g/H1kAAeSw4oFpwfyA/s-l960.webp"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318050547196",
    "ebayUrl": "https://www.ebay.com/itm/318050547196",
    "category": "Tees"
  },
  {
    "id": "eb-318075238264",
    "code": "CRW-8264",
    "name": "Vintage Baracuta 3D Knit Coogi Style Merino Wool Sweater XL Earth Tones",
    "price": 80,
    "size": "XL",
    "condition": "New with tags",
    "description": "Vintage Baracuta 3D knit Coogi-style heavyweight merino wool sweater in earth tones. Color: Multicolor.",
    "images": [
      "https://i.ebayimg.com/images/g/H6UAAeSw3DRpyM0G/s-l1600.webp",
      "https://i.ebayimg.com/images/g/zpsAAeSw6sppyM0H/s-l960.webp",
      "https://i.ebayimg.com/images/g/IcsAAeSweARpyM0J/s-l960.webp",
      "https://i.ebayimg.com/images/g/qXUAAeSwin9pyM0L/s-l960.webp",
      "https://i.ebayimg.com/images/g/yUwAAeSwBGxpyM0M/s-l960.webp",
      "https://i.ebayimg.com/images/g/Ir0AAeSwh91pyM0O/s-l960.webp"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318075238264",
    "ebayUrl": "https://www.ebay.com/itm/318075238264",
    "category": "Crewnecks & Hoodies"
  },
  {
    "id": "eb-318075236130",
    "code": "CRW-6130",
    "name": "Vintage 90s Tommy Hilfiger Vertical Stripe Crest Logo Knit Sweater, Men's Medium",
    "price": 40,
    "size": "M",
    "condition": "New with tags",
    "description": "Vintage 90s Tommy Hilfiger vertical stripe crest logo knit sweater. Color: Multicolor.",
    "images": [
      "https://i.ebayimg.com/images/g/sE0AAeSw3ulpyMyD/s-l1600.webp",
      "https://i.ebayimg.com/images/g/rC8AAeSw7AxpyMyF/s-l960.webp",
      "https://i.ebayimg.com/images/g/EBUAAeSwTmlpyMyG/s-l960.webp",
      "https://i.ebayimg.com/images/g/H6QAAeSwh91pyMyH/s-l960.webp",
      "https://i.ebayimg.com/images/g/EUcAAeSwtDdpyMyJ/s-l960.webp",
      "https://i.ebayimg.com/images/g/CX4AAeSw9i1pyMyK/s-l960.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318075236130",
    "ebayUrl": "https://www.ebay.com/itm/318075236130",
    "category": "Crewnecks & Hoodies"
  },
  {
    "id": "eb-318138179928",
    "code": "TEE-9928",
    "name": "Vintage Grateful Dead Steal Your Face Marijuana Tie Dye Shirt",
    "price": 85,
    "size": "L",
    "condition": "New with tags",
    "description": "Vintage Grateful Dead Steal Your Face marijuana tie dye shirt. Color: Tie-Dye.",
    "images": [
      "https://i.ebayimg.com/images/g/MZwAAeSwUg1p2yyl/s-l960.webp",
      "https://i.ebayimg.com/images/g/jrUAAeSwE6hp2yym/s-l960.webp",
      "https://i.ebayimg.com/images/g/LlUAAeSwgAxp2yyo/s-l960.webp",
      "https://i.ebayimg.com/images/g/FF4AAeSwJy5p2yyp/s-l960.webp",
      "https://i.ebayimg.com/images/g/5WgAAeSw0Qpp2yyq/s-l960.webp",
      "https://i.ebayimg.com/images/g/IecAAeSwy6tp2yyr/s-l960.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318138179928",
    "ebayUrl": "https://www.ebay.com/itm/318138179928",
    "category": "Tees"
  },
  {
    "id": "eb-318138241358",
    "code": "TEE-1358",
    "name": "Vintage 1997 Camel Cigarettes Where It's @ Promo T-Shirt",
    "price": 40,
    "size": "XL",
    "condition": "New with tags",
    "description": "Vintage 1997 Camel Cigarettes 'Where It's @' promo t-shirt. Color: Black.",
    "images": [
      "https://i.ebayimg.com/images/g/kmgAAeSweJZp2zEc/s-l1600.webp",
      "https://i.ebayimg.com/images/g/tCcAAeSwv5dp2zEe/s-l960.webp",
      "https://i.ebayimg.com/images/g/Na4AAeSw4G1p2zEf/s-l960.webp",
      "https://i.ebayimg.com/images/g/vEAAAeSweDNp2zEg/s-l960.webp",
      "https://i.ebayimg.com/images/g/O7YAAeSw5M9p2zEh/s-l960.webp",
      "https://i.ebayimg.com/images/g/MBoAAeSwpzNp2zEj/s-l960.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318138241358",
    "ebayUrl": "https://www.ebay.com/itm/318138241358",
    "category": "Tees"
  },
  {
    "id": "eb-318138242114",
    "code": "TEE-2114",
    "name": "Warner Bros. Marvin the Martian Vintage Ringer Tee",
    "price": 45,
    "size": "L",
    "condition": "New with tags",
    "description": "Warner Bros Marvin the Martian vintage ringer tee. Color: White and Red.",
    "images": [
      "https://i.ebayimg.com/images/g/yscAAeSwxahp2zFJ/s-l1600.webp",
      "https://i.ebayimg.com/images/g/lWYAAeSwN8dp2zFK/s-l960.webp",
      "https://i.ebayimg.com/images/g/y7sAAeSwPZBp2zFL/s-l960.webp",
      "https://i.ebayimg.com/images/g/RBwAAeSwq55p2zFM/s-l960.webp",
      "https://i.ebayimg.com/images/g/KCoAAeSwFd5p2zFO/s-l960.webp",
      "https://i.ebayimg.com/images/g/DAQAAeSwLfxp2zFP/s-l960.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318138242114",
    "ebayUrl": "https://www.ebay.com/itm/318138242114",
    "category": "Tees"
  },
  {
    "id": "eb-318138240173",
    "code": "BOTTOMS-0173",
    "name": "Levi's 550 Relaxed Fit Tapered Leg Jeans Dark Wash",
    "price": 35,
    "size": "38W x 30L",
    "description": "Levi's 550 relaxed fit tapered leg jeans in dark wash denim. Classic 90s silhouette with a comfortable relaxed seat and thigh, tapering to the ankle. Great vintage Levi's piece. Color: Blue.",
    "images": [
      "https://i.ebayimg.com/images/g/TJYAAeSwz9pp2zDx/s-l1600.webp",
      "https://i.ebayimg.com/images/g/AXEAAeSwl6Zp2zDz/s-l1600.webp",
      "https://i.ebayimg.com/images/g/r70AAeSwPIZp2zD0/s-l1600.webp",
      "https://i.ebayimg.com/images/g/vBAAAeSwQytp2zD2/s-l1600.webp",
      "https://i.ebayimg.com/images/g/CYUAAeSwLfxp2zD3/s-l1600.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318138240173",
    "ebayUrl": "https://www.ebay.com/itm/318138240173",
    "category": "Pants"
  },
  {
    "id": "eb-318138244113",
    "code": "JACKET-4113",
    "name": "Lauren Ralph Lauren Mixed Quilt Puffer Jacket",
    "price": 45,
    "size": "XS",
    "description": "Lauren Ralph Lauren mixed quilt puffer jacket. Features a quilted body with contrasting panel details. Classic Ralph Lauren quality with a clean, versatile silhouette. Color: Black.",
    "images": [
      "https://i.ebayimg.com/images/g/nHwAAeSwVNVp2zF1/s-l1600.webp",
      "https://i.ebayimg.com/images/g/dNUAAeSwkuZp2zF2/s-l1600.webp",
      "https://i.ebayimg.com/images/g/FHwAAeSwK8Np2zF4/s-l1600.webp",
      "https://i.ebayimg.com/images/g/v54AAeSwEWdp2zF5/s-l1600.webp",
      "https://i.ebayimg.com/images/g/vlwAAeSw2L9p2zF6/s-l1600.webp",
      "https://i.ebayimg.com/images/g/NQwAAeSwjkxp2zF7/s-l1600.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318138244113",
    "ebayUrl": "https://www.ebay.com/itm/318138244113",
    "category": "Jackets"
  },
  {
    "id": "eb-318138177427",
    "code": "BOTTOMS-7427",
    "name": "Vintage Spartan Realtree Camouflage Cargo Hunting Pants",
    "price": 45,
    "size": "32",
    "description": "Vintage Spartan brand Realtree camouflage cargo hunting pants. Classic camo print with functional cargo pockets. Great outdoor workwear piece with serious vintage character. Color: Camo.",
    "images": [
      "https://i.ebayimg.com/images/g/lrEAAeSwrIhp2ywz/s-l1600.webp",
      "https://i.ebayimg.com/images/g/tcEAAeSw25tp2yw0/s-l1600.webp",
      "https://i.ebayimg.com/images/g/BDQAAeSw~adp2yw2/s-l1600.webp",
      "https://i.ebayimg.com/images/g/L4IAAeSwAxtp2yw3/s-l1600.webp",
      "https://i.ebayimg.com/images/g/QpAAAeSwC1Zp2yw5/s-l1600.webp",
      "https://i.ebayimg.com/images/g/tZsAAeSw77xp2yw6/s-l1600.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318138177427",
    "ebayUrl": "https://www.ebay.com/itm/318138177427",
    "category": "Pants"
  },
  {
    "id": "eb-317877525093",
    "code": "TEE-5093",
    "name": "Vintage 1988 INXS Kick Tour Devil Graphic Single Stitch Tee",
    "price": 100,
    "size": "XXL",
    "description": "Vintage 1988 INXS Kick Tour single stitch tee featuring the iconic devil graphic from their legendary Kick album cycle. Rare tour merch from one of the biggest tours of the 80s. Single stitch construction dates this to the era. Size XXL. Color: White.",
    "images": [
      "https://i.ebayimg.com/images/g/8WsAAeSwkWxpj7et/s-l1600.webp",
      "https://i.ebayimg.com/images/g/~ZEAAeSwx-5pj7eu/s-l1600.webp",
      "https://i.ebayimg.com/images/g/ASkAAeSwpHhpj7ew/s-l1600.webp",
      "https://i.ebayimg.com/images/g/9S0AAeSwVZJpj7ex/s-l1600.webp",
      "https://i.ebayimg.com/images/g/-3gAAeSwNgBpj7ey/s-l1600.webp",
      "https://i.ebayimg.com/images/g/tVUAAeSwm2Zpj7e0/s-l1600.webp"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "317877525093",
    "ebayUrl": "https://www.ebay.com/itm/317877525093",
    "category": "Tees"
  },
  {
    "id": "eb-318129946974",
    "code": "BOTTOMS-6974",
    "name": "Patagonia Men's Iron Forge Hemp Canvas Double Knee Work Pants",
    "price": 40,
    "size": "34W x 32L",
    "description": "Patagonia Men's Iron Forge Hemp Canvas Double Knee pants. Made with durable hemp canvas construction and reinforced double knee panels built for real work. Patagonia quality built to last. Color: Tan.",
    "images": [
      "https://i.ebayimg.com/images/g/cCwAAeSwr0Np2Kq5/s-l1600.webp",
      "https://i.ebayimg.com/images/g/LpQAAeSwjkxp2Kq6/s-l1600.webp",
      "https://i.ebayimg.com/images/g/E6sAAeSw~adp2Kq8/s-l1600.webp",
      "https://i.ebayimg.com/images/g/FzYAAeSwfqVp2Kq9/s-l1600.webp",
      "https://i.ebayimg.com/images/g/GjUAAeSwN~xp2Kq-/s-l1600.webp",
      "https://i.ebayimg.com/images/g/PjoAAeSw26hp2KrA/s-l1600.webp"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318129946974",
    "ebayUrl": "https://www.ebay.com/itm/318129946974",
    "category": "Pants"
  },
  {
    "id": "eb-317877520075",
    "code": "TEE-0075",
    "name": "Vintage 90s Grateful Dead Liquid Blue Tie Dye Tee Single Stitch Purple",
    "price": 100,
    "size": "XL",
    "description": "Vintage 90s Grateful Dead Liquid Blue tie dye tee in a stunning purple colorway. Single stitch construction confirms its vintage authenticity. Liquid Blue was the go-to brand for Dead tie dyes — highly collectible. Size XL. Color: Blue.",
    "images": [
      "https://i.ebayimg.com/images/g/tpUAAeSw-Expj7bi/s-l1600.webp",
      "https://i.ebayimg.com/images/g/AN4AAeSwR-xpj7bi/s-l1600.webp",
      "https://i.ebayimg.com/images/g/LWMAAeSwKG5pj7bj/s-l1600.webp",
      "https://i.ebayimg.com/images/g/yrQAAeSw5qJpj7bj/s-l1600.webp",
      "https://i.ebayimg.com/images/g/u4cAAeSwy~xpj7bk/s-l1600.webp",
      "https://i.ebayimg.com/images/g/BJQAAeSw~1Rpj7bk/s-l1600.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "317877520075",
    "ebayUrl": "https://www.ebay.com/itm/317877520075",
    "category": "Tees"
  },
  {
    "id": "eb-317886446378",
    "code": "JACKET-6378",
    "name": "Rare Vintage 80s Adidas Olympic Games Varsity Jacket 1988 Official Outfitter",
    "price": 135,
    "size": "M",
    "description": "Rare vintage 80s Adidas varsity jacket from the 1988 Olympic Games — Adidas was the official outfitter. Exceptional piece of sports history with iconic Adidas trefoil branding. True collector's item. Color: White and Blue.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3421072604_747b63631fd340b0a0ddadf8c0ea13e6/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3421072602_7a32035d6003416a99e966c5cc0f28fc/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3421072601_0cdfe38a298a4f7682bc192e099ff24d/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3421072608_7a39ce44347348a0b209382082386b8c/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3421072603_9505d293015e465f914a13083a0296fe/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3421072606_749f66b14256427cb24ca3908a37f9ce/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3421072607_bd95d3efc15f4a33bde882af832df589/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3421072605_b310d41506744015905db7dd7e56b928/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "317886446378",
    "ebayUrl": "https://www.ebay.com/itm/317886446378",
    "category": "Jackets"
  },
  {
    "id": "eb-318129943524",
    "code": "BOTTOMS-3524",
    "name": "Vintage Carhartt B01 Distressed Double Knee Work Pants",
    "price": 75,
    "size": "32\"",
    "description": "Vintage Carhartt B01 distressed faded double knee duck canvas work pants. The B01 is one of Carhartt's most iconic styles — built bomber-tough with reinforced double knees. Heavy patina from real use. Measurements: 32x33.5, leg openings 9 in. Color: Brown.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3634466644_5a74e5e58a0b4113bcce3191195821fa/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634466646_a85dad31628c4070a67b5fb6752aaecb/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634466645_1896beb23bb645b5928ba7a048be00b0/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634466647_2cf16a313964483cb42b3dfad3d09624/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634466648_6d00316fa80343f5b7ccd4797b716846/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634466653_142b8fb103da44d9aeb5433515d9ded5/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634466654_62cdffe2b60b4e3b9369112ac02f1524/P0.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318129943524",
    "ebayUrl": "https://www.ebay.com/itm/318129943524",
    "category": "Pants"
  },
  {
    "id": "eb-318075245516",
    "code": "CREW-5516",
    "name": "Vintage 80s Discus Athletic Ohio State University Crewneck Sweatshirt Red",
    "price": 40,
    "size": "L",
    "description": "Vintage 80s Discus Athletic Ohio State University crewneck sweatshirt in classic scarlet red. Discus Athletic is a highly sought-after vintage sweatshirt brand known for their thick, quality fleece. Collegiate graphics with great fading. Size L. Color: Red.",
    "images": [
      "https://i.ebayimg.com/images/g/LQoAAeSwUl5pyM7P/s-l1600.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318075245516",
    "ebayUrl": "https://www.ebay.com/itm/318075245516",
    "category": "Crewnecks & Hoodies"
  },
  {
    "id": "eb-318129940774",
    "code": "PANTS-0774",
    "name": "Dickies Vintage Distressed Faded Black Carpenter Pants",
    "price": 40,
    "size": "34\"",
    "condition": "New with tags",
    "description": "Vintage Dickies carpenter pants in faded black with distressed wear and utility pocket details. Color: Black.",
    "images": [
      "https://i.ebayimg.com/images/g/CLwAAeSw0k5p2Kmh/s-l1600.webp",
      "https://i.ebayimg.com/images/g/Bq0AAeSwEaNp2Kmi/s-l1600.webp",
      "https://i.ebayimg.com/images/g/Kh8AAeSw68Fp2Kmj/s-l1600.webp",
      "https://i.ebayimg.com/images/g/IFsAAeSwhIJp2Kml/s-l1600.webp",
      "https://i.ebayimg.com/images/g/F-sAAeSwEeNp2Kmm/s-l1600.webp",
      "https://i.ebayimg.com/images/g/BDYAAeSw3y9p2Kmn/s-l1600.webp"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318129940774",
    "ebayUrl": "https://www.ebay.com/itm/318129940774",
    "category": "Pants"
  },
  {
    "id": "eb-318140597760",
    "code": "TEE-7760",
    "name": "Vintage 1980s Coors Light The Silver Bullet T-Shirt",
    "price": 30,
    "size": "XL",
    "condition": "New with tags",
    "description": "Vintage 1980s Coors Light Silver Bullet graphic T-shirt with classic beer logo print. Color: White.",
    "images": [
      "https://i.ebayimg.com/images/g/sH8AAeSwJfBp29l~/s-l1600.webp",
      "https://i.ebayimg.com/images/g/yQsAAeSwKE5p29mB/s-l1600.webp",
      "https://i.ebayimg.com/images/g/uHAAAeSw88dp29mC/s-l1600.webp",
      "https://i.ebayimg.com/images/g/vHsAAeSwx-Bp29mE/s-l1600.webp",
      "https://i.ebayimg.com/images/g/3pkAAeSwxApp29mF/s-l1600.webp",
      "https://i.ebayimg.com/images/g/rI8AAeSwYbhp29mG/s-l1600.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318140597760",
    "ebayUrl": "https://www.ebay.com/itm/318140597760",
    "category": "Tees"
  },
  {
    "id": "eb-318129933330",
    "code": "PANTS-3330",
    "name": "Carhartt B136 GVL Gravel Grey Double-Knee Duck Dungaree Pants",
    "price": 60,
    "size": "38\"",
    "condition": "New with tags",
    "description": "Carhartt B136 GVL double-knee duck dungaree pants in gravel grey with workwear construction. Color: Gray.",
    "images": [
      "https://i.ebayimg.com/images/g/-i0AAeSwEaNp2KiX/s-l1600.webp",
      "https://i.ebayimg.com/images/g/~VwAAeSwwUlp2KiZ/s-l1600.webp",
      "https://i.ebayimg.com/images/g/-lMAAeSwEaNp2Kia/s-l1600.webp",
      "https://i.ebayimg.com/images/g/ThcAAeSweSZp2Kic/s-l1600.webp",
      "https://i.ebayimg.com/images/g/CyQAAeSw~F5p2Kid/s-l1600.webp",
      "https://i.ebayimg.com/images/g/AJQAAeSw-jZp2Kie/s-l1600.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318129933330",
    "ebayUrl": "https://www.ebay.com/itm/318129933330",
    "category": "Pants"
  },
  {
    "id": "eb-318140601251",
    "code": "TEE-1251",
    "name": "Vintage 1993 Nike Town Orange County Swoosh T-Shirt",
    "price": 45,
    "size": "XL",
    "condition": "New with tags",
    "description": "Vintage 1993 Nike Town Orange County Swoosh graphic T-shirt with single-era 90s styling. Color: Orange.",
    "images": [
      "https://i.ebayimg.com/images/g/0HoAAeSwFd5p29ou/s-l1600.webp",
      "https://i.ebayimg.com/images/g/6KsAAeSw7shp29ow/s-l1600.webp",
      "https://i.ebayimg.com/images/g/x7wAAeSwO6Vp29ox/s-l1600.webp",
      "https://i.ebayimg.com/images/g/ESEAAeSwcVtp29oy/s-l1600.webp",
      "https://i.ebayimg.com/images/g/vmIAAeSw88dp29oz/s-l1600.webp",
      "https://i.ebayimg.com/images/g/bGIAAeSwI3Zp29o0/s-l1600.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318140601251",
    "ebayUrl": "https://www.ebay.com/itm/318140601251",
    "category": "Tees"
  },
  {
    "id": "eb-318140573383",
    "code": "TEE-3383",
    "name": "Vintage 1993 Warner Bros. Bugs Bunny BB Graphic T-Shirt",
    "price": 40,
    "size": "L",
    "condition": "New with tags",
    "description": "Vintage 1993 Warner Bros. Bugs Bunny graphic T-shirt with classic 90s cartoon print. Color: Black.",
    "images": [
      "https://i.ebayimg.com/images/g/udUAAeSw2L9p29a4/s-l1600.webp",
      "https://i.ebayimg.com/images/g/u1AAAeSwE2hp29a6/s-l1600.webp",
      "https://i.ebayimg.com/images/g/kmYAAeSwf2lp29a7/s-l1600.webp",
      "https://i.ebayimg.com/images/g/tLcAAeSwM~Rp29a9/s-l1600.webp",
      "https://i.ebayimg.com/images/g/wRQAAeSw4GVp29a~/s-l1600.webp",
      "https://i.ebayimg.com/images/g/lA8AAeSwmH9p29bA/s-l1600.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "ebayItemNumber": "318140573383",
    "ebayUrl": "https://www.ebay.com/itm/318140573383",
    "category": "Tees"
  },
  {
    "id": "dp-728782825",
    "code": "JACKET-2825",
    "name": "Distressed 1990s Faded Carhartt Detroit Jacket J001 BLK",
    "price": 185,
    "size": "XL",
    "condition": "Brand new",
    "description": "Distressed 1990s faded Carhartt Detroit jacket in black and green. Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3641931418_928c4c02619b4d03920a27a4ea45edd4/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641931419_36df7886ec5f4cf1857af29f7881f583/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641931424_c1075f273107481fb63f15c11184a824/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641931423_dd29c32542944b16b0cdfc7b48e18536/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641931420_7f1aea7706404520948dd174716d81b7/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641931422_52d49755b36d4c9eaf2da0fafbec7703/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641931421_7edc9ba3136946fa9d257096d9d21043/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641931425_8027755c311f462cbe094c9d81114256/P0.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vi1tagecloset_pdx-distressed-1990s-faded-carhartt-detriot-482d/",
    "category": "Jackets"
  },
  {
    "id": "dp-728774231",
    "code": "TEE-4231",
    "name": "Vintage 1970s Champion University of Northern Colorado UNC Bears Football Quarter Sleeve Tee Shirt",
    "price": 40,
    "size": "S",
    "condition": "Good condition",
    "description": "Vintage 1970s Champion University of Northern Colorado UNC Bears Football Quarter Sleeve Tee Shirt Size small Yellow • Streetwear, Sportswear, Retro, 70s, Vintage, preloved * * * ![Image 101: vintagecloset_pdx's profile picture](http://www.depop.com/vintagecloset_pdx/?brandIds=422&productId=728774231) vintagecloset_pdx 1144 sold · Active today (260) [ Color: Yellow.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3641908742_5c82f83be0614632ae1d905cfd21d01e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641908744_b2bddbab47704cb798d37deca0372442/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641908745_a37020b29b5e4bf88b24550bc4677fec/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641908743_df453615392b494789d49288b30ee034/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641908748_7ecae75bfa6f4471b7e184bc936a4766/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641908746_adb09eb538f14a8b9d28453e272c3780/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641908747_5af6df420af24516836c7c6006ebd7bd/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagacloset_pdx-vintage-1970s-champion-university-of-bbcf/",
    "category": "Tees"
  },
  {
    "id": "dp-728773480",
    "code": "TEE-3480",
    "name": "Vintage 1995 Harley-Davidson Motorcycle Gear Graphic Tee",
    "price": 45,
    "size": "L",
    "condition": "Good condition",
    "description": "Vintage 1995 Harley-Davidson Motorcycle Gear Graphic Tee Size L Grey Blue • Cotton, Cotton - Organic • Streetwear, Retro, Indie, 90s, Vintage, preloved * * * ![Image 104: vintagecloset_pdx's profile picture](http://www.depop.com/vintagecloset_pdx/?brandIds=388&productId=728773480) vintagecloset_pdx 1144 sold · Active today (260) [ Color: Gray.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3641906431_c5fb341d410547de9dfe239b42772bb5/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641906429_06d968db5eea446eabe621a0dc4ee859/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641906428_3aa1499a2dd14e29b8e4636fe98e8901/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641906436_6a0036c8afdb421e8e063235555cdb94/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641906434_17f27e4fbb454b19ac10ccd0d3fc0d44/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641906430_17309a9467284fc6a3414b5a62829c2a/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641906433_706603ba6117405c900963b6be7b180e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641906432_156bacb2fef74179ae82942e8534e7a9/P0.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagecloslt_pdx-vintage-1995-harley-davidson-motorcycle-gear-93e6/",
    "category": "Tees"
  },
  {
    "id": "dp-728773041",
    "code": "TEE-3041",
    "name": "Rare 2000s Vintage Radiohead Test Specimen Modified Bear Tee",
    "price": 110,
    "size": "L",
    "condition": "Good condition",
    "description": "Rare 2000’s Vintage Radiohead Test Specimen Modified Bear Tee Size L Blue Grey • Streetwear, Retro, Indie, 90s, Vintage, preloved * * * ![Image 104: vintagecloset_pdx's profile picture](http://www.depop.com/vintagecloset_pdx/?brandIds=1667&productId=728773041) vintagecloset_pdx 1144 sold · Active today (260) [ Color: Gray.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3641903716_637a6ae6a95b4df2824f71338ab915c3/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641903721_740fb402b4a54deab97889cb8edfcdd0/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641903723_c2df4f7117f04257b89ae946edc07105/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641903719_65199460f17041ec86314ba294b0d83a/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641903717_81728aee0cdc4060bcac684450995339/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641903720_3caa33eb7d734c2c83d0df7be693f493/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641903722_60edab5df13140339b0eab72bcc84e91/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641903718_34ff0c74111946e5b209b056a2b2759e/P0.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vinpagecloset_pdx-rare-2000s-vintage-radiohead-test-0ee4/",
    "category": "Tees"
  },
  {
    "id": "dp-728772449",
    "code": "TEE-2449",
    "name": "Vintage 1994 Harley-Davidson Daytona Bike Week Eagle T-Shirt Purple Tee",
    "price": 35,
    "size": "M",
    "condition": "Good condition",
    "description": "Vintage 1994 Harley-Davidson Daytona Bike Week Eagle T-Shirt Purple Tee Mens Medium/Large Navy Blue • Cotton, Cotton - Organic • Streetwear, Retro, Indie, 90s, Vintage, preloved * * * ![Image 104: vintagecloset_pdx's profile picture](http://www.depop.com/vintagecloset_pdx/?brandIds=388&productId=728772449) vintagecloset_pdx 1144 sold · Active today (260) [ Color: Blue.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3641900888_5be710a2e1794890a3a728654246a904/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641900889_0cf6a759461f49c2bd97766079ebef46/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641900895_be93a1260fb94e01b2ce7a665b2429a0/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641900892_2f6d07547bb04c92bb1db614736c8266/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641900891_8aa2d51dbc344d79a39b58834bcae678/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641900890_c974358e35a442c29a7741305e6b6c5d/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641900894_d679e00640714621bff53d97ab2bd47f/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641900893_5be51e84a96b435aa4ec55f692638542/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagecvoset_pdx-vintage-1994-harley-davidson-daytona-bike-2766/",
    "category": "Tees"
  },
  {
    "id": "dp-727496540",
    "code": "PANTS-6540",
    "name": "Levi's SilverTab Loose Fit Baggy Jeans",
    "price": 45,
    "size": "32\"",
    "condition": "Brand new",
    "description": "Levi's SilverTab Loose Fit Baggy Jeans Vintage 90s Levi's SilverTab Loose Fit Baggy Jeans White Denim 32x32 * * * ![Image 91: vintagecloset_pdx's profile picture](http://www.depop.com/vintagecloset_pdx/?brandIds=31&productId=727496540) vintagecloset_pdx 1144 sold · Active today (260) [ Color: Blue.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3634467547_223eec423eac40f8b308c550a3c42d08/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634467548_eeba7edb97c14e1ebf91eedb04b1a153/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634467551_c059d1d5789348a7b70d0f2d4cf41d45/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634467553_43081a0a79f74ee1a9516a055f56ebd2/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634467549_d37e7b938e1a4be4919d208565d963c2/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634467552_655c75a602d1429099b3cf69fabd5294/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634467550_14f7d454a94044349147534cfb4fade6/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vietagecloset_pdx-vintage-90s-levis-silvertab-loose-9587/",
    "category": "Pants"
  },
  {
    "id": "dp-727499209",
    "code": "PANTS-9209",
    "name": "Vintage 90s Levi's SilverTab Loose Fit Denim Jorts",
    "price": 45,
    "size": "34\"",
    "condition": "Like new condition",
    "description": "Vintage 90s Levi's SilverTab Loose Fit Denim Jorts Waist: 34” Blue Navy * * * ![Image 93: vintagecloset_pdx's profile picture](http://www.depop.com/vintagecloset_pdx/?brandIds=31&productId=727499209) vintagecloset_pdx 1144 sold · Active today (260) [ Color: Blue.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3634443893_4b941c79ff274310937e77344355578c/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634443887_649089c705c14ba6b5f7bf0271ea350e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634443890_8780339aadbd4a368ee42b2af7031a12/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634443894_ba5e009bac4f4e31bc42087601a7c92a/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634443888_6f234c5f133c413fbff9cf8d47c0b61d/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634443892_69fb84a9833d4741bbf9d4fd0396208b/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634443891_7b46a0ae1dcf4c8b9a6bcd16225286f7/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634443889_756f17d20b6049729bc54d74e2a56b41/P0.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vvntagecloset_pdx-vintage-90s-levis-silvertab-loose-ca4a/",
    "category": "Pants"
  },
  {
    "id": "dp-690039364",
    "code": "TEE-9364",
    "name": "Vintage 1992 Grateful Dead Spring Tour Liquid Blue Tie Dye T-Shirt",
    "price": 100,
    "size": "XL",
    "condition": "Brand new",
    "description": "Vintage 1992 Grateful Dead Spring Tour Liquid Blue Tie Dye T-Shirt Size XL Vintage 1992 liquid blue single stitch Grateful Dead AOP all over print band tee spring tour shirt XL Color: Blue.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3412409743_cd54bcc9efa149f2bbd5d1b63c5ce071/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3412409746_c3c421fb68654fad92435c470b07e8e3/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3412409748_b7838944450e4e63b08c0b496d43bd39/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3412409742_403bdcf087f34409af8daba37e0ecad6/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3412409744_e4513976e1cf4ea29948986c731bf170/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3412409749_81c0f463875e45efb231dec92876e865/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3412409745_2bc947bd7bbf44c9a843dc7191b34969/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3412409747_2aaf527d50094e78896f5dbad276adee/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagecloset_pdx-vintage-1992-grateful-dead-spring-978e/",
    "category": "Tees"
  },
  {
    "id": "dp-662425627",
    "code": "TEE-5627",
    "name": "VTG 90s Joy Division Band Tee Shirt XL Black Graphic Print Ian Curtis",
    "price": 85,
    "size": "XL",
    "condition": "Brand new",
    "description": "VTG 90s Joy Division Band Tee Shirt XL Black Graphic Print Ian Curtis This is a rare vintage 90s Joy Division band T-shirt in size XL. It features a black graphic print with a short sleeve design and a crew neckline. Made from 100% cotton, this Fruit of the Loom Heavy Tag tee is part of the Joy Division character family, highlighting Ian Curtis. The shirt is machine washable and suitable for all seasons. Originating from the United States, it is a pre-owned item. Keywords: Joy Division, vintage T-shirt, 90s band tee, Ian Curtis, graphic print, black T-shirt, men's fashion, music theme, Fruit of the Loom, XL size, short sleeve, crew neck, cotton jersey, pre-owned, rare find Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3257937390_dccefc30e6e24fc1b32270d3cad5163b/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3257937388_78acc0868427492eac743d1b74f47aad/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3257937387_db1d1a65764f4fee8d21f5a9e52b0d79/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3257937391_798455c6a346494ba6b4df9a79501029/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3257937384_72e0c6e9f55b42719b9d57ba05bbf36d/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3257937386_67fb343a4870453a84845382c0f34d2f/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3257937385_de0dd92603214d11890aff462105d4e9/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3257937389_f50de9c692324084956ca3711b0c14ea/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagecloset_pdx-vtg-90s-joy-division-band/",
    "category": "Tees"
  },
  {
    "id": "dp-720090590",
    "code": "TEE-0590",
    "name": "AC/DC Who Made Who Tour 1986 Vintage Shirt",
    "price": 100,
    "size": "XL",
    "condition": "Brand new",
    "description": "Vintage 1986 AC/DC Who Made Who Tour Band Tee, XL (19x29). Single stitch. Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3634472214_12032b85d3df423ab2085c4eb561f3a9/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634472213_f815b2f6545e4bb7a1e8696d4dbf0b83/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634472216_3c9012069f4d4d6baa78c45de82548a7/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634472218_5104aedb1812406aa31032828b1538e8/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634472215_78bbb4a284f6431ab220f5f1cf3865c5/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3634472217_0b62ba6961fb4ac5a996beee0b8daf7f/P0.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintageclos1t_pdx-vintage-1986-acdc-band-tee-a250/",
    "category": "Tees"
  },
  {
    "id": "dp-729888802",
    "code": "HOODIE-8802",
    "name": "O'Neill Vintage Y2K Graphic Zip-Up Hoodie Waffle Lined",
    "price": 40,
    "size": "XL",
    "condition": "Good condition",
    "description": "O'Neill Vintage Y2K Graphic Zip-Up Hoodie Waffle Lined Size XL Small Stains and signs of wear shown in pics White Grey • Cotton • Streetwear, Retro, Indie, 90s, Vintage, preloved * * * ![Image 104: vintagecloset_pdx's profile picture](http://www.depop.com/vintagecloset_pdx/?brandIds=498&productId=729888802) vintagecloset_pdx 1144 sold · Active today (260) [ Color: White.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3648314468_7a4ce171a2294e699a0addc3e6fee5ef/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648314467_69a6f18e8b5941339f80fbacf3dee3eb/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648314480_f36f0a84dc014da9b5a589ef8090de60/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648314471_12f80ea4d4504893804e430314fa2e1f/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648314473_192613098d4d47259fa673879ec5ef98/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648314474_5e62f848c166473ab7abdeb02b68ee36/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648314476_8481fa42cac14df88d67caf6d7c386c3/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648314472_e6318f2955034f7f82749ed67830c287/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintageclyset_pdx-oneill-vintage-y2k-graphic-zip-up-e3bb/",
    "category": "Crewnecks & Hoodies"
  },
  {
    "id": "dp-729890919",
    "code": "PANTS-0919",
    "name": "Distressed Vintage 1970s Levi's Orange Tab Big Bell Flare Jeans",
    "price": 70,
    "size": "29\"",
    "condition": "Good condition",
    "description": "Distressed vintage 1970s Levi's Orange Tab big bell flare jeans in size 29x30. Color: Orange.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3648324002_c25f6bae5ec74880a6eadb60cf50bd96/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648324008_bd72ed6890a64285a23530a03fa87a18/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648324003_af303806c957410b8ceb816dbace4d90/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648324011_dd6410c5d1c74c15807b8165ecc46fea/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648324007_4dd1fc50587b426e99de21a5384d9124/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648324010_7a591c8e50f24df5a1539759fd072a78/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648324005_b922b65041c74caeb65fb25bd515982c/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648324013_8c83df3f7343484d9683de85ae655db4/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintageclosat_pdx-distressed-vintage-1970s-levis-orange-29c2/",
    "category": "Pants"
  },
  {
    "id": "dp-729892167",
    "code": "TEE-2167",
    "name": "Vintage Starter 1998 Chicago Bulls Repeat 3-Peat NBA Champions Tee",
    "price": 35,
    "size": "XXL",
    "condition": "Good condition",
    "description": "Vintage Starter 1998 Chicago Bulls Repeat 3-Peat NBA Champions XXL White • Cotton, Cotton - Organic • Streetwear, Sportswear, Retro, 90s, Vintage, preloved * * * ![Image 101: vintagecloset_pdx's profile picture](http://www.depop.com/vintagecloset_pdx/?brandIds=23&productId=729892167) vintagecloset_pdx 1144 sold · Active today (260) [ Color: White.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3648336163_7547e69d8d524da5b3e671233b3d2be0/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648336166_602afbe3e9584a5388714643bd75aeff/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648336169_0b415b221d6a40f79c8e677019fa9aca/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648336165_42f6894014ac495aaa230188590ab835/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648336168_57e7c406370f403baa7e5945e866fa76/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648336170_ede5db7205cd439394c4a10f0729a016/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648336167_946d884566fd420d9b4018529ba6051c/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vi5tagecloset_pdx-vintage-starter-1998-chicago-bulls-9698/",
    "category": "Tees"
  },
  {
    "id": "dp-729894480",
    "code": "PANTS-4480",
    "name": "Vintage 1970s Levi's 517 Sta-Prest Bootcut Polyester Trousers Navy",
    "price": 45,
    "size": "36\"",
    "condition": "Good condition",
    "description": "Vintage 1970s Levi's 517 Sta-Prest Bootcut Polyester Trousers Navy W36 L30 Black Navy • Streetwear, Retro, Indie, 70s, Vintage, preloved * * * ![Image 104: vintagecloset_pdx's profile picture](http://www.depop.com/vintagecloset_pdx/?brandIds=31&productId=729894480) vintagecloset_pdx 1144 sold · Active today (260) [ Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3648347451_cb9815564c3d4835a453beddfdea6071/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648347453_5f5c8763e6884a158024d0e32191961c/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648347450_2c8d2e803911437981e945a407e839fe/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648347455_2ce7ccd356e0416889a0723179908026/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648347457_c47ce7708f754a668271dfa29b9be2e1/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648347456_24d0e26f40fa428699ca867e5af05f02/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648347454_f380bfba7a8a40949675d5830c838b32/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648347458_dff73c40c41c48828905d3e05de9b8d4/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintadecloset_pdx-vintage-1970s-levis-517-sta-prest-666a/",
    "category": "Pants"
  },
  {
    "id": "dp-729896462",
    "code": "PANTS-6462",
    "name": "Vintage Levi's 550 Relaxed Fit Orange Tab Jeans Made in USA",
    "price": 40,
    "size": "36\"",
    "condition": "Good condition",
    "description": "Vintage Levi's 550 relaxed fit orange tab jeans made in USA, W36 L32. Color: Orange.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3648357163_1b668b3af2a6400d9368f9056d556fc6/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648357167_b46f104949344c9aace41ed220df23b4/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648357166_d2c3b699cced425185bcb1515d7c9418/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648357173_d0aec5205e1d4105a9925e4562293526/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648357165_6f4289baeaec4b829e1af0891f619064/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648357164_d4748b9302a84e34bfdbb0f206650bbb/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vmntagecloset_pdx-vintage-levis-550-relaxed-fit-59c3/",
    "category": "Pants"
  },
  {
    "id": "dp-729898236",
    "code": "HOODIE-8236",
    "name": "Vintage 90s Russell Athletic Brother Martin Athletics Hoodie",
    "price": 30,
    "size": "L",
    "condition": "Good condition",
    "description": "Vintage 90s Russell Athletic Brother Martin Athletics hoodie in burgundy/red cotton. Color: Red.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3648366357_589283c29c3e4bf2a7b4585056e602c5/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648366350_fcd1a3e8389a49f09a3b1b5a7f7aae46/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648366351_7da9c053ad3f4804a1bf23bd8f15138a/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648366354_e4afc98ced8f41a2981221c286136846/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648366352_ba6c6a6923fe445e81423356bbc2a106/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648366353_8db33d6f802f477697cc2cfe8e083c3d/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3648366359_2c4106c17f344a4c815cda5d7631077b/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vfntagecloset_pdx-vintage-90s-russell-athletic-brother-2848/",
    "category": "Crewnecks & Hoodies"
  },
  {
    "id": "dp-690040970",
    "code": "TEE-0970",
    "name": "Vintage 1985 Prince and the Revolution World Tour Muscle Tank Tee",
    "price": 90,
    "size": "M",
    "condition": "Brand new",
    "description": "Vintage 1985 Prince and the Revolution World Tour single stitch muscle tank tee in size medium. Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3412426858_af9626061ae14ea6b1cc34e75842ac96/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3412426856_092d237ecc7f4f4b8c03cb7ce64a1ebd/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3412426854_100b600856f647da82dc5efdb3ee3d5d/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3412426853_1a9b3ba7964049f0bae4e34f95cf1f4f/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3412426857_47f2b71c61364abfa73a820cedea679c/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3412426861_47aad2e426384ae89682285451e39aae/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3412426852_1ac6e1ca62b643a8863440a847ca9b50/P0.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagecloset_pdx-vintage-1985-prince-and-the-9507/",
    "category": "Tees"
  },
  {
    "id": "dp-715642604",
    "code": "TEE-2604",
    "name": "Vintage 2006 Rob Zombie Educated Horses Tour Shirt w/ Anthrax",
    "price": 45,
    "size": "M",
    "condition": "Brand new",
    "description": "Vintage 2006 Rob Zombie Educated Horses Tour Tee Shirt, Medium (19.5x27.5). Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3568520239_0caf119064e34638bad43c418687db3d/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3568520242_068ade94f48341d4b6f15e6991458955/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3568520246_f002c5f29fd948ef93b3b18b4ffd438d/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3568520240_fc63d615748e49b8960e13c845a8c24d/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3568520244_8d06d1f9dc7048d28ee30f1141e90584/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3568520241_d0cae9130b354a228764cb9ae3bb30d5/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3568520243_44fe7fe5abd4425a903f762565d9edcd/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3568520245_f63be633e02448a7803ab19ba15b26b2/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintageclosem_pdx-vintage-2006-rob-zombie-educated-07de/",
    "category": "Tees"
  },
  {
    "id": "dp-728777657",
    "code": "CREW-7657",
    "name": "Brand New with Tags Polo Ralph Lauren Cable-Knit Quarter-Zip Sweater",
    "price": 60,
    "size": "L",
    "condition": "Brand new",
    "description": "Brand new with tags Polo Ralph Lauren Cable-Knit Quarter-Zip Sweater Black Size L Retail value $225+ Black • Cotton, Cotton - Organic • Streetwear, Retro, Indie, 90s, Vintage, preloved * * * ![Image 104: vintagecloset_pdx's profile picture](http://www.depop.com/vintagecloset_pdx/?brandIds=237&productId=728777657) vintagecloset_pdx 1144 sold · Active today (260) [ Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3641929800_b8993ef3f9f140a49d935cc93d5c6181/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641929801_fd46d0eae2914ddb809dc30ae9e4bdf0/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641929802_4e8770d8da6e41c199a19ccefa5ed424/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641929804_58527f3a5ea246a0abd70b9159bef47d/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641929805_cb479f9056204a52b80aa79287a95467/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641929806_d17acc9419b14b0c86a8818dd38a9705/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641929807_05149c901a164b45924b527ded992db8/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641929808_d6a69d3d122f4760b98da965f94b0a8e/P0.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintageclos3t_pdx-brand-new-with-tags-polo-f23b/",
    "category": "Crewnecks & Hoodies"
  },
  {
    "id": "dp-733268187b",
    "code": "TEE-8188",
    "name": "1980s Vintage Harley-Davidson 3D Emblem Eagle Head Graphic T-Shirt",
    "price": 95,
    "size": "M",
    "condition": "Brand new",
    "description": "1980s Vintage Harley-Davidson 3D Emblem Eagle Head Graphic T-Shirt. Medium. Grey and black cotton tee with classic 3D emblem eagle head graphic. Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3668427747_b11c25d784344eb4a8d2480994cb16e4/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3668427754_54fe73c46d81432ab8e8982070edd843/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3668427744_025443746e0d4819941e4d2d587aa24b/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3668427750_4f9197f0b29944329fa79c2d630355ec/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3668427761_b2e11e9eb3314adaa4e055af0b95ed1e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3668427756_ba2a8b3252be43779e66743b6b96ec94/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3668427758_923412ee64df44b2a03877c59521e93b/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3668427764_be43bf44634e4e1c95277409a59a2bfa/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagecloset_pdy-1980s-vintage-harley-davidson-3d-emblem-47a5/",
    "category": "Tees"
  },
  {
    "id": "dp-728771955",
    "code": "TEE-1955",
    "name": "Arc'teryx Arc'Word Logo Short Sleeve Tee",
    "price": 40,
    "size": "L",
    "condition": "Good condition",
    "description": "Arc'teryx Arc'Word Logo Short Sleeve Tee. Size Large. Black and navy cotton short sleeve t-shirt. Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3641897291_b40e90fa65cb4d7f9a68fbb4c25afe90/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641897294_3c7a4b18f1634edfb040d6be2a0bdd12/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641897289_7387ffbb55c949f688240aab13fb5a48/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641897293_e8a02c834d7e4967a0f2e206bcf92b9e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641897292_ea6639f72ca14c60b0a68c3261378cf0/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641897296_266b55148adc4afeb328ea1357749587/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641897295_349d055dad2046198e64bad0a7fa8b50/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641897297_f03c5f989b5d4b6487f1192b5ef8e7bf/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintageclosetkpdx-arcteryx-arcword-logo-short-sleeve-0cd3/",
    "category": "Tees"
  },
  {
    "id": "dp-737641779",
    "code": "CRW-1779",
    "name": "1980s Vintage Walt Disney Productions Mickey Mouse Raglan Crewneck Sweatshirt",
    "price": 35,
    "size": "M",
    "condition": "Fair",
    "description": "1980s Vintage Walt Disney Productions Mickey Mouse raglan crewneck sweatshirt. Size Medium. White and multicolor cotton sweatshirt with retro 80s graphics. Color: White.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3694506684_b21fb946b8e943a3ab239439e69416bb/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3694506687_5e7e494964934430b4cca4accefa70e0/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3694506686_f661051abbab4e3eb5dc2e802bf55c4f/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3694506689_40f0daaf063f4513bb1883f7606c657b/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3694506695_e7610a4d76054a059b87521a737506f2/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3694506694_07cc6f3c5cad45d78905c0bad5dbfb1f/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3694506692_7beffb8a1fe444cfb8b00d5973f46977/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintageclosjt_pdx-1980s-vintage-walt-disney-productions-3a4c/",
    "category": "Crewnecks & Hoodies"
  },
  {
    "id": "dp-737643216",
    "code": "CRW-3216",
    "name": "1960s/70s Vintage Black Short Sleeve Knit Polo Sweater with Gold Crest Buttons",
    "price": 50,
    "size": "S",
    "condition": "Brand new",
    "description": "1960s/70s vintage black and navy short sleeve knit polo pullover sweater with gold crest buttons. Size Small. Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3694514686_3ac30c5986534263ab9cd5438c58f038/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3694514688_1e7db2af495546c29d8dfae65d45a9c9/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3694514690_61e4decaa02f45e3ae84297680aa5413/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3694514693_8eeb71c50f074db2b6a40926c86b93d4/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3694514697_40ca620fee5e4f3f97c69534219c06a3/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3694514698_5fdae75b23f64d379714d3df041650dc/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3694514696_5fa86928698644cc8fa686e84b526d2f/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintageclose3_pdx-1960s70s-vintage-black-short-sleeve-8e73/",
    "category": "Crewnecks & Hoodies"
  },
  {
    "id": "dp-728773480b",
    "code": "TEE-3481",
    "name": "Vintage 1995 Harley-Davidson Motorcycle Gear Graphic Tee",
    "price": 40,
    "size": "L",
    "condition": "Good condition",
    "description": "Vintage 1995 Harley-Davidson Motorcycle Gear graphic tee. Size L. Grey and blue cotton short sleeve t-shirt. Color: Gray.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3641906431_c5fb341d410547de9dfe239b42772bb5/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641906429_06d968db5eea446eabe621a0dc4ee859/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641906428_3aa1499a2dd14e29b8e4636fe98e8901/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641906436_6a0036c8afdb421e8e063235555cdb94/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641906434_17f27e4fbb454b19ac10ccd0d3fc0d44/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641906430_17309a9467284fc6a3414b5a62829c2a/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641906433_706603ba6117405c900963b6be7b180e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3641906432_156bacb2fef74179ae82942e8534e7a9/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagecloslt_pdx-vintage-1995-harley-davidson-motorcycle-gear-93e6/",
    "category": "Tees"
  },
  {
    "id": "dp-645242187",
    "code": "JKT-2187",
    "name": "Vintage BLK 90s Carhartt Hooded Bomber Jacket",
    "price": 80,
    "size": "XL",
    "condition": "Like new condition",
    "description": "Vintage BLK 90s Carhartt Hooded Bomber Jacket. Size XL. Black canvas cotton jacket with hood and classic workwear styling. Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3160266148_12b4f218c095408f8903aab2f20970ab/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3160266156_ddab81c20df34270a33b2847b366ef63/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3160266155_35a0965ae7bb48c4a13666ebfdd2bd14/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3160266153_e53657a9d51e41659690e2b264c0b142/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3160266149_35ca60e70d104c7693be83c12541d501/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3160266151_6173f4479e3a40a19ad3d5bf38fc6bae/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3160266157_890b39515bbe40b3a630c97336532333/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3160266154_98d7cc2e09b8403683c6bbfea6576dd4/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagecloset_pdx-vintage-blk-90s-carhartt-hooded/",
    "category": "Jackets"
  },
  {
    "id": "depop-e320",
    "code": "DEP-E320",
    "name": "Vintage Faded 1990 3D Emblem",
    "price": 60,
    "size": "S",
    "condition": "Vintage",
    "description": "Vintage faded 1990 Harley-Davidson 3D Emblem tee. Color: Blue.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3880116815_3c2979b1d1254c80b62812fcaf3d74d8/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3880116812_0c58da31db4a45d39e308cf985eb2fbf/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3880116813_7a6d82aeef3c4148a520d3135485f2d6/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3880116816_3eb00a9557304557b4e3e037428f7b1a/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3880116821_1c56e6168f4e4d5291f84c94451d2dcb/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3880116811_a32f0dd0a4444775ac6a805f5f570e8f/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3880116817_b4e5c98c5a29411aa59ec25413e9ff16/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3880116814_d5b4a77ebc9d4b06aa93b69721445c30/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintayecloset_pdx-vintage-faded-1990-3d-emblem-e320/",
    "category": "Tees"
  },
  {
    "id": "depop-b9a4",
    "code": "DEP-B9A4",
    "name": "Vintage 1992 Grateful Dead Lithuania",
    "price": 100,
    "size": "L",
    "condition": "Vintage",
    "description": "Vintage 1992 Grateful Dead Lithuania basketball tee. Color: Tie-Dye.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3837863616_db064ee15aeb40be9e6fce77a0eb5db6/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3837863617_4c318862e3724e12aaaa3709fda93d74/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3837863622_6897e1c242164841b929c611bb651ac2/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3837863624_c90abe1b3cbe405b8f599868888181ff/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3837863618_fd24b3540a9c4896a82c64d0c8a54100/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3837863625_273e07d86d1a4511aef65a0cef70f937/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3837863623_314bc0263f0343abb302a277a43752ad/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3837863620_d10d3e16bf194cf58cd9560243ef26ea/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vidtagecloset_pdx-vintage-1992-greatful-dead-lithuania-b9a4/",
    "category": "Tees"
  },
  {
    "id": "depop-0b4a",
    "code": "DEP-0B4A",
    "name": "Vintage 1992 Bugs Bunny Warner Bros",
    "price": 65,
    "size": "XL",
    "condition": "Vintage",
    "description": "Vintage 1992 Bugs Bunny Warner Bros all-over print tee. Color: Blue and Pink.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3856120258_ea1c7fdcb7b943de90bb3053406471e6/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856120262_684ad49f92854ff8be865b992d8b4de9/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856120279_369d3a143ffe49bf9c08758e31e0dbdf/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856120264_ad3daeabde8c4466a293de01c162db17/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856120286_25b8392c72ed46ecab5722e57d9cd412/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856120273_f59aee0b59d0461aad10283e4ef28215/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856120272_28aaadf7a07f4d8fb837a6021624b537/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856120261_28572e83ab3643d39b62b5afbc97c02f/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagecloget_pdx-vintage-1992-bugs-bunny-warner-0b4a/",
    "category": "Tees"
  },
  {
    "id": "depop-a6db",
    "code": "DEP-A6DB",
    "name": "Vintage 1995 Foo Fighters Roswell",
    "price": 150,
    "size": "M",
    "condition": "Vintage",
    "description": "Vintage 1995 Foo Fighters Roswell UFO tee. Color: White.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3837902924_beaefab19acc4d72b208a5bb71c87ca2/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3837902929_e15ed068a78240d59dc541179825cbe6/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3837902932_4e8ef37d6f5a41539a972d72f02f0a99/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3837902922_bb49c3af51094a9baedeb345afa4846c/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3837902928_171099b16796441b80718d6f961ac3dc/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3837902931_c7d02174f5664fe5afcc3388c283881a/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3837902933_8e4d5d1162364bb2be2054cbf9841c69/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3837902926_42c5454fe6684a7cbc313c8d081421b7/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagecloset_plx-vintage-1995-foo-fighters-roswell-a6db/",
    "category": "Tees"
  },
  {
    "id": "depop-b681",
    "code": "DEP-B681",
    "name": "1990s San Francisco 49ers Red Tee",
    "price": 35,
    "size": "XL",
    "condition": "Vintage",
    "description": "1990s San Francisco 49ers graphic tee. Color: Red.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3856175134_0a6b8a7787594dbca9c4e24240858acc/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856175139_999d41c7830a41a887b232664fa35191/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856175137_cb39966c36e0487ca1cf4507a6ae4d5e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856175135_1688c407f8cb45bc9cbf445144cfca7f/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856175136_5302e78eb6f04f8987d70da8077f2af9/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856175138_8c013e8ae4fc4091a15440bec1f9e396/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagecloset_tdx-1990s-san-francisco-49ers-red-b681/",
    "category": "Tees"
  },
  {
    "id": "depop-6f5b",
    "code": "DEP-6F5B",
    "name": "Vintage 1970s Welgrume Sportswear Knit V-Neck Sweater",
    "price": 35,
    "size": "M",
    "condition": "Vintage",
    "description": "Vintage 1970s Welgrume Sportswear 100% knit V-neck sweater. Color: Blue.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3856162888_c0d192f65f5442ebaa48bdc89445b869/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856162890_934697744a094d1ca1ad9a37e9c00d9a/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856162887_a1ab3d5a25034659854421fa3a779aea/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagec5oset_pdx-vintage-1970s-welgrume-sportswear-100-6f5b/",
    "category": "Tops"
  },
  {
    "id": "depop-c3a6",
    "code": "DEP-C3A6",
    "name": "Vintage 1980s Surf Tee",
    "price": 20,
    "size": "M",
    "condition": "Vintage",
    "description": "Vintage 1980s surf graphic tee. Color: Green.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3856221320_5b3ddf54d9864006924bf17a7972acf2/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856221328_93acf6b4e3e54acfa5d8df20f7fd4b35/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856221324_9c1310e4c21541c9855efd3f8670049e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856221332_530a945d66ac4751858925dca48b7f38/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856221333_58fda637179b4e5e9321102c1f433d01/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856221325_f5b7b6c3ebc24b31bce037b7ef20a119/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagecl2set_pdx-vintage-1980s-surf-tee-vintage-c3a6/",
    "category": "Tees"
  },
  {
    "id": "depop-676f",
    "code": "DEP-676F",
    "name": "Vintage 1990s Phat Farm Corduroy Jacket",
    "price": 35,
    "size": "XL",
    "condition": "Vintage",
    "description": "Vintage 1990s Phat Farm corduroy trucker-style jacket. Color: Tan.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3856153308_87a831ef658141f99e2fb33175027004/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856153281_26950677cdb845a5a1881c8e10f683af/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856153301_7795bffa8f8c4646a67454d5b8f7761b/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856153279_34c46695879144d69e222226f975661e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856153313_70cc63cd3043443e83a7f669b7eabe6b/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3856153311_421cef295102460992bc2315bd56c505/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagecloset_pd5-vintage-1990s-phat-farm-corduroy-676f/",
    "category": "Jackets"
  },
  {
    "id": "depop-c13d",
    "code": "DEP-C13D",
    "name": "Rare Faded Radiohead 2009 Tee",
    "price": 500,
    "size": "L",
    "condition": "Vintage",
    "description": "Rare faded 2009 Radiohead vintage tee.",
    "images": [
      "https://media-photos.depop.com/r1/43131440/3944768798_8d341739cdd249d19fc3ddf7852474eb/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3944768799_b1376182a6514327b89051e410639b25/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3944768810_4141035822fc4399b65a93a1880573d8/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3944768816_7d011fca637f4e0d9034c784ff26d38b/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3944768811_5af8d4482c5b4b47ac0d8872b3221b32/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3944768801_3e18a1a408c141f1a9923135485348de/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3944768805_1d63fca1af554c32b92da4edaed3152c/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3944768807_6f3294ae330e4bfe9cd51d51f6e4a85a/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagecloset_pzx-rare-faded-radiohead-2009-in-c13d/",
    "category": "Tees"
  },
  {
    "id": "depop-28ee",
    "code": "DEP-28EE",
    "name": "Rare Vintage 1993 Slowdive Souvlaki Tee",
    "price": 800,
    "size": "XL",
    "condition": "Vintage",
    "description": "Rare vintage 1993 Slowdive Souvlaki shirt.",
    "images": [
      "https://media-photos.depop.com/r1/43131440/3956004504_02903a0d4dfb4b45af57f064bf58cdae/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3955999795_54b1470d846c4c39b3268692208277a2/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3955999798_db24d610660449d79be5716e23584ee0/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3955999796_2f7cd0689adb47c79c08822cf0bd4463/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3955999800_4aa4816fc933482887be4fa34da4b478/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3955999802_15fec58b3eb140fdb2b968ecd0868922/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3956000826_a939240e3ae948a1bea7dd8f1a0d76bd/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3955999805_4c40a83b132c41b483472478f24109a5/P0.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagacloset_pdx-rare-vintage-1993-slowdive-souvlaki-28ee/",
    "category": "Tees"
  },
  {
    "id": "depop-eab7",
    "code": "DEP-EAB7",
    "name": "1960s OG-107 Military Issued",
    "price": 30,
    "size": "M",
    "condition": "Vintage",
    "description": "1960s OG-107 military issued vintage piece.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/3945988915_8ec7439632cf4e0bbf1d30bd53593e03/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3945988917_071bc1a13a26481a8e50c0a8a35d472f/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3945988923_e60c4ffc2cc1442d9e9c4970c333d0b7/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3945988919_69bf2e5804e1481a88e0780dfe288f8d/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3945988932_50c40affa0ca4d6ea9cd3d78c27f2ebc/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3945988930_0fb4995ffb464223aee292404489e880/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3945988916_9e621a93a19f43c7b16109e327c76f18/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/3945988929_de6cd17dc19040fa9982bceef2fb7aff/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintageclosrt_pdx-1960s-og-107-military-issued-eab7/",
    "category": "Tops"
  },
  {
    "id": "depop-6a76",
    "code": "DEP-6A76",
    "name": "Vintage 1990 Iron Maiden The Trooper Tee",
    "price": 90,
    "size": "M",
    "condition": "Vintage",
    "description": "Vintage 1990 Iron Maiden graphic tee.",
    "images": [
      "https://media-photos.depop.com/r1/43131440/3945977951_22a779823bc2485eac59ae5422e84f13/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945977953_67b47694f8e34f2080cdc92023117a0d/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945977956_d3f8f936b5bd43daab0505df6228f35a/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945977960_589966db458f45bab7d317eec3af11c4/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945977966_0ec45d310a1249ff9215a3c0dfb461c5/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945977965_c0a5ef5b59024111aaf02f97aaa296dc/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945977963_379ad4210660441ab233a84167297b22/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945977958_a917c423070948cfb55ca78a27f9d750/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintggecloset_pdx-vintage-1990-iron-maiden-the-6a76/",
    "category": "Tees"
  },
  {
    "id": "depop-79c7",
    "code": "DEP-79C7",
    "name": "Vintage 1991 Skid Row Slave To The Grind Tee",
    "price": 70,
    "size": "L",
    "condition": "Vintage",
    "description": "Vintage 1991 Skid Row Slave To The Grind shirt.",
    "images": [
      "https://media-photos.depop.com/r1/43131440/3945967492_da208e1a70314d4eae1b701fed224038/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945967494_0577e00e54ef483182d927c6208f480d/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945967503_aceff551174f41a88cc3f6705ae8dafc/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945967514_8334c5e96f4d40ca97da3a488ae7be62/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945967508_7ad91d69439e449895af95c07c128a36/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945967517_3cd3a4ceb8d84aafb5b99cb1d1aea447/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945967499_8e03e7a2a5644803ab07bdf9ce51f0e9/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945967515_baf3edbd775a445a96454c6943f713a6/P0.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagec2oset_pdx-vintage-1991-skid-row-slave-79c7/",
    "category": "Tees"
  },
  {
    "id": "depop-16a6",
    "code": "DEP-16A6",
    "name": "Vintage 1994 Superman DC Comics Tee",
    "price": 45,
    "size": "L",
    "condition": "Vintage",
    "description": "Vintage 1994 Superman DC Comics graphic tee.",
    "images": [
      "https://media-photos.depop.com/r1/43131440/3945956836_46f65f637a7347f98aef128156d81f59/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945956849_5ef0936a17f946c7b8e626f73b4b3d69/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945956878_312be7cccc3646a8930a49d97f51e695/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945956861_2cd3cb02a8bd4edab9c4717c451a64b9/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945956897_fff8e7f21ee7471b9a4e1288b3d63da0/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945956889_2daca19d9891475dbd3da442e5664a8e/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945956838_4ca1db296dd0482aac1441a245b6149c/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945956853_de79a8a6fdeb41fcb40c1b520385de46/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/viftagecloset_pdx-vintage-1994-superman-dc-comics-16a6/",
    "category": "Tees"
  },
  {
    "id": "depop-9436",
    "code": "DEP-9436",
    "name": "Vintage 1989 Batman DC Comics Tee",
    "price": 45,
    "size": "L",
    "condition": "Vintage",
    "description": "Vintage 1989 Batman DC Comics shirt.",
    "images": [
      "https://media-photos.depop.com/r1/43131440/3945942224_bb9b669e4c2244ce8998925dbf0c7429/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945942225_e562a49adb764adbb48a440fa2a9c17a/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945942240_59a495be7f2d48398894e25e7fc41efa/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945942226_03d692eb38d2496cbcebf195a122ae76/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945942231_49664ecb49574c2488c8227b0bf7bece/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945942229_fc5f20d5ca9347e98d57ae4bff6f55b9/P0.jpg"
    ],
    "status": "sold",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintag5closet_pdx-vintage-1989-batman-dc-comics-9436/",
    "category": "Tees"
  },
  {
    "id": "depop-ccb0",
    "code": "DEP-CCB0",
    "name": "Vintage 1991 Chicago White Sox Tee",
    "price": 50,
    "size": "L",
    "condition": "Vintage",
    "description": "Vintage 1991 Chicago White Sox graphic tee.",
    "images": [
      "https://media-photos.depop.com/r1/43131440/3945924689_9214cd9b9b3a4912aac146912d189b89/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945924696_1fa202fd771f45bfa74e1cae793f34a7/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945924690_e56570d6d02b45899e433d251961d6eb/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945924698_5c550db980f14674b337baa473cbebc9/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945924703_080b61709678433b89d3f0932ccca3a2/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945924699_bd8cf3882c4a4e26bf139a5e95469473/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945924695_c93d9735de2b418d853c653d1726d54a/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945924694_9b7acb25573f495289b5f9dcebed7e96/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintageclospt_pdx-vintage-1991-chicago-white-sox-ccb0/",
    "category": "Tees"
  },
  {
    "id": "depop-ba91",
    "code": "DEP-BA91",
    "name": "Vintage 1998 Misfits Bullet JFK Tee",
    "price": 200,
    "size": "L",
    "condition": "Vintage",
    "description": "Vintage 1998 Misfits Bullet JFK shirt.",
    "images": [
      "https://media-photos.depop.com/r1/43131440/3945303234_37647c029dc84133be29da637b66f8c6/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945303232_dab34dc7ff324778ba2f06606d444e46/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945303242_aa74f7009b814fe0afab9f9f93567298/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945303239_0e25e933f5fa43808d0b85ac5839ec66/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945303243_6c81dfdc176648ac868122ce98e59c3b/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945303244_ad7d4291b1d247ec986938f4d904e763/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945303231_3a92af35380d453b8179131912de5ba2/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945303238_da51076829c347d994366d121d4a996e/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagccloset_pdx-vintage-1998-misfits-bullet-jfk-ba91/",
    "category": "Tees"
  },
  {
    "id": "depop-b618",
    "code": "DEP-B618",
    "name": "Vintage Rare 1992 Jimi Hendrix Tee",
    "price": 135,
    "size": "L",
    "condition": "Vintage",
    "description": "Rare vintage 1992 Jimi Hendrix graphic tee.",
    "images": [
      "https://media-photos.depop.com/r1/43131440/3945441489_789d5859e2554d2a8f4c5e9407f2ff3c/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945441492_beb3d9efcf494ea290ab184d209f0a1d/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945441507_213cc265a3ab44e5bcaa767cea52d1c7/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945441499_f54ae547e182499190cfc315e62f47b7/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945441534_46272be8625748258e77e88790808b5e/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945441502_905eb51117514b0ca8f90dd239ea4841/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945441533_d5107e3165424130a30c2c27300942b6/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945441513_576effd22e7b4d03a880c79bfa848ea6/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintagecloset6pdx-vintage-rare-1992-jimi-hendrix-b618/",
    "category": "Tees"
  },
  {
    "id": "depop-15ab",
    "code": "DEP-15AB",
    "name": "Vintage Platinum FUBU Fat Albert Tee",
    "price": 65,
    "size": "XXL",
    "condition": "Vintage",
    "description": "Vintage Platinum FUBU Fat Albert shirt.",
    "images": [
      "https://media-photos.depop.com/r1/43131440/3944871221_aa8ee421092d4d01bc6569a9f1c5cff2/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3944871252_56ab9cecf2d140969cac6821d775bda0/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3944871271_003b44c44fca46cabbedd8d6fa38c9a1/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3944871281_4cf0ba42298f48108eaac5222624f700/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3944871285_47ab6c5aee9f4487abccc745b29d189b/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3944871287_02c00491dc9f449a897ccb88fb8a6311/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3944871295_653431faef7f4309a1d4182164566820/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3944871289_6df2e749f59a44e3abc58ab3d2f00589/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintageclodet_pdx-vintage-platinum-fubu-fat-albert-15ab/",
    "category": "Tees"
  },
  {
    "id": "depop-9a61",
    "code": "DEP-9A61",
    "name": "Vintage 1976 Frank Zappa Zoot Tee",
    "price": 85,
    "size": "L",
    "condition": "Vintage",
    "description": "Vintage 1976 Frank Zappa Zoot shirt.",
    "images": [
      "https://media-photos.depop.com/r1/43131440/3945601547_20f456042fcc404d960aeb1b22faff36/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945601553_54a4b0dfef02469a84ffeea3a2b4017c/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945601557_bf31dbfb55f34b6a90666534303a94a9/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945601583_b7768860e3f34197bb3733147e3da8ff/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945601578_19381556e0b44b8897048a863892e8ed/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945601566_5ed24fd052de42c2bdf5ce7d4f6c61e6/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945601579_c8d4ae54c6644b4d8a364335b5e7d35b/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945601564_b5808b9483eb4352bc766c3cc65468ce/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintageclosdt_pdx-vintage-1976-frank-zappa-zoot-9a61/",
    "category": "Tees"
  },
  {
    "id": "depop-vintagecloset8pdx-vintage-1990s-polo-ralph-lauren-1eec",
    "code": "TEE-1EEC",
    "name": "Vintage 1990s Polo Ralph Lauren Olive Green Cotton Button Up Shirt",
    "price": 40,
    "size": "S",
    "condition": "Fair condition",
    "description": "Vintage 1990s Polo Ralph Lauren olive green cotton button-up shirt. Fits like medium/small. Flaws as seen in photos. Color: Green/Khaki.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/repop_18380792_3874613978/4006744263_ee8de4f1db764e508227e45bfbed0ba3/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/repop_18380792_3874613985/4006744290_b1bb01443e0749b6921f6d3186f0abff/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/repop_18380792_3874613982/4006744295_132621c95ca649b1a8af6766821c403c/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/repop_18380792_3874613990/4006744298_32e9f0b47f974517ba708c50aec2245b/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/repop_18380792_3874613992/4006744276_a2c529cb2d4b4954b74d66c40e1b3458/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintagecloset8pdx-vintage-1990s-polo-ralph-lauren-1eec/"
  },
  {
    "id": "depop-vintagecloset_ndx-2000s-medium-rare-green-weezer-9ada",
    "code": "TEE-9ADA",
    "name": "2000s Medium Rare Green Weezer Band Tee Shirt",
    "price": 40,
    "size": "S",
    "condition": "Fair condition",
    "description": "2000s medium rare green Weezer band tee shirt. Size small, fits medium. Measurements shown in photos. Color: Green.",
    "images": [
      "https://media-photos.depop.com/r1/43131440/4166320519_bb5a972f2f2d4317901d1dd00def20cf/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4166319495_c6d21622738c493b999b28a2fbd1fdea/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4166320078_c37cdeeb843a41d988813be356262c2d/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4166320797_0b2f6eb0cec54433a2fddb2999e38ff3/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4166320613_d90fe0ae15cf4066a7008e93a066884c/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4166320443_0f81e3ba4f3e41799a6328e5904c57ee/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4166320520_5656e1b8d67c4d0d866ac653df40ff10/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4166320796_edfeb997131f41b59de2c9fd5f5ff1f8/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintagecloset_ndx-2000s-medium-rare-green-weezer-9ada/"
  },
  {
    "id": "depop-vintageclose1_pdx-rare-vintage-1996-ok-computer-c9b0",
    "code": "TEE-C9B0",
    "name": "Vintage 1996 Radiohead Band T-Shirt OK Computer Single Stitch",
    "price": 400,
    "size": "L",
    "condition": "Brand new",
    "description": "Rare vintage 1996 OK Computer Radiohead band tee shirt. Made in USA single stitch. Mens large, measurements shown. Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4199634108_30b8782d74b4429c8d98ccc0f18ce18e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4199633486_14b34a7f746d455e89433c125fc73eaa/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4199633919_a2bdf9dd440144d0866651165befb43a/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4199631769_835d899a29474866baff22dfb16c743d/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4199632863_936097514f6949bcbdf6d64c2bbba830/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4199632593_9424cd5d57e74a99b5924644b4b6c2f9/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4199633758_47620f6519a54374b6536352abe8d84f/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4199633842_94766fe8389048fbb9424b0b58d38e9a/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintageclose1_pdx-rare-vintage-1996-ok-computer-c9b0/"
  },
  {
    "id": "depop-vintzgecloset_pdx-vintage-2000s-y2k-era-lebron-4ab7",
    "code": "TEE-4AB7",
    "name": "Vintage 2000s Y2K Era Lebron James Cleveland Cavaliers NBA Jersey #23",
    "price": 40,
    "size": "L",
    "condition": "Fair condition",
    "description": "Vintage 2000s Y2K era Lebron James Cleveland Cavaliers NBA jersey #23. Approx. 18.5 x 27. Large mens. Color: Burgundy/Red.",
    "images": [
      "https://media-photos.depop.com/r1/43131440/4322060845_b36f38520f0e47a0999164963af5972a/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4322061412_45755f858528418590e9cb1ccfa5a012/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4322060316_e8cbe10a4c4f40dba66802eb28c843a3/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4322060184_1f65440542d7470b8755f3589d9ffb78/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4322059985_02ad4642559245e6ac9c7abb98f4e4a4/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4322060846_89613e7757cb4ed9ae26d3c2051df0b0/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4322061112_f7731c1e95fb46f6be1d631eae6594e1/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4322059843_885acd2bd836455b8fbc0f2c76675f89/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintzgecloset_pdx-vintage-2000s-y2k-era-lebron-4ab7/"
  },
  {
    "id": "depop-b948",
    "code": "DEP-B948",
    "name": "Vintage Rare 1980-81 Frank Zappa Tee",
    "price": 110,
    "size": "L",
    "condition": "Vintage",
    "description": "Rare vintage 1980-81 Frank Zappa graphic tee.",
    "images": [
      "https://media-photos.depop.com/r1/43131440/3945262068_3ca94de69e004c6cbae26538973ec5bd/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945262073_b77e7e988e57479b98cfd227e0db8fad/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945262078_d35a89a000ae42e498041d836fb6eac0/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945262092_5832e7c200f14215ba7bee090adb4b55/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945262069_9d02d266a9e441038bfb4d062e995c7d/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945262074_d5b86d21552b44f18f8f873e4d6b91f6/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945262079_1e821bafe90645048b6444d5da21659f/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/3945262080_bfb8978704064a648af830044aba6233/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "depopUrl": "https://www.depop.com/products/vintage6loset_pdx-vintage-rare-1980-81-frank-zappa-b948/",
    "category": "Tees"
  },
  {
    "id": "eb-317669998950",
    "code": "JKT-8950",
    "name": "Lee 1980s True Vintage Faded Distressed Light Wash Denim Jacket Extra Large",
    "price": 60,
    "size": "",
    "description": "1980s, retro, faded, distressed, outerwear, classic, workwear. Features:Button front closure, Two chest flap pockets with button closure, Two side entry pockets, Button cuffs, Adjustable waistband, Signature zig-zag stitching on front placket. Color: Blue.",
    "images": [
      "https://i.ebayimg.com/images/g/4V4AAeSwadlpQ0Z~/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/-LYAAeSwDyppQ0aA/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/xtAAAeSwKcVpQ0aB/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/w78AAeSwmohpQ0aB/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/GiYAAeSwylhpQ0aC/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/qIwAAeSwCQBpQ0aD/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/-SoAAeSwQhFpQ0aD/s-l1600.jpg",
      "https://i.ebayimg.com/images/g/ugUAAeSwdZtpQ0aE/s-l1600.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_JACKETS_LINK",
    "ebayItemNumber": "317669998950",
    "ebayUrl": "https://www.ebay.com/itm/317669998950",
    "category": "Jackets"
  },
  {
    "id": "depop-vinpagecloset_pdx-vintage-dinosaur-jr-white-t-shirt-f935",
    "code": "TEE-F935",
    "name": "Vintage Dinosaur Jr Green Mind Tour Band Tee Grail 1991 Dinosaur Jr",
    "price": 2100,
    "size": "XL",
    "condition": "Good condition",
    "description": "Vintage Dinosaur Jr Green Mind Tour Band Tee Grail 1991 Dinosaur Jr. Green Mind Tour Rare Vintage Grail with the girl smoking graphic. 1991 Dinosaur Jr. White, crew neck, short sleeve. Heavy fraying and wear around the collar and shoulder area. Small repairs around the shoulder, General age and we Color: White/Green.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4362603633_303979ecc2de4b0bbda8a54ed238a387/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4362603956_0c79d792393a4cb280edc637a54e49be/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4362603957_05a28c16699d41c2b42a230f7d080e55/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4362602883_8ef097120b4d4a98ac86c3807ea58ee1/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4362603448_c90a0d73d7a143fdb20bdb47c347a795/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4362604703_90487e431f334647b3f9480c603e97ee/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4362604821_e09d218119e0498a93247dd22cbf3538/P0.jpg",
      "https://media-photos.depop.com/r1/43131440/4363026262_2d5529e7b3f7465caff42c42625d91d6/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vinpagecloset_pdx-vintage-dinosaur-jr-white-t-shirt-f935/"
  },
  {
    "id": "depop-vintagevloset_pdx-carhartt-b73-dst-loose-original-fit-4182",
    "code": "PANTS-4182",
    "name": "Carhartt B73-DST Loose Original Fit Double Knee Denim Work Pants Carhartt B73-DST double knee denim work",
    "price": 60,
    "size": "34",
    "condition": "Good condition",
    "description": "Carhartt B73-DST Loose Original Fit Double Knee Denim Work Pants Carhartt B73-DST double knee denim work pants in blue denim. Loose original fit with carpenter-style details: hammer loop, riveted pockets, and logo patch on the back pocket. Gently used with fading at the knees and some general fabr Color: Blue.",
    "images": [
      "https://i.ebayimg.com/images/g/8ScAAeSwt4Fqboj3/s-l1600.webp",
      "https://i.ebayimg.com/images/g/xksAAeSwU6Vqboj4/s-l1600.webp",
      "https://i.ebayimg.com/images/g/kvQAAeSwWXRqboj5/s-l1600.webp",
      "https://i.ebayimg.com/images/g/eEwAAeSwE55qboj6/s-l1600.webp",
      "https://i.ebayimg.com/images/g/EQcAAeSwWkBqboj6/s-l1600.webp",
      "https://i.ebayimg.com/images/g/dtcAAeSwYJFqboj7/s-l1600.webp",
      "https://i.ebayimg.com/images/g/gRwAAeSwOk1qboj8/s-l1600.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Pants",
    "depopUrl": "https://www.depop.com/products/vintagevloset_pdx-carhartt-b73-dst-loose-original-fit-4182/"
  },
  {
    "id": "depop-vintageclyset_pdx-vintage-iron-maiden-powerslave-graphic-df5a",
    "code": "TEE-DF5A",
    "name": "Vintage Iron Maiden Powerslave Graphic T-Shirt Vintage Iron Maiden Powerslave band tee on a Hanes body",
    "price": 35,
    "size": "S",
    "condition": "Good condition",
    "description": "Vintage Iron Maiden Powerslave Graphic T-Shirt Vintage Iron Maiden Powerslave band tee on a Hanes body. Black short sleeve crew neck, heavyweight cotton. Iron Maiden logo on front, Powerslave Eddie graphic on back. Tagged size S. Gently used with some wash fading throughout, no holes or tears. vin Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4340496746_067d63d85ff2478c8c7ea02caa81b9f5/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340497227_98684a7616404b5f81fb6ab99a38a1ce/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340496665_38bcbaa5f3b84f65af5191a9b67454c2/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340495780_035f2ba42e7d4e87ad88dbb60b47ebc3/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340495178_80560087978f4c4ab8e91461914acbba/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340496590_61699625fc28420ea9549a96e0f16aaa/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340496136_44ccbb5753f748fe9a283d6a940a6981/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340497151_ef5873875c51480ebf48a8c5183f7fc3/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintageclyset_pdx-vintage-iron-maiden-powerslave-graphic-df5a/"
  },
  {
    "id": "depop-vintageclosmt_pdx-vintage-1992-nirvana-smiley-logo-41ef",
    "code": "TEE-41EF",
    "name": "Vintage 1992 Nirvana Smiley Logo Graphic Hoodie 1992 Nirvana pullover hoodie in black with the yellow smiley",
    "price": 280,
    "size": "M",
    "condition": "Good condition",
    "description": "Vintage 1992 Nirvana Smiley Logo Graphic Hoodie 1992 Nirvana pullover hoodie in black with the yellow smiley face graphic on the front. Copyright 1992 print. Kangaroo pocket, pullover style. Gently used with minor wear. Some fading on the fabric and graphic. Small holes near the neckline and near Color: Black/Yellow.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4340483830_8e81ce3e3e03482daa405e18b829e03e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340482460_0675fd1fafae4c508d857264be295ee0/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340483525_7e13a4903c36473ca19a6e0d87628cc7/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340483660_73e490ab4b6a4ba3abe1ceb653c55333/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340479780_1757ac0e8f664e2fa66a5c5f0cef7a62/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340482773_45eb65134b0740afbf7e02dd2efe06ae/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340481487_34680a5f644341198c965dacaf2dcf1a/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340483075_a6fe95ace3bb45d39b1351f9f41143bb/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Crewnecks & Hoodies",
    "depopUrl": "https://www.depop.com/products/vintageclosmt_pdx-vintage-1992-nirvana-smiley-logo-41ef/"
  },
  {
    "id": "depop-vintagecroset_pdx-vintage-jesse-james-work-wear-3f73",
    "code": "TEE-3F73",
    "name": "Vintage Jesse James Work Wear West Coast Choppers Plaid Short Sleeve Pearl-Snap Shirt Jesse James Work Wear",
    "price": 40,
    "size": "L",
    "condition": "Good condition",
    "description": "Vintage Jesse James Work Wear West Coast Choppers Plaid Short Sleeve Pearl-Snap Shirt Jesse James Work Wear collab with West Coast Choppers. Short sleeve western shirt in navy and white plaid. Pearl-snap buttons, western yoke cut. West Coast Choppers patch on the chest pocket and logo graphic on t Color: White/Navy.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4340459360_cd98126bca634e53a389173c354a3417/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340460517_ef99c39b8aab42719d062a181662047a/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340459362_e99d116991a740fe88fda3d0fceb6440/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340457889_3afa9c881c354a2d94d9b6e7fcafff55/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340460086_42297f1d3686442f880a15ccd6bb6007/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340459479_c7908effdb5548fdb436b1fe3956101f/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340460922_74213572265f4e50a129d46f17384050/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4340459694_dad1c89b1818424a84fc97831950f433/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintagecroset_pdx-vintage-jesse-james-work-wear-3f73/"
  },
  {
    "id": "depop-vintaaecloset_pdx-vintage-2005-danzig-il-demonio-880e",
    "code": "TEE-880E",
    "name": "Vintage 2005 Danzig Il Demonio Nera Band T-Shirt Chaser-branded Danzig Il Demonio Nera band tee from 2005",
    "price": 40,
    "size": "M",
    "condition": "Good condition",
    "description": "Vintage 2005 Danzig Il Demonio Nera Band T-Shirt Chaser-branded Danzig Il Demonio Nera band tee from 2005. Black, short sleeve, crew neck with skull graphic on front. Copyright reads 2005 Glenn Danzig / Evilive Music. Pre-owned with no visible wear. Small spot of discoloration near the bottom grap Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4331597043_c33193806de645d1985c40e7765f6c43/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4331597329_c3837f8f67a844aeb5702273a0e5c6ff/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4331596926_c7067070889142a4965e129dcc6dc213/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4331597910_3e7ad2d9c8134aa7a8258a8f0330bc8d/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4331595356_18d71b1ab2714eda8692cf7ec92407ce/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4331595968_ba3e3cefff6649b486a724c107972662/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4331595855_731bbb3d55f042589d3d0c853bb89ac9/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4331597231_3c947eba3e69449399ad237cfa604ad9/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintaaecloset_pdx-vintage-2005-danzig-il-demonio-880e/"
  },
  {
    "id": "depop-vintagecdoset_pdx-vintage-interstate-denim-jorts-baggy-7c58",
    "code": "PANTS-7C58",
    "name": "Vintage Interstate Denim Jorts Baggy Skater Shorts Size 36 Vintage Interstate denim jorts in a baggy skater",
    "price": 50,
    "size": "36",
    "condition": "Good condition",
    "description": "Vintage Interstate Denim Jorts Baggy Skater Shorts Size 36 Vintage Interstate denim jorts in a baggy skater cut. Blue denim, waist 36. Embroidered IS logo on the back pocket. Leather-style patch at the back waist. Interstate side tab label intact. Pre-owned with no visible wear. No holes, no frayi Color: Blue/Navy/Red.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4325138969_febe2642584d4142b89a5100748e2d06/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4325137688_5d6434beffd74b64aee7eac17e2eb73c/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4325140941_c4c37ec7a7f946a4add019c888f6018b/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4325140047_dfe74680acbd4aa29af1bfbb5b1cddad/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4325138970_3a40639235514ccda1928fa2375a6a5b/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4325141903_658628cd07134a8fb7135c48f59e7b4e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4325139634_fcee5064276547a1b833df8cf72eeb23/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4325139760_2c371816851c4052b9073d6b87a4a07d/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Pants",
    "depopUrl": "https://www.depop.com/products/vintagecdoset_pdx-vintage-interstate-denim-jorts-baggy-7c58/"
  },
  {
    "id": "depop-vintagecnoset_pdx-vintage-90s-usa-thunder-leader-5440",
    "code": "TEE-5440",
    "name": "Vintage 90s USA Thunder Leader of the Pack Motorcycle Wolf Graphic T-Shirt Vintage Caribbean Dream graphic",
    "price": 45,
    "size": "L",
    "condition": "Good condition",
    "description": "Vintage 90s USA Thunder Leader of the Pack Motorcycle Wolf Graphic T-Shirt Vintage Caribbean Dream graphic tee from the 90s. Black with a wolf and motorcycle print on the front. 100% cotton, crew neck, short sleeve. Made in El Salvador. Tagged L. Measures 29 inches long, 24 inches pit to pit. Gent Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4323905826_16e6f8cd9fc34e4b8f08fcdd38396b73/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323901395_33f64b6b4a904e429320dfd79fdf76db/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323902972_172f2d25e81d471f8c615c9eccaee2b9/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323902562_0d0409d2da2a45a199c8681abca8c88a/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323904073_ceb27a24ff864322bade36ccb48d6d29/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintagecnoset_pdx-vintage-90s-usa-thunder-leader-5440/"
  },
  {
    "id": "depop-vintagecloset_pdx-vintage-90s-sunrise-sportswear-the-03b0",
    "code": "TEE-03B0",
    "name": "Vintage 90s Sunrise Sportswear The Legend White Buffalo Lightning Graphic T-Shirt Vintage 90s Sunrise",
    "price": 60,
    "size": "XL",
    "condition": "Good condition",
    "description": "Vintage 90s Sunrise Sportswear The Legend White Buffalo Lightning Graphic T-Shirt Vintage 90s Sunrise Sportswear graphic tee. Black, 100% cotton, short sleeve. Graphic reads \"The Legend Comes To Life The Return Of The North American White Buffalo\" with a white buffalo and lightning print. Tagged X Color: White/Black/Blue.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4323888952_8e7d0d2919494bf6be341185b17e9cef/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323888558_dbb9559611cd4eccb4f4fffe988b1a8a/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323890033_ad296d3cd7cf42bca45c112e95d7a3bb/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323890417_da4e71a2b4e043bcada63d94a41a0b6b/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323889231_dca58ef44f594effa1b3ad9b99a22d68/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323889950_0a62a8e7bef54540958105f4f1ed5432/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintagecloset_pdx-vintage-90s-sunrise-sportswear-the-03b0/"
  },
  {
    "id": "depop-vcntagecloset_pdx-jnco-the-low-down-wide-dc4f",
    "code": "PANTS-DC4F",
    "name": "JNCO The Low Down Wide Leg Denim Jeans JNCO The Low Down wide leg denim jeans in medium wash blue",
    "price": 85,
    "size": "34",
    "condition": "Good condition",
    "description": "JNCO The Low Down Wide Leg Denim Jeans JNCO The Low Down wide leg denim jeans in medium wash blue. RN 13965. Back pocket logo patch and front coin pocket logo tab. Gently used with minor wash wear. Fraying at both leg hems. No size tag visible, measure before buying. Color: Blue.",
    "images": [
      "https://i.ebayimg.com/images/g/1xQAAeSwNwVqa8j2/s-l1600.webp",
      "https://i.ebayimg.com/images/g/nzwAAeSwEFNqa8j3/s-l1600.webp",
      "https://i.ebayimg.com/images/g/5R8AAeSwQBhqa8j4/s-l1600.webp",
      "https://i.ebayimg.com/images/g/OA0AAeSwvTxqa8j5/s-l1600.webp",
      "https://i.ebayimg.com/images/g/VO0AAeSwKzZqa8j5/s-l1600.webp",
      "https://i.ebayimg.com/images/g/V8oAAeSwU6Vqa8j6/s-l1600.webp",
      "https://i.ebayimg.com/images/g/A6EAAeSwUIlqa8j7/s-l1600.webp"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Pants",
    "depopUrl": "https://www.depop.com/products/vcntagecloset_pdx-jnco-the-low-down-wide-dc4f/"
  },
  {
    "id": "depop-vintageclose7_pdx-vintage-status-quo-double-sided-c61d",
    "code": "TEE-C61D",
    "name": "Vintage Status Quo Double Sided Graphic Rock Band T-Shirt Status Quo band tee from Rock Revolucion",
    "price": 40,
    "size": "Other",
    "condition": "Good condition",
    "description": "Vintage Status Quo Double Sided Graphic Rock Band T-Shirt Status Quo band tee from Rock Revolucion. Black short sleeve crew neck with double sided print. Status Quo graphic on the front, The Number One print on the back. Gently used with some fading throughout and light cracking on the graphics. S Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4323775946_57783d817a4e4c9cbae5391fc21c8582/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323776449_c8885f79a7fc47b382698dc0f0cf0c2b/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323777398_93a1da32d3b7409fbc664af407f40bd7/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323777399_8518d6da76904a60b7c9e7888cec7e76/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323774835_30f2b9b662044cceba1631e567e0e812/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323776820_1a3e48354a474d6b976015219651a374/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323777035_d4004984abd84cacb792e9d428824247/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintageclose7_pdx-vintage-status-quo-double-sided-c61d/"
  },
  {
    "id": "depop-vintagycloset_pdx-vintage-1998-liquid-blue-kevin-b194",
    "code": "TEE-B194",
    "name": "Vintage 1998 Liquid Blue Kevin Nash NWO Wolfpac Graphic T-Shirt 1998 Liquid Blue Kevin Nash nWo Wolfpac",
    "price": 70,
    "size": "XL",
    "condition": "Good condition",
    "description": "Vintage 1998 Liquid Blue Kevin Nash NWO Wolfpac Graphic T-Shirt 1998 Liquid Blue Kevin Nash nWo Wolfpac graphic tee. Black 100% cotton, crew neck, short sleeve. WCW copyright on tag dated 1998. Kevin Nash and wolf graphics on the front. Gently used with some light fading to the black fabric. No ho Color: Black/Blue.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4323740000_4a109ea2a5d941428eb9da9329ff4a63/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323740103_c1ca2d172c0e46de91ede14ac92f2128/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323736081_ef3746e08af04ab3ab2ceaf3901c0642/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323739708_5e89025897c1407b94e4efcf6b2f61a4/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323739468_b4bcbaecfb55469ea5a77376dd3fe0db/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323739160_4c644e4e9d1e4df29145aeb5688b8662/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323740197_04bf4d2ecf004e1badc0486e005ea201/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintagycloset_pdx-vintage-1998-liquid-blue-kevin-b194/"
  },
  {
    "id": "depop-vintageclrset_pdx-2005-vintage-misfits-skull-fiend-2f9d",
    "code": "TEE-2F9D",
    "name": "2005 Vintage Misfits Skull Fiend Club Band T-Shirt 2005 Misfits Skull Fiend Club band tee by Chaser",
    "price": 40,
    "size": "S",
    "condition": "Good condition",
    "description": "2005 Vintage Misfits Skull Fiend Club Band T-Shirt 2005 Misfits Skull Fiend Club band tee by Chaser. Black short sleeve crew neck with Misfits skull graphic on front. Copyrighted 2005 Glenn Danzig/Evilive Music. Pre-owned with no visible wear. Graphic is clean with no cracking or peeling. vintagec Color: Black/Blue.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4323696244_edcd839b5aab4e368fb1a04abb138f81/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323696125_55c7fd665fe641f3b306aee07dd0de22/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323696431_c049a46f52004bf8a7004e163aafbdde/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323697020_cec597a2bbd74e7595d8988dbd8c71e2/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323697399_21e171ab1147431099811c4339769b1e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323697401_f3893e49a7764ce090229bc33bf2b834/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323695149_b551d98639714fbd8eeca05dbbe4d729/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323693083_015b328b74054ccdbd63aefd5f01a0d3/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintageclrset_pdx-2005-vintage-misfits-skull-fiend-2f9d/"
  },
  {
    "id": "depop-vintageclolet_pdx-vintage-nwa-ice-cube-t-caa2",
    "code": "TEE-CAA2",
    "name": "Vintage NWA Ice cube T shirt 90s Single stitch Rap Tee Mens large Bootleg Vintage 90s NWA bootleg rap tee",
    "price": 135,
    "size": "L",
    "condition": "Good condition",
    "description": "Vintage NWA Ice cube T shirt 90s Single stitch Rap Tee Mens large Bootleg Vintage 90s NWA bootleg rap tee. White crew neck with graphic print of Eazy-E, Dr. Dre, Ice Cube, and MC Ren. Single stitch construction throughout. Tagged Large. Measures 27 inches in length. Pre-owned with no visible wear. Color: White/Blue.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4323684389_f45877e875de4b3fa7b8d515d12c0bcf/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323684954_559f81f74f2e47ba84f738377bc81427/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323683772_934746994722443ab8e17e78d18675d9/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323686236_4838082e5d9a4f0abc0bce3c80a45750/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323686317_589e6a8dc4f84726ad4f955b41e6f011/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323685422_4ab5d15b21d64dbc8763a3d4be697987/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323685027_f8493dbf33db458b859e9caa23c59163/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323685028_c8291ccf8b6c417989a3dd3eaf7a85f1/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintageclolet_pdx-vintage-nwa-ice-cube-t-caa2/"
  },
  {
    "id": "depop-vintageclopet_pdx-vintage-rob-zombie-spooks-a-poppin-triple-b793",
    "code": "TEE-B793",
    "name": "Vintage Rob Zombie Spooks-A-Poppin Triple Shock Scream Show Long Sleeve Graphic T-Shirt Vintage Rob Zombie",
    "price": 35,
    "size": "L",
    "condition": "Good condition",
    "description": "Vintage Rob Zombie Spooks-A-Poppin Triple Shock Scream Show Long Sleeve Graphic T-Shirt Vintage Rob Zombie Spooks-A-Poppin Triple Shock Scream Show long sleeve tee. Black Gildan Ultra Cotton, 100% cotton. Graphic print on the front and left sleeve. Tagged size L. Length is 29 inches. Gently used w Color: Cream/Black/Blue.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4323670221_44fedd03d41d40ab90e5b9ecff9a9b01/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323670608_9f8b24f38e3d486fa8561ed845685bee/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323668574_40f47a2b99194030bf2b2d763a0e10db/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323671498_0abef578704c456dabad14b92f19ad7b/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323668575_3a5fbd0edff947c38032ec968be51355/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintageclopet_pdx-vintage-rob-zombie-spooks-a-poppin-triple-b793/"
  },
  {
    "id": "depop-vintagecnoset_pdx-rare-vintage-2005-snoop-dogg-d791",
    "code": "TEE-D791",
    "name": "Rare Vintage 2005 Snoop Dogg Rap tee -shirt size XL 2005 Snoop Dogg rap tee on a Gildan blank",
    "price": 80,
    "size": "XL",
    "condition": "Good condition",
    "description": "Rare Vintage 2005 Snoop Dogg Rap tee -shirt size XL 2005 Snoop Dogg rap tee on a Gildan blank. Black, 100% cotton, crew neck, short sleeve. Copyright date 2005, made in Honduras. Graphic has cracking on the screen print. General wear from age. Pre-owned, used-good condition. vintagecloset_pdx 1161 Color: Black/Blue.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4323419385_87d26c04284c4fb38b73fd5dbe74149b/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323422451_85bd551d4bbd41a9b101470dac273840/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323422084_51b542f20f564088a9e91986a79e5b75/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323420592_c73655a6862b4919b3eda9d6ae20a601/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323422828_3e4b214408534b60b1185395c3fb8a2d/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323422657_672f22d493bb4436b3520b6313a83a01/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323421781_f30a48d1a9124dbca32c0eda8166579f/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintagecnoset_pdx-rare-vintage-2005-snoop-dogg-d791/"
  },
  {
    "id": "depop-vintageclosetlpdx-rare-vintage-90s-the-doors-0271",
    "code": "TEE-0271",
    "name": "RARE Vintage 90s The Doors Jim Morrison MOSQUITO HEAD STYLE Graphic Tee Shirt Vintage 90s The Doors double",
    "price": 230,
    "size": "L",
    "condition": "Good condition",
    "description": "RARE Vintage 90s The Doors Jim Morrison MOSQUITO HEAD STYLE Graphic Tee Shirt Vintage 90s The Doors double sided graphic tee. Jim Morrison print on front, second graphic on back. Black short sleeve, heavyweight cotton feel. Gently used with minor wear. Some light fading and soft wash-in throughout Color: Black/Blue.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4323384358_c91dbcc36024498ba76e0cd77e628687/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323386653_eff1fee2dfa446a39265deae44b69641/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323385978_51c37b25264241b1a622935a2411a167/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323385979_1c2d4377f6044e12a6924576c5ce49c3/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323384269_3af163fdbd9f44cc98806d32bf736ec1/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323387024_100f118538604f7fbd55a5623d056c92/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323386156_ece124da9f294028aed1d7307b004a63/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323384270_84369ec54f1147b3a9414b4e78ced80e/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintageclosetlpdx-rare-vintage-90s-the-doors-0271/"
  },
  {
    "id": "depop-vintagecloset_sdx-vintage-late-90s-distressed-street-67fe",
    "code": "TEE-67FE",
    "name": "Vintage late 90s distressed Street Fighter Ringer T-Shirt on Delta Pro Weight Vintage Street Fighter Ryu",
    "price": 160,
    "size": "L",
    "condition": "Good condition",
    "description": "Vintage late 90s distressed Street Fighter Ringer T-Shirt on Delta Pro Weight Vintage Street Fighter Ryu graphic tee on a Delta Pro Weight ringer blank. White base with maroon collar and sleeve trim. Short sleeve. Tagged size L. Length is 29.5 inches. Gently used with minor wear. Some general fadi Color: White/Blue/Maroon.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4323257934_b81b68389a5b4ece80e980b3844297f6/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323256961_85f2434811a24653a7f6e775a4fb3dd9/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323258214_92d47d918e634b889842fd608ca6b5f0/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323258313_df9922ae0d83430d85e7dd17a78e82f5/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323257827_13d5ff0ba781405ba3f528b5ab7ca7a0/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323256686_ba2aed75533a4797994abdb02f2fa7a7/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323257155_f02586d8284f4325bec1f30e4c279b27/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintagecloset_sdx-vintage-late-90s-distressed-street-67fe/"
  },
  {
    "id": "depop-vintagecloset_pds-vintage-1988-mighty-mouse-here-a8e2",
    "code": "TEE-A8E2",
    "name": "Vintage 1988 Mighty Mouse Here I Come To Save The Day T-Shirt 1988 Mighty Mouse \"Here I Come To Save",
    "price": 60,
    "size": "L",
    "condition": "Good condition",
    "description": "Vintage 1988 Mighty Mouse Here I Come To Save The Day T-Shirt 1988 Mighty Mouse \"Here I Come To Save The Day\" tee by Stanley DeSantis. Licensed by Viacom International Inc. White short sleeve, 100% preshrunk combed cotton. Tagged large. Pre-owned with no visible wear. Color: White/Tan.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4323112962_e72d0558551b4d978fdf8952451e6c53/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323113790_6c30b39d87dd4e6d85358849182b6fe8/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323111987_b9cf142b34334e27b08ed971f9c3ae95/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323112194_419890b1e3554c848b9d173c95b6d822/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323112648_73bb600c73224772ac0c8f7f8ea95d6b/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323113853_8c653ff3d7a24dc7918cf0ec8ff0073e/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4323112387_bafa297a573b44af840763418cc29a72/P0.jpg"
    ],
    "status": "available",
    "stripeLink": "https://buy.stripe.com/REPLACE_WITH_YOUR_LINK",
    "category": "Tees",
    "depopUrl": "https://www.depop.com/products/vintagecloset_pds-vintage-1988-mighty-mouse-here-a8e2/"
  },
  {
    "id": "depop-vintagecl8set_pdx-2005-misfits-records-meet-the-a7b2",
    "code": "TEE-A7B2",
    "name": "2005 Misfits Records Meet The Nutley Brass Fiend Club Lounge T-Shirt 2005 Misfits Records Meet The Nutley",
    "price": 40,
    "size": "S",
    "condition": "Good condition",
    "description": "2005 Misfits Records Meet The Nutley Brass Fiend Club Lounge T-Shirt 2005 Misfits Records Meet The Nutley Brass Fiend Club Lounge t-shirt in size Small. Black 100% cotton, crew neck, short sleeve. Graphic print on front, copyright date reads 2005. Pre-owned with no visible wear. Print is clean, no Color: Black.",
    "images": [
      "https://media-photos.depop.com/b1/43131440/4322746717_4b8db97f881149dc8d7bc46e37ba5b39/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322746831_0a9cd91c6fc04e6d8bec372845e373fc/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322746515_6c9d2ce889a04586b2d4132774579fc6/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322747801_69e8f1712d6e45369f1df27cebc3e663/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322745925_fb479abc5ab54969b2e136b35a296800/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322745828_73ee0c1916b644f1aa24a90fe5de2869/P0.jpg",
      "https://media-photos.depop.com/b1/43131440/4322746924_bd062497fbab42e399758dc985ec6a46/P0.jpg",
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
    
    const newBadge = showNewBadge ? '<span class="badge-new">New drop ✦</span>' : '';
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
    const newBadge = showNewBadge ? '<span class="badge-new">New drop ✦</span>' : '';
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

// Keep a fresh-arrival marker on recent marketplace imports wherever they appear:
// All listings, category pages, search results, and New Arrivals.
const NEW_LISTING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
function isNewMarketplaceListing(product){
  const publishedAt = Date.parse(product && product.published_at ? product.published_at : '');
  return Number.isFinite(publishedAt) && publishedAt >= (Date.now() - NEW_LISTING_WINDOW_MS);
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

  const hasNewStamp = p => isNewMarketplaceListing(p);
  
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
