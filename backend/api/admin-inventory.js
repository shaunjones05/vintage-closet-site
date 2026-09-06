// Admin endpoint for manual inventory updates
// Protected by ADMIN_SECRET_KEY

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Admin Inventory Management Endpoint
 * Allows manual inventory status updates
 * 
 * Usage:
 * POST /api/admin-inventory
 * Headers: { "x-admin-secret": "your-secret-key" }
 * Body: { "item_code": "JKT-5558", "status": "sold" }
 */
module.exports = async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin secret key
  const adminSecret = req.headers['x-admin-secret'];
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { item_code, status } = req.body;

  // Validate input
  if (!item_code) {
    return res.status(400).json({ error: 'item_code is required' });
  }

  if (status && !['available', 'sold'].includes(status)) {
    return res.status(400).json({ error: 'status must be "available" or "sold"' });
  }

  try {
    // Check if item exists
    const { data: existingItem, error: fetchError } = await supabase
      .from('inventory')
      .select('*')
      .eq('item_code', item_code)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Database error:', fetchError);
      return res.status(500).json({ error: 'Database error' });
    }

    // If item doesn't exist, create it
    if (!existingItem) {
      const { data, error: insertError } = await supabase
        .from('inventory')
        .insert({
          item_code,
          status: status || 'available',
          sold_at: status === 'sold' ? new Date().toISOString() : null
        })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to create item:', insertError);
        return res.status(500).json({ error: 'Failed to create item' });
      }

      return res.status(201).json({ success: true, item: data });
    }

    // If item exists, update it
    const updateData = {
      status: status || existingItem.status
    };

    if (status === 'sold') {
      updateData.sold_at = new Date().toISOString();
    } else if (status === 'available') {
      updateData.sold_at = null;
      updateData.stripe_session_id = null;
    }

    const { data, error: updateError } = await supabase
      .from('inventory')
      .update(updateData)
      .eq('item_code', item_code)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update item:', updateError);
      return res.status(500).json({ error: 'Failed to update item' });
    }

    return res.status(200).json({ success: true, item: data });

  } catch (error) {
    console.error('Error in admin endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
