-- database/migration_required_roles.sql
-- Script SQL to add required roles support to orders

-- Add required_roles column to the orders table
-- This will store role IDs and names in JSON format
ALTER TABLE IF EXISTS public.orders 
ADD COLUMN IF NOT EXISTS required_roles JSONB DEFAULT '[]'::jsonb;

-- Create index to improve performance when querying by required roles
CREATE INDEX IF NOT EXISTS idx_orders_required_roles ON public.orders USING GIN (required_roles);

-- Function to search orders by required role
CREATE OR REPLACE FUNCTION search_orders_by_role(role_id TEXT)
RETURNS TABLE (
  id INTEGER,
  orderid TEXT,
  adminid TEXT,
  clientname TEXT,
  compensation TEXT,
  description TEXT,
  status TEXT,
  assignedto TEXT,
  createdat TIMESTAMPTZ,
  tags TEXT[],
  required_roles JSONB
) AS 
$$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.orderid,
    o.adminid,
    o.clientname,
    o.compensation,
    o.description,
    o.status,
    o.assignedto,
    o.createdat,
    o.tags,
    o.required_roles
  FROM orders o
  WHERE o.required_roles @> jsonb_build_array(jsonb_build_object('id', role_id));
END;
$$ LANGUAGE plpgsql; 