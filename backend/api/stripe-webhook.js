require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Vercel needs raw request body for Stripe signature verification.
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function getItemCodesFromSession(session) {
  if (session?.metadata?.item_codes) {
    const codes = String(session.metadata.item_codes)
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    if (codes.length) return [...new Set(codes)];
  }

  if (session?.metadata?.item_code) return [String(session.metadata.item_code)];
  if (session?.client_reference_id) return [String(session.client_reference_id)];

  if (Array.isArray(session?.custom_fields)) {
    const field = session.custom_fields.find((f) => f?.key === 'item_code');
    if (field?.text?.value) return [String(field.text.value)];
  }

  return [];
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET environment variable');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const stripeSessionId = session.id;
  const stripePaymentIntentId = session.payment_intent ? String(session.payment_intent) : null;
  const buyerEmail = session.customer_details?.email || session.customer_email || null;
  const amountTotal = typeof session.amount_total === 'number' ? session.amount_total : null;
  const itemCodes = getItemCodesFromSession(session);
  const primaryItemCode = itemCodes[0] || null;

  if (!itemCodes.length) {
    console.error('Missing item_code(s) in session metadata/client_reference_id:', stripeSessionId);
    return res.status(400).json({ error: 'Missing item_code in checkout session' });
  }

  try {
    // Idempotency: if Stripe retries the same session, do not create duplicate orders.
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from('orders')
      .select('id, stripe_session_id')
      .eq('stripe_session_id', stripeSessionId)
      .maybeSingle();

    if (existingOrderError) {
      console.error('Failed to check existing order:', existingOrderError);
      return res.status(500).json({ error: 'Failed to check existing order' });
    }

    if (existingOrder) {
      console.log('Duplicate webhook received, order already exists for session:', stripeSessionId);
      return res.status(200).json({ success: true, duplicate: true, orderId: existingOrder.id });
    }

    const { data: inventoryItems, error: inventoryError } = await supabase
      .from('inventory')
      .select('item_code, status')
      .in('item_code', itemCodes);

    if (inventoryError) {
      console.error('Failed to read inventory item:', inventoryError);
      return res.status(500).json({ error: 'Failed to read inventory' });
    }

    const foundCodes = new Set((inventoryItems || []).map((row) => String(row.item_code)));
    const missingCodes = itemCodes.filter((code) => !foundCodes.has(String(code)));
    if (missingCodes.length) {
      console.error(`Webhook received for unknown item_code(s): ${missingCodes.join(', ')} (session: ${stripeSessionId})`);
      return res.status(409).json({ error: 'Purchased item_code not found in inventory' });
    }

    const soldCodes = (inventoryItems || [])
      .filter((row) => row.status === 'sold')
      .map((row) => String(row.item_code));
    if (soldCodes.length) {
      console.error(`Item already sold: ${soldCodes.join(', ')} (session: ${stripeSessionId})`);
      return res.status(409).json({ error: 'Item already sold' });
    }

    const { data: insertedOrder, error: insertOrderError } = await supabase
      .from('orders')
      .insert({
        stripe_session_id: stripeSessionId,
        stripe_payment_intent_id: stripePaymentIntentId,
        item_code: itemCodes.join(','),
        buyer_email: buyerEmail,
        amount_total: amountTotal,
        order_status: 'paid',
      })
      .select('*')
      .single();

    if (insertOrderError) {
      console.error('Failed to insert order:', insertOrderError);
      return res.status(500).json({ error: 'Failed to create order' });
    }

    const { data: updatedInventoryRows, error: updateInventoryError } = await supabase
      .from('inventory')
      .update({
        status: 'sold',
        sold_at: new Date().toISOString(),
        stripe_session_id: stripeSessionId,
      })
      .in('item_code', itemCodes)
      .eq('status', 'available')
      .select('item_code');

    if (updateInventoryError) {
      console.error('Failed to mark inventory item as sold:', updateInventoryError);
      await supabase.from('orders').delete().eq('id', insertedOrder.id);
      return res.status(500).json({ error: 'Failed to mark inventory sold' });
    }

    if (!updatedInventoryRows || updatedInventoryRows.length !== itemCodes.length) {
      console.error(`Inventory changed before update. Could not sell all items: ${itemCodes.join(', ')}`);
      const updatedCodes = (updatedInventoryRows || []).map((row) => String(row.item_code));
      if (updatedCodes.length) {
        await supabase
          .from('inventory')
          .update({ status: 'available', sold_at: null, stripe_session_id: null })
          .in('item_code', updatedCodes)
          .eq('stripe_session_id', stripeSessionId);
      }
      await supabase.from('orders').delete().eq('id', insertedOrder.id);
      return res.status(409).json({ error: 'Item was already sold by another process' });
    }

    console.log('Order created and inventory sold:', {
      orderId: insertedOrder.id,
      itemCodes,
      stripeSessionId,
      buyerEmail,
      amountTotal,
    });

    return res.status(200).json({ success: true, orderId: insertedOrder.id, itemCode: primaryItemCode, itemCodes });
  } catch (error) {
    console.error('Unexpected webhook processing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
