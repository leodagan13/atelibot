-- database/migration_tags.sql
-- Script SQL pour ajouter le support des tags aux offres

-- Ajouter une colonne tags à la table orders
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Créer un index pour améliorer les performances des recherches par tags
CREATE INDEX IF NOT EXISTS idx_orders_tags ON public.orders USING GIN (tags);

-- Fonction pour rechercher des offres par tag
CREATE OR REPLACE FUNCTION search_orders_by_tag(search_tag TEXT)
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
  tags TEXT[]
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
    o.tags
  FROM orders o
  WHERE search_tag = ANY(o.tags);
END;
$$ LANGUAGE plpgsql; 