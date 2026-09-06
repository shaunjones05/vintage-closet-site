// Admin endpoint for viewing and updating orders.
// Protected by ADMIN_SECRET_KEY header.

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORDER_STATUS = ['paid', 'packed', 'shipped', 'delivered'];

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const adminSecret = req.headers['x-admin-secret'];
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const limit = Math.min(Number(req.query.limit) || 100, 300);

      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (q) {
        // Search by item_code or buyer_email.
        query = query.or(`item_code.ilike.%${q}%,buyer_email.ilike.%${q}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch orders:', error);
        return res.status(500).json({ error: 'Failed to fetch orders' });
      }

      return res.status(200).json({ orders: data || [] });
    } catch (error) {
      console.error('Unexpected GET /admin-orders error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, order_status, shipping_carrier, tracking_number } = req.body || {};

      if (!id) {
        return res.status(400).json({ error: 'id is required' });
      }

      const updateData = {};

      if (order_status !== undefined) {
        if (!ALLOWED_ORDER_STATUS.includes(order_status)) {
          return res.status(400).json({ error: 'Invalid order_status' });
        }
        updateData.order_status = order_status;

        if (order_status === 'shipped') {
          updateData.shipped_at = new Date().toISOString();
        }
      }

      if (shipping_carrier !== undefined) {
        updateData.shipping_carrier = shipping_carrier || null;
      }

      if (tracking_number !== undefined) {
        updateData.tracking_number = tracking_number || null;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update' });
      }

      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Failed to update order:', error);
        return res.status(500).json({ error: 'Failed to update order' });
      }

      return res.status(200).json({ success: true, order: data });
    } catch (error) {
      console.error('Unexpected PATCH /admin-orders error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};