const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SALE_DISCOUNT_RATE = 0.15;
const SALE_TIME_ZONE = 'America/Los_Angeles';
const SALE_START_HOUR = 17;
const SALE_DURATION_MS = 24 * 60 * 60 * 1000;

function getSaleWindowState(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SALE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = {};
  formatter.formatToParts(date).forEach((part) => {
    if (part.type !== 'literal') parts[part.type] = part.value;
  });

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  const nowMs = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  const startMs = Date.UTC(year, month - 1, day, SALE_START_HOUR, 0, 0, 0);
  const endMs = startMs + SALE_DURATION_MS;

  if (nowMs < startMs) return { phase: 'upcoming', startMs, endMs, nowMs };
  if (nowMs < endMs) return { phase: 'active', startMs, endMs, nowMs };
  return { phase: 'ended', startMs, endMs, nowMs };
}

function getCheckoutPrice(basePrice) {
  const price = Number(basePrice) || 0;
  const sale = getSaleWindowState();
  if (sale.phase === 'active') {
    return Math.round(price * (1 - SALE_DISCOUNT_RATE) * 100) / 100;
  }
  return price;
}

function normalizeCheckoutItems(body = {}) {
  const toItem = (it) => {
    if (!it) return null;
    const productName = String(it.productName || '').trim();
    const itemCode = String(it.itemCode || '').trim();
    const price = Number(it.price);
    if (!productName || !itemCode || !Number.isFinite(price) || price <= 0) return null;
    return { productName, itemCode, price };
  };

  if (Array.isArray(body.cartItems) && body.cartItems.length > 0) {
    return body.cartItems.map(toItem).filter(Boolean);
  }

  const single = toItem(body);
  return single ? [single] : [];
}

function withSessionIdPlaceholder(url) {
  const placeholder = '{CHECKOUT_SESSION_ID}';
  if (!url) return url;

  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.get('session_id')) {
      parsed.searchParams.set('session_id', placeholder);
    }
    return parsed.toString();
  } catch (err) {
    // Fallback for non-standard URLs.
    if (url.includes('session_id=')) return url;
    const join = url.includes('?') ? '&' : '?';
    return `${url}${join}session_id=${encodeURIComponent(placeholder)}`;
  }
}

async function ensureInventoryRowsAndValidateAvailability(itemCodes) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: 'Missing Supabase server credentials' };
  }

  const uniqueCodes = [...new Set(itemCodes.map((code) => String(code).trim()).filter(Boolean))];
  if (!uniqueCodes.length) return { ok: false, error: 'No item codes provided' };

  const { data: existingRows, error: readError } = await supabase
    .from('inventory')
    .select('item_code, status')
    .in('item_code', uniqueCodes);

  if (readError) {
    return { ok: false, error: `Failed to read inventory: ${readError.message}` };
  }

  const existingSet = new Set((existingRows || []).map((row) => String(row.item_code)));
  const missingCodes = uniqueCodes.filter((code) => !existingSet.has(code));

  // Auto-create missing inventory rows so webhook/order insert can always reference a valid item_code.
  if (missingCodes.length) {
    const rowsToInsert = missingCodes.map((code) => ({ item_code: code, status: 'available' }));
    const { error: insertError } = await supabase.from('inventory').insert(rowsToInsert);
    if (insertError) {
      return { ok: false, error: `Failed to initialize inventory rows: ${insertError.message}` };
    }
  }

  const { data: finalRows, error: finalReadError } = await supabase
    .from('inventory')
    .select('item_code, status')
    .in('item_code', uniqueCodes);

  if (finalReadError) {
    return { ok: false, error: `Failed to verify inventory: ${finalReadError.message}` };
  }

  const finalMap = new Map((finalRows || []).map((row) => [String(row.item_code), String(row.status || '').toLowerCase()]));
  const stillMissingCodes = uniqueCodes.filter((code) => !finalMap.has(code));
  if (stillMissingCodes.length) {
    return { ok: false, error: `Inventory records missing for: ${stillMissingCodes.join(', ')}` };
  }

  const soldCodes = uniqueCodes.filter((code) => finalMap.get(code) === 'sold');
  if (soldCodes.length) {
    return { ok: true, soldCodes };
  }

  return { ok: true, soldCodes: [] };
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { successUrl, cancelUrl } = req.body;
    const items = normalizeCheckoutItems(req.body);

    if (!items.length) {
      return res.status(400).json({ error: 'Missing valid checkout items' });
    }

    const itemCodes = items.map((it) => it.itemCode);
    const primaryItemCode = itemCodes[0];
    const isSingleItem = items.length === 1;

    const inventoryCheck = await ensureInventoryRowsAndValidateAvailability(itemCodes);
    if (!inventoryCheck.ok) {
      console.error('Inventory validation failed before checkout:', inventoryCheck.error);
      return res.status(500).json({ error: 'Inventory validation failed', details: inventoryCheck.error });
    }
    if (inventoryCheck.soldCodes.length) {
      return res.status(409).json({
        error: 'Item already sold',
        itemCodes: inventoryCheck.soldCodes,
      });
    }

    // Determine shipping cost: $0.50 for test item, $5.00 for real items
    const isTestItem = isSingleItem && (primaryItemCode === 'TEST-001' || primaryItemCode === 'test-001' || primaryItemCode === 'TEST-002' || primaryItemCode === 'test-002');
    const shippingAmount = isTestItem ? 50 : 500; // cents

    // Create Checkout Session
    const sale = getSaleWindowState();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items.map((it) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: it.productName,
            description: `Item Code: ${it.itemCode}`,
          },
          unit_amount: Math.round(getCheckoutPrice(it.price) * 100),
        },
        quantity: 1,
      })),
      shipping_address_collection: {
        allowed_countries: ['US', 'CA'], // Add more countries as needed
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: shippingAmount, // $0.50 for test item, $5.00 for real items
              currency: 'usd',
            },
            display_name: 'Standard Shipping',
            delivery_estimate: {
              minimum: {
                unit: 'business_day',
                value: 3,
              },
              maximum: {
                unit: 'business_day',
                value: 7,
              },
            },
          },
        },
      ],
      mode: 'payment',
        success_url: withSessionIdPlaceholder(successUrl || 'https://www.vintageclosetpdx.com/index.html?purchase=success'),
        cancel_url: cancelUrl || 'https://www.vintageclosetpdx.com/index.html?purchase=cancelled',
      client_reference_id: String(primaryItemCode),
      metadata: {
        item_code: primaryItemCode,
        item_codes: itemCodes.join(','),
        sale_phase: sale.phase,
      },
      custom_fields: [
        {
          key: 'item_code',
          label: {
            type: 'custom',
            custom: 'Item Code (for verification)',
          },
          type: 'text',
          text: {
            default_value: primaryItemCode,
          },
        },
      ],
    });

    return res.status(200).json({ 
      sessionId: session.id,
      url: session.url 
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: error.message 
    });
  }
};
