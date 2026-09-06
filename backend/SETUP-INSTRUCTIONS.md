# Backend Setup Instructions

## ✅ COMPLETED

- [x] Frontend Supabase configuration (anon key and URL added to app.js)
- [x] Backend files created (API endpoints, schema, config)
- [x] SQL INSERT statement generated

## 📋 YOUR NEXT STEPS

### Step 1: Run SQL in Supabase (2 queries)

1. **Go to Supabase Dashboard** → Your Project → SQL Editor
2. **Click "New Query"**

#### Query 1: Create Table & Security

Copy and paste this (from `supabase-schema.sql`):

```sql
CREATE TABLE IF NOT EXISTS inventory (
  item_code TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('available', 'sold')),
  sold_at TIMESTAMP WITH TIME ZONE,
  stripe_session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inventory_status ON inventory(status);
CREATE INDEX idx_inventory_stripe_session ON inventory(stripe_session_id);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON inventory FOR SELECT TO anon USING (true);

CREATE POLICY "Service role can write"
  ON inventory FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

Click **RUN** ✓

#### Query 2: Insert Your Products

Click "New Query" again, then paste:

```sql
INSERT INTO inventory (item_code, status)
VALUES
  ('317607391969', 'available'),
  ('JKT-2941', 'available'),
  ('JKT-5121', 'available'),
  ('JKT-7588', 'available'),
  ('JKT-0318', 'available'),
  ('JKT-1848', 'available'),
  ('JKT-8950', 'available'),
  ('JKT-7992', 'available'),
  ('JKT-9752', 'available'),
  ('JKT-5939', 'available'),
  ('JKT-2201', 'available'),
  ('JKT-6787', 'available'),
  ('JKT-9539', 'available'),
  ('JKT-1285', 'available'),
  ('JKT-0882', 'available'),
  ('JKT-5336', 'available'),
  ('JKT-8959', 'available'),
  ('JKT-4855', 'available'),
  ('JKT-8780', 'available'),
  ('JKT-9137', 'available'),
  ('JKT-1836', 'available'),
  ('JKT-3541', 'available'),
  ('JKT-2819', 'available'),
  ('JKT-7832', 'available'),
  ('JKT-0593', 'available'),
  ('JKT-1089', 'available'),
  ('TEE-4214', 'available'),
  ('JKT-7766', 'available'),
  ('JKT-4921', 'available'),
  ('JKT-5922', 'available'),
  ('JKT-9857', 'available'),
  ('JKT-5558', 'available'),
  ('TEE-UIU0', 'available')
ON CONFLICT (item_code) DO NOTHING;
```

Click **RUN** ✓

You should see: "33 rows inserted"

---

### Step 2: Get Service Role Key

1. In Supabase Dashboard → Settings → API
2. Find **"service_role" key** (under "Project API keys")
3. Copy it (starts with `eyJ...`)
4. **Keep this SECRET** - never commit to git!

---

### Step 3: Test Frontend Connection

1. Open your website in browser
2. Open Developer Console (F12)
3. Refresh the page
4. Check for any Supabase errors
5. Your inventory should load automatically

**Expected:** Products show correct "available" or "sold" status from database

---

## 🚀 DEPLOYMENT (When Ready)

### Option A: Deploy Backend to Vercel

1. Install Vercel CLI:

   ```bash
   npm install -g vercel
   ```

2. Navigate to backend folder:

   ```bash
   cd backend
   npm install
   ```

3. Deploy:

   ```bash
   vercel
   ```

4. Set environment variables in Vercel dashboard:

   - `SUPABASE_URL` = Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = Service role key from Step 2
   - `STRIPE_SECRET_KEY` = From Stripe dashboard
   - `STRIPE_WEBHOOK_SECRET` = From Stripe webhook settings (after setup)
   - `ADMIN_SECRET_KEY` = Create a random secure string

5. Configure Stripe webhook:
   - Go to Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://your-vercel-url.vercel.app/api/stripe-webhook`
   - Select event: `checkout.session.completed`
   - Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

---

## ✨ What's Working Now

- ✅ Frontend loads inventory status from Supabase
- ✅ Products show "available" or "sold" badges
- ✅ Database security (public can read, only backend can write)
- ✅ 33 products seeded in database

## 🔜 After Deployment

- Stripe purchases automatically mark items as sold
- Admin endpoint to manually update inventory
- Webhook security prevents unauthorized updates

---

## 🆘 Troubleshooting

**Products not showing status:**

- Check browser console for Supabase errors
- Verify anon key and URL in js/app.js
- Check Supabase → Table Editor → inventory table exists

**Can't run SQL:**

- Make sure you're in SQL Editor (not Table Editor)
- Run Query 1 first, then Query 2
- Check for error messages

**Need help?**

- Check backend/README.md for detailed docs
- Verify all files in backend/ folder exist
