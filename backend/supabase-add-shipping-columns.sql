-- Add shipping and customer information columns to inventory table
-- Run this in your Supabase SQL Editor

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS shipping_address JSONB;

-- Add comment for documentation
COMMENT ON COLUMN inventory.customer_email IS 'Customer email from Stripe checkout';
COMMENT ON COLUMN inventory.customer_name IS 'Customer name from Stripe checkout';
COMMENT ON COLUMN inventory.shipping_address IS 'Full shipping address from Stripe (JSON format)';
