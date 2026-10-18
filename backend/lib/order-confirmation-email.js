const CONTACT_EMAIL = 'contact@vintageclosetpdx.com';
const SHOP_URL = 'https://www.vintageclosetpdx.com';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(cents, currency) {
  const amount = Number.isFinite(Number(cents)) ? Number(cents) / 100 : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency || 'usd').toUpperCase(),
  }).format(amount);
}

function buildOrderConfirmationEmail({ session, lineItems, itemCodes, buyerEmail }) {
  const currency = session.currency || 'usd';
  const displayOrderId = String(session.id || '').slice(-8).toUpperCase();
  const checkoutName = session.customer_details?.name || '';
  const firstName = checkoutName.trim().split(/\s+/)[0] || 'there';
  const orderUrl = new URL('/order-status.html', SHOP_URL);
  orderUrl.searchParams.set('session_id', String(session.id || ''));

  const items = (lineItems || []).map((item, index) => {
    const description = item.description || '';
    const product = item.price?.product;
    const codeFromDescription = description.match(/Item Code:\s*([^,\n]+)/i)?.[1] || '';
    const descriptionTitle = description.replace(/Item Code:\s*[^,\n]+/i, '').trim();
    return {
      name: (product && typeof product === 'object' && product.name) || descriptionTitle || `Vintage item ${index + 1}`,
      amount: item.amount_total,
      quantity: item.quantity || 1,
      code: codeFromDescription || itemCodes[index] || '',
    };
  });
  const shippingAmount = session.total_details?.amount_shipping || 0;
  const discountAmount = session.total_details?.amount_discount || 0;
  const subtotal = session.amount_subtotal || 0;
  const total = session.amount_total || 0;
  const address = session.shipping_details?.address || session.customer_details?.address;
  const addressLines = address
    ? [address.line1, address.line2, [address.city, address.state, address.postal_code].filter(Boolean).join(', '), address.country].filter(Boolean)
    : [];
  const itemRowsHtml = items.map((item) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e8dfd5;vertical-align:top">
        <strong>${escapeHtml(item.name)}</strong>${item.code ? `<br><span style="color:#75695f;font-size:13px">Item code: ${escapeHtml(item.code)}</span>` : ''}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #e8dfd5;text-align:right;white-space:nowrap;vertical-align:top">${formatMoney(item.amount, currency)}</td>
    </tr>`).join('');
  const summaryHtml = [
    ['Subtotal', formatMoney(subtotal, currency)],
    ['Shipping', shippingAmount ? formatMoney(shippingAmount, currency) : 'Free'],
    ...(discountAmount ? [['Discount', `−${formatMoney(discountAmount, currency)}`]] : []),
  ].map(([label, value]) => `<tr><td style="padding:5px 0;color:#63584f">${label}</td><td style="padding:5px 0;text-align:right">${value}</td></tr>`).join('');
  const itemRowsText = items.map((item) => `• ${item.name}${item.code ? ` (item code ${item.code})` : ''} — ${formatMoney(item.amount, currency)}`).join('\n');
  const addressText = addressLines.length ? addressLines.join('\n') : 'Shipping address provided at checkout';
  const subject = `Order confirmed — Vintage Closet PDX #${displayOrderId}`;
  const text = [
    `Hi ${firstName},`,
    '',
    'Thanks for your order. Your payment was received and we are getting your vintage pieces ready.',
    '',
    `Order #${displayOrderId}`,
    'ORDER SUMMARY',
    itemRowsText,
    `Subtotal: ${formatMoney(subtotal, currency)}`,
    `Shipping: ${shippingAmount ? formatMoney(shippingAmount, currency) : 'Free'}`,
    ...(discountAmount ? [`Discount: −${formatMoney(discountAmount, currency)}`] : []),
    `Total paid: ${formatMoney(total, currency)}`,
    '',
    'SHIPPING',
    'Most orders ship within 1–2 business days. Estimated delivery is 3–7 business days after shipment. We will add tracking to your order-status page when it is available.',
    addressText,
    '',
    `Track your order: ${orderUrl.toString()}`,
    'Open the link and enter the same email address you used at checkout.',
    '',
    'RETURNS',
    'Because vintage pieces are unique and often one of a kind, all sales are generally final and returns or exchanges are unlikely to be accepted. If something is wrong with your order, contact us and we will be glad to help.',
    '',
    `Questions? Email ${CONTACT_EMAIL}.`,
    '',
    'Vintage Closet PDX',
  ].join('\n');

  const html = `<!doctype html><html><body style="margin:0;background:#f7f1e9;font-family:Arial,Helvetica,sans-serif;color:#302720">
    <div style="max-width:620px;margin:0 auto;padding:28px 16px">
      <div style="background:#fffdf9;border:1px solid #e8dfd5;border-radius:12px;overflow:hidden">
        <div style="padding:28px 28px 20px;background:#f2e8dc">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#75695f">Vintage Closet PDX</p>
          <h1 style="font-family:Georgia,serif;font-size:28px;line-height:1.2;margin:0 0 10px">Thanks for your order, ${escapeHtml(firstName)}.</h1>
          <p style="margin:0;color:#63584f">Payment received · Order #${escapeHtml(displayOrderId)}</p>
        </div>
        <div style="padding:24px 28px">
          <p style="margin:0 0 18px;line-height:1.6">We’re getting your vintage piece${items.length === 1 ? '' : 's'} ready to ship.</p>
          <h2 style="font-size:16px;margin:0 0 8px">Order summary</h2>
          <table role="presentation" style="width:100%;border-collapse:collapse"><tbody>${itemRowsHtml}${summaryHtml}<tr><td style="padding:12px 0;border-top:1px solid #d7c9ba;font-weight:bold">Total paid</td><td style="padding:12px 0;border-top:1px solid #d7c9ba;text-align:right;font-weight:bold">${formatMoney(total, currency)}</td></tr></tbody></table>
          <div style="margin:22px 0;padding:16px;background:#f7f1e9;border-radius:8px">
            <h2 style="font-size:16px;margin:0 0 8px">Shipping</h2>
            <p style="margin:0;line-height:1.6">Most orders ship within 1–2 business days. Estimated delivery is 3–7 business days after shipment. Tracking will appear on your order-status page once available.</p>
            <p style="margin:10px 0 0;line-height:1.5">${addressLines.map(escapeHtml).join('<br>') || 'Shipping address provided at checkout'}</p>
          </div>
          <p style="margin:22px 0"><a href="${escapeHtml(orderUrl.toString())}" style="display:inline-block;background:#302720;color:#fff;text-decoration:none;padding:12px 18px;border-radius:7px;font-weight:bold">Track your order</a></p>
          <p style="font-size:13px;line-height:1.6;color:#63584f">Use the email address you entered at checkout when you open the order-status page.</p>
          <h2 style="font-size:16px;margin:22px 0 8px">Returns</h2>
          <p style="margin:0;line-height:1.6;color:#63584f">Because vintage pieces are unique and often one of a kind, all sales are generally final and returns or exchanges are unlikely to be accepted. If something is wrong with your order, contact us and we will be glad to help.</p>
          <p style="margin:22px 0 0;line-height:1.6">Questions? <a href="mailto:${CONTACT_EMAIL}" style="color:#6e4a38">${CONTACT_EMAIL}</a></p>
        </div>
      </div>
    </div>
  </body></html>`;

  return { to: buyerEmail, subject, html, text, orderUrl: orderUrl.toString(), itemCodes };
}

async function sendOrderConfirmation({ session, lineItems, itemCodes, buyerEmail }) {
  if (!buyerEmail) {
    console.warn('Skipping order confirmation: Stripe session has no buyer email', { sessionId: session.id });
    return { skipped: true };
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Missing RESEND_API_KEY; order confirmation email was not sent');

  const email = buildOrderConfirmationEmail({ session, lineItems, itemCodes, buyerEmail });
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `order-confirmation/${session.id}`,
    },
    body: JSON.stringify({
      from: `Vintage Closet PDX <${CONTACT_EMAIL}>`,
      to: [buyerEmail],
      reply_to: CONTACT_EMAIL,
      subject: email.subject,
      html: email.html,
      text: email.text,
      tags: [{ name: 'type', value: 'order-confirmation' }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Order confirmation email provider returned an error:', response.status, detail.slice(0, 500));
    throw new Error(`Order confirmation email failed with status ${response.status}`);
  }
  const result = await response.json();
  return { id: result.id || null };
}

module.exports = { buildOrderConfirmationEmail, sendOrderConfirmation };
