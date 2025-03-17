-- database/supabase_migration.sql
-- Run this in the Supabase SQL Editor

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id SERIAL PRIMARY KEY,
  orderid TEXT NOT NULL UNIQUE,
  adminid TEXT NOT NULL,
  clientname TEXT NOT NULL,
  compensation TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'ASSIGNED', 'COMPLETED', 'CANCELLED')),
  assignedto TEXT,
  assignedat TIMESTAMP WITH TIME ZONE,
  completedat TIMESTAMP WITH TIME ZONE,
  createdat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updatedat TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
CREATE POLICY "Allow authenticated users to read orders" 
  ON public.orders FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert orders" 
  ON public.orders FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update orders" 
  ON public.orders FOR UPDATE 
  USING (auth.role() = 'authenticated');

-- Coders table
CREATE TABLE IF NOT EXISTS public.coders (
  id SERIAL PRIMARY KEY,
  userid TEXT NOT NULL UNIQUE,
  activeorderid TEXT,
  completedorders INTEGER DEFAULT 0,
  lastactive TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.coders ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
CREATE POLICY "Allow authenticated users to read coders" 
  ON public.coders FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert coders" 
  ON public.coders FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update coders" 
  ON public.coders FOR UPDATE 
  USING (auth.role() = 'authenticated');

-- Trigger to automatically update updatedAt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updatedat = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_orders_updatedAt
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Policies
CREATE POLICY IF NOT EXISTS "Allow all for orders" 
  ON public.orders FOR ALL 
  USING (true);

CREATE POLICY IF NOT EXISTS "Allow all for coders" 
  ON public.coders FOR ALL 
  USING (true);