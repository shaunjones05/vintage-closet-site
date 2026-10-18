const assert = require('node:assert/strict');
const { buildOrderConfirmationEmail } = require('../lib/order-confirmation-email');

const email = buildOrderConfirmationEmail({
  buyerEmail: 'buyer@example.com',
  itemCodes: ['TEE-123', 'DENIM-456'],
  session: {
    id: 'cs_test_12345678',
    currency: 'usd',
    amount_subtotal: 25000,
    amount_total: 25500,
    total_details: { amount_shipping: 1000, amount_discount: 500 },
    customer_details: { name: '<Jordan Buyer>', address: { line1: '123 Main St' } },
    shipping_details: { address: { line1: '123 Main St', city: 'Portland', state: 'OR', postal_code: '97201', country: 'US' } },
  },
  lineItems: [
    { description: 'Item Code: TEE-123', price: { product: { name: '1990s Vintage Band Tee' } }, amount_total: 15000, quantity: 1 },
    { description: 'Item Code: DENIM-456', price: { product: { name: 'Vintage Denim Jacket' } }, amount_total: 10000, quantity: 1 },
  ],
});

assert.equal(email.to, 'buyer@example.com');
assert.match(email.subject, /Order confirmed/);
assert.match(email.html, /1990s Vintage Band Tee/);
assert.match(email.html, /Vintage Denim Jacket/);
assert.match(email.html, /TEE-123/);
assert.match(email.html, /DENIM-456/);
assert.match(email.html, /\$250\.00/);
assert.match(email.html, /\$10\.00/);
assert.match(email.html, /\$5\.00/);
assert.match(email.html, /\$255\.00/);
assert.match(email.html, /123 Main St/);
assert.match(email.html, /3–7 business days/);
assert.match(email.html, /generally final/);
assert.match(email.html, /contact@vintageclosetpdx\.com/);
assert.match(email.html, /&lt;Jordan/);
assert.match(email.orderUrl, /session_id=cs_test_12345678/);
assert.match(email.text, /Track your order:/);

console.log('Order confirmation email content checks passed.');
