-- Inventory table for tracking item status
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS inventory (
  item_code TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('available', 'sold')),
  sold_at TIMESTAMP WITH TIME ZONE,
  stripe_session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster status queries
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);

-- Index for faster lookups by Stripe session
CREATE INDEX IF NOT EXISTS idx_inventory_stripe_session ON inventory(stripe_session_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp on row changes
DROP TRIGGER IF EXISTS inventory_updated_at ON inventory;
CREATE TRIGGER inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_timestamp();

-- Enable Row Level Security (RLS)
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Make policy creation re-runnable
DROP POLICY IF EXISTS "Allow public read access" ON inventory;
DROP POLICY IF EXISTS "Service role can write" ON inventory;

-- Policy: Allow public read access (frontend can check status)
CREATE POLICY "Allow public read access"
  ON inventory FOR SELECT
  TO anon
  USING (true);

-- Policy: Only authenticated service role can write (backend only)
-- This prevents direct public writes
CREATE POLICY "Service role can write"
  ON inventory FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed initial inventory from your existing products
-- You'll need to insert all your item codes here
-- Example:
-- INSERT INTO inventory (item_code, status) VALUES ('JKT-5558', 'sold') ON CONFLICT (item_code) DO NOTHING;
-- INSERT INTO inventory (item_code, status) VALUES ('JKT-5121', 'sold') ON CONFLICT (item_code) DO NOTHING;
-- Add all your item codes from js/app.js here...
