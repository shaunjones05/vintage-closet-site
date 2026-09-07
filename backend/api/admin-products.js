const { createClient } = require('@supabase/supabase-js');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://vintageclosetpdx.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-import-password');
}

function requireAuth(req, res) {
  if (!process.env.IMPORT_PASSWORD || req.headers['x-import-password'] !== process.env.IMPORT_PASSWORD) {
    res.status(401).json({ error: 'Invalid importer password.' });
    return false;
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Supabase is not configured on this Vercel project.' });
    return false;
  }
  return true;
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireAuth(req, res)) return;

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const action = req.body?.action;

  if (action === 'list') {
    const { data, error } = await supabase.from('products')
      .select('code,name,price,size,condition,category,description,images,status,published_at,source_url,source_platform')
      .eq('status', 'published').order('published_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const codes = (data || []).map(product => product.code);
    const { data: inventory, error: inventoryError } = await supabase.from('inventory')
      .select('item_code,status').in('item_code', codes);
    if (inventoryError) return res.status(500).json({ error: inventoryError.message });
    const statusByCode = new Map((inventory || []).map(item => [item.item_code, item.status]));
    return res.status(200).json({ products: (data || []).filter(product => statusByCode.get(product.code) !== 'sold') });
  }

  const codes = [...new Set((req.body?.codes || []).map(String).filter(Boolean))];
  if (!codes.length) return res.status(400).json({ error: 'Choose at least one listing.' });

  if (action === 'delist') {
    const { data, error } = await supabase.from('products').update({ status: 'draft' }).in('code', codes).select('code,status');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ updated: data || [] });
  }

  if (action === 'update') {
    if (codes.length !== 1) return res.status(400).json({ error: 'Update one listing at a time.' });
    const input = req.body?.product || {};
    const allowed = ['name', 'price', 'size', 'condition', 'category', 'description'];
    const update = {};
    allowed.forEach(key => { if (Object.prototype.hasOwnProperty.call(input, key)) update[key] = input[key]; });
    if (Object.prototype.hasOwnProperty.call(update, 'price')) {
      update.price = Number(update.price);
      if (!Number.isFinite(update.price) || update.price <= 0) return res.status(400).json({ error: 'Price must be greater than zero.' });
    }
    if (!Object.keys(update).length) return res.status(400).json({ error: 'No editable fields were provided.' });
    const { data, error } = await supabase.from('products').update(update).eq('code', codes[0]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ product: data });
  }

  return res.status(400).json({ error: 'Unknown dashboard action.' });
};
