// Public read-only order status lookup.
// Buyer can provide either Stripe session ID + email or item code + email.

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = String(req.query.session_id || '').trim();
    const itemCode = String(req.query.item_code || '').trim();
    const email = String(req.query.email || '').trim().toLowerCase();

    if (!email || (!sessionId && !itemCode)) {
      return res.status(400).json({ error: 'email and either session_id or item_code are required' });
    }

    let query = supabase
      .from('orders')
      .select('id, created_at, item_code, buyer_email, order_status, shipping_carrier, tracking_number, shipped_at')
      .eq('buyer_email', email)
      .order('created_at', { ascending: false })
      .limit(1);

    if (sessionId) {
      query = query.eq('stripe_session_id', sessionId);
    } else {
      query = query.eq('item_code', itemCode);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('Failed to fetch order status:', error);
      return res.status(500).json({ error: 'Failed to fetch order status' });
    }

    const order = Array.isArray(orders) ? orders[0] : null;

    if (!order) {
      return res.status(404).json({ error: sessionId ? 'Order not found for provided session and email' : 'Order not found for provided item code and email' });
    }

    return res.status(200).json({
      order: {
        id: order.id,
        created_at: order.created_at,
        item_code: order.item_code,
        order_status: order.order_status,
        shipping_carrier: order.shipping_carrier,
        tracking_number: order.tracking_number,
        shipped_at: order.shipped_at,
      },
    });
  } catch (err) {
    console.error('Unexpected order status error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
