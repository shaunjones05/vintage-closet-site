# Shipping Setup Complete ✅

## What Changed

### 1. Shipping Address Collection

- Stripe checkout now collects full shipping address (US & Canada)
- Customer name and email are automatically captured
- All shipping info is saved to your database

### 2. Shipping Cost

- **$5.00 flat rate shipping** added to all orders
- Delivery estimate: 3-7 business days
- Customer pays: Item Price + $5 shipping

### 3. Database Updates

**Run this SQL in your Supabase SQL Editor:**

```sql
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS shipping_address JSONB;
```

After a purchase, you can view shipping details:

```sql
SELECT
  item_code,
  customer_name,
  customer_email,
  shipping_address
FROM inventory
WHERE status = 'sold'
ORDER BY sold_at DESC;
```

## How to Test

1. Buy your test item ($1 + $5 shipping = $6 total)
2. Enter shipping address during checkout
3. After payment, check Supabase:
   - Go to Table Editor → inventory
   - Find your sold item (TEST-001)
   - View customer_name, customer_email, shipping_address columns

## Accessing Shipping Info

### In Supabase Dashboard:

1. Go to: https://culbmklimqruufxxxnmm.supabase.co/project/_/editor
2. Select `inventory` table
3. Filter: `status = 'sold'`
4. You'll see customer details and full address

### Shipping Address Format:

```json
{
  "address": {
    "line1": "123 Main St",
    "line2": "Apt 4B",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "US"
  },
  "name": "John Doe"
}
```

## Future Automation Options

### Option 1: Shippo (Recommended - Simple)

- https://goshippo.com
- $0.05 per label + carrier rates
- Webhook integration: When item sells → auto-create label
- Get tracking number automatically

### Option 2: EasyPost

- https://easypost.com
- Similar to Shippo
- Slightly more expensive but more carrier options

### Option 3: Stripe Shipping (Beta)

- Built into Stripe (if available in your region)
- No extra account needed

### Implementation Steps (when ready):

1. Sign up for Shippo/EasyPost
2. Add API keys to Vercel environment variables
3. Uncomment TODO in stripe-webhook.js
4. Add label creation function
5. Email customer tracking number

## Current Workflow

**When someone buys an item:**

1. ✅ Checkout collects address + $5 shipping
2. ✅ Webhook saves all details to database
3. ✅ Item marked as sold
4. 📧 Check Supabase for shipping address
5. 📦 Create label manually (or automate later)
6. 🚚 Ship the item!

## Countries Supported

Currently: **US & Canada**

To add more countries, edit `backend/api/create-checkout.js`:

```javascript
shipping_address_collection: {
  allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', ...],
}
```

## Shipping Rates

- Current: $5 flat rate
- To change: Edit `backend/api/create-checkout.js` line with `amount: 500`
- Amount is in cents (500 = $5.00)

You can also add multiple shipping options (Standard, Express, etc.) if needed!
