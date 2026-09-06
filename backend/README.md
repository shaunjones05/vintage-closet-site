# Vintage Closet Backend Setup Guide

This backend automates inventory management after Stripe purchases using serverless functions, Supabase, and webhooks.

---

## 🚀 Quick Start

### 1. **Set Up Supabase Database**

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
4. Then run `supabase-orders-schema.sql` to create the `orders` table
5. Go to **Settings → API** and copy:
   - Project URL (`SUPABASE_URL`)
   - `anon` public key (`SUPABASE_ANON_KEY`)
   - `service_role` secret key (`SUPABASE_SERVICE_ROLE_KEY`)

### 2. **Seed Your Inventory**

After running the schema, seed your database with all product codes from your website:

```sql
-- Run this in Supabase SQL Editor
INSERT INTO inventory (item_code, status) VALUES
  ('eb-317705305558', 'sold'),  -- Already sold items
  ('eb-317663055121', 'sold'),
  ('eb-317123456789', 'available'),  -- Available items
  ('eb-317987654321', 'available')
  -- Add all your product codes here...
ON CONFLICT (item_code) DO NOTHING;
```

### 3. **Install Dependencies**

```bash
cd backend
npm install
```

### 4. **Configure Environment Variables**

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Fill in your credentials:

- **Stripe keys**: Get from [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)
- **Supabase keys**: From step 1
- **Admin secret**: Generate a random strong password

### 5. **Deploy to Vercel**

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
cd backend
vercel

# Follow prompts, then deploy to production
vercel --prod
```

After deployment, Vercel will give you URLs like:

- `https://your-project.vercel.app/api/stripe-webhook`
- `https://your-project.vercel.app/api/admin-inventory`
- `https://your-project.vercel.app/api/admin-orders`

### 6. **Add Environment Variables to Vercel**

Either use the Vercel dashboard or CLI:

```bash
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add SUPABASE_ANON_KEY
vercel env add ADMIN_SECRET_KEY
```

### 7. **Configure Stripe Webhook**

1. Go to [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Enter your webhook URL: `https://your-project.vercel.app/api/stripe-webhook`
4. Select event: `checkout.session.completed`
5. Copy the **Signing secret** (starts with `whsec_...`)
6. Add it to Vercel: `vercel env add STRIPE_WEBHOOK_SECRET`

### 8. **Test the Webhook (Local)**

```bash
# Terminal 1: Start local dev server
npm run dev

# Terminal 2: Forward Stripe events to local endpoint
npm run test-webhook

# Terminal 3: Create a test checkout session
# Use Stripe test cards: 4242 4242 4242 4242
```

---

## 📡 API Endpoints

### **POST /api/stripe-webhook**

- **Purpose**: Automatically creates an order and marks item as sold after successful Stripe checkout
- **Authentication**: Stripe webhook signature verification
- **Triggered by**: Stripe `checkout.session.completed` event
- **Required**: Item code in checkout session (metadata, custom_fields, or client_reference_id)
- **Duplicate safety**: Uses unique `stripe_session_id` in orders table to prevent duplicate orders

### **GET /api/admin-orders**

- **Purpose**: View recent orders and search by `item_code` or `buyer_email`
- **Authentication**: `x-admin-secret` header
- **Query params**:
  - `q` (optional search text)
  - `limit` (optional, max 300)

### **PATCH /api/admin-orders**

- **Purpose**: Update order tracking fields manually
- **Authentication**: `x-admin-secret` header
- **Body**:
  ```json
  {
    "id": 123,
    "order_status": "shipped",
    "shipping_carrier": "USPS",
    "tracking_number": "94001118992238471823"
  }
  ```

### **GET /api/order-status**

- **Purpose**: Buyer read-only status lookup (shipping/tracking)
- **Authentication**: none (requires both session ID + buyer email)
- **Query params**:
  - `session_id` (required)
  - `email` (required)
- **Returns**: `order_status`, `shipping_carrier`, `tracking_number`, `shipped_at`, and basic order details

### **POST /api/admin-inventory**

- **Purpose**: Manual inventory management (mark items sold/available)
- **Authentication**: `x-admin-secret` header
- **Body**:
  ```json
  {
    "item_code": "eb-317123456789",
    "status": "sold"
  }
  ```
- **Example**:
  ```bash
  curl -X POST https://your-project.vercel.app/api/admin-inventory \
    -H "x-admin-secret: your-secret-key" \
    -H "Content-Type: application/json" \
    -d '{"item_code": "eb-317123456789", "status": "sold"}'
  ```

---

## 🔗 Integrate with Frontend

Add this to your `js/app.js` to fetch real-time inventory status:

```javascript
// Initialize Supabase client (frontend - read-only)
const supabase = supabase.createClient(
  "https://your-project.supabase.co",
  "your-anon-public-key",
);

// Fetch inventory status on page load
async function fetchInventoryStatus() {
  const { data, error } = await supabase
    .from("inventory")
    .select("item_code, status");

  if (error) {
    console.error("Failed to fetch inventory:", error);
    return;
  }

  // Update products array with database status
  products.forEach((product) => {
    const dbItem = data.find((item) => item.item_code === product.code);
    if (dbItem) {
      product.status = dbItem.status;
    }
  });

  // Re-render the page
  renderProducts();
}

// Call on page load
fetchInventoryStatus();
```

---

## 🛒 Configure Stripe Checkout to Pass Item Code

When creating Stripe checkout sessions, include the item code:

**Option 1: Metadata** (easiest)

```javascript
const session = await stripe.checkout.sessions.create({
  // ... other config
  metadata: {
    item_code: "eb-317123456789",
  },
});
```

**Option 2: Client Reference ID**

```javascript
const session = await stripe.checkout.sessions.create({
  // ... other config
  client_reference_id: "eb-317123456789",
});
```

**Option 3: Custom Fields** (requires Stripe UI configuration)

```javascript
const session = await stripe.checkout.sessions.create({
  // ... other config
  custom_fields: [
    {
      key: "item_code",
      label: { type: "custom", custom: "Item Code" },
      type: "text",
    },
  ],
});
```

---

## 🔒 Security Notes

- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code
- **Never** expose `STRIPE_SECRET_KEY` or `ADMIN_SECRET_KEY` in frontend
- Frontend uses `SUPABASE_ANON_KEY` (read-only access enforced by RLS)
- Webhook signature verification prevents unauthorized inventory updates
- Admin endpoint requires secret header to prevent public access

---

## 📦 Order Tracking Flow (Minimal)

1. Checkout succeeds in Stripe
2. Stripe sends `checkout.session.completed` to `/api/stripe-webhook`
3. Webhook verifies Stripe signature using `STRIPE_WEBHOOK_SECRET`
4. Webhook extracts:

- `stripe_session_id`
- `stripe_payment_intent_id`
- `buyer_email`
- `amount_total`
- `item_code`

5. Webhook inserts row into `orders`
6. Webhook marks matching `inventory` row as sold
7. You can update shipping/tracking via `/api/admin-orders` (or the `admin-orders.html` page)
8. Buyer can check status using `order-status.html` + `/api/order-status`

---

## 🧪 Testing Checklist

- [ ] Supabase database created and seeded
- [ ] Environment variables configured in Vercel
- [ ] Stripe webhook endpoint added and verified
- [ ] Test purchase with Stripe test card (4242 4242 4242 4242)
- [ ] Verify item marked as sold in Supabase
- [ ] Frontend fetches updated status and hides sold item
- [ ] Admin endpoint works with correct secret key
- [ ] Admin endpoint rejects requests without secret key

---

## 📞 Common Issues

**"Webhook signature verification failed"**

- Make sure `STRIPE_WEBHOOK_SECRET` matches the signing secret from Stripe dashboard
- Check that you're sending raw request body (not parsed JSON)

**"Item already sold" on duplicate purchase**

- This is correct behavior - prevents selling the same item twice
- Issue a refund in Stripe dashboard

**"Item not found in inventory"**

- Make sure you seeded all product codes in Supabase
- Check that item code matches exactly (case-sensitive)

**Frontend can't read inventory**

- Make sure you're using `SUPABASE_ANON_KEY` (not service role key)
- Verify RLS policies are enabled (run `supabase-schema.sql` again)

---

## 🎯 What This Does

1. **Customer purchases item** → Stripe checkout
2. **Stripe sends webhook** → `checkout.session.completed` event
3. **Backend verifies signature** → Ensures request is from Stripe
4. **Backend checks database** → Prevents duplicate purchases
5. **Backend marks item sold** → Updates Supabase inventory table
6. **Frontend fetches status** → Hides sold items automatically

No more manual inventory updates! 🎉
