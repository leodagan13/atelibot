-- database/migration_deadline.sql
-- Script SQL pour ajouter le support des deadlines aux offres

-- Ajouter une colonne deadline à la table orders
ALTER TABLE IF EXISTS public.orders 
ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;

-- Créer un index pour améliorer les performances des recherches par deadline
CREATE INDEX IF NOT EXISTS idx_orders_deadline ON public.orders (deadline);

-- Function to get orders with approaching deadlines (within 48 hours)
CREATE OR REPLACE FUNCTION get_approaching_deadlines()
RETURNS TABLE (
  id INTEGER,
  orderid TEXT,
  adminid TEXT,
  clientname TEXT,
  compensation TEXT,
  status TEXT,
  assignedto TEXT,
  deadline TIMESTAMPTZ
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
    o.status,
    o.assignedto,
    o.deadline
  FROM orders o
  WHERE 
    o.status = 'ASSIGNED' 
    AND o.deadline IS NOT NULL
    AND o.deadline > NOW()
    AND o.deadline < NOW() + INTERVAL '48 hours';
END;
$$ LANGUAGE plpgsql;