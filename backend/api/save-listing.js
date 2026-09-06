// Save a new listing to js/app.js
// Receives scraped listing data and appends to products array

const fs = require('fs');
const path = require('path');

function generateId() {
  return 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function generateCode() {
  const prefixes = ['JKT', 'TEE', 'HOO', 'PNT', 'ACC'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${num}`;
}

function formatProductObject(item) {
  const id = generateId();
  const code = generateCode();

  return {
    id,
    code,
    name: (item.name || '').replace(/"/g, '\\"'),
    price: parseFloat(item.price) || 0,
    size: (item.size || '').replace(/"/g, '\\"'),
    condition: (item.condition || '').replace(/"/g, '\\"'),
    images: Array.isArray(item.images) ? item.images : [],
    description: (item.description || '').replace(/"/g, '\\"'),
    category: (item.category || 'Vintage Clothing').replace(/"/g, '\\"'),
    status: 'available'
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify import password (separate from admin secret for security)
  const importPassword = req.headers['x-import-password'];
  if (!importPassword || importPassword !== process.env.IMPORT_PASSWORD) {
    return res.status(401).json({ error: 'Invalid import password' });
  }

  const item = req.body;

  if (!item.name || !item.price) {
    return res.status(400).json({ error: 'Name and price required' });
  }

  try {
    const product = formatProductObject(item);

    // Path to app.js - adjust based on your deployment environment
    let appJsPath;
    if (process.env.VERCEL) {
      // On Vercel, files are read-only in functions
      // Return the formatted product so frontend can handle it
      return res.status(200).json({
        success: true,
        message: 'Item ready to add (manual step needed on Vercel)',
        product,
        code: JSON.stringify(product, null, 2)
      });
    } else {
      // Local development - can write to file
      appJsPath = path.join(__dirname, '../../js/app.js');
    }

    // For local development: append to app.js
    if (fs.existsSync(appJsPath)) {
      let fileContent = fs.readFileSync(appJsPath, 'utf8');

      // Find the insertion point (before the closing ];)
      const insertionPoint = fileContent.lastIndexOf('];');
      if (insertionPoint === -1) {
        return res.status(400).json({ error: 'Could not find products array in app.js' });
      }

      // Format the new item
      const newItemStr = `  ${JSON.stringify(product, null, 2).split('\n').join('\n  ')},\n`;

      // Insert the item
      const updatedContent = fileContent.slice(0, insertionPoint) + newItemStr + fileContent.slice(insertionPoint);

      // Write back
      fs.writeFileSync(appJsPath, updatedContent, 'utf8');

      return res.status(200).json({
        success: true,
        message: 'Item added to app.js',
        product,
        code: product.code
      });
    } else {
      // Fallback: return formatted item for manual addition
      return res.status(200).json({
        success: true,
        message: 'Item formatted (manual step needed)',
        product,
        code: product.code,
        instructions: 'Copy this product object into js/app.js products array before the closing ]'
      });
    }

  } catch (err) {
    console.error('Save error:', err);
    return res.status(500).json({
      error: 'Failed to save item',
      details: err.message
    });
  }
};
