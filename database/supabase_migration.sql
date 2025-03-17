-- database/supabase_migration_corrected.sql
-- Script SQL corrigé pour correspondre aux noms de colonnes des screenshots

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
  assignedat TIMESTAMPTZ,
  completedat TIMESTAMPTZ,
  createdat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat TIMESTAMPTZ DEFAULT NOW()
);

-- Coders table
CREATE TABLE IF NOT EXISTS public.coders (
  id SERIAL PRIMARY KEY,
  userid TEXT NOT NULL UNIQUE,
  activeorderid TEXT,
  completedorders INTEGER DEFAULT 0,
  lastactive TIMESTAMPTZ
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coders ENABLE ROW LEVEL SECURITY;

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

CREATE TRIGGER update_orders_updatedat
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Policies for easier development (permissive)
CREATE POLICY IF NOT EXISTS "Allow all for orders" 
  ON public.orders FOR ALL 
  USING (true);

CREATE POLICY IF NOT EXISTS "Allow all for coders" 
  ON public.coders FOR ALL 
  USING (true);

-- Fonctions pour les statistiques
CREATE OR REPLACE FUNCTION calculate_average_completion_time()
RETURNS TABLE (avg_completion_time DOUBLE PRECISION) AS 
$$
BEGIN
  RETURN QUERY
  SELECT
    AVG(EXTRACT(EPOCH FROM (completedat - assignedat)))
  FROM orders
  WHERE 
    status = 'COMPLETED' 
    AND completedat IS NOT NULL 
    AND assignedat IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to get monthly order statistics
CREATE OR REPLACE FUNCTION get_monthly_order_stats()
RETURNS TABLE (
  month TEXT,
  total BIGINT,
  completed BIGINT,
  cancelled BIGINT,
  avg_completion_hours FLOAT
) AS 
$$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(DATE_TRUNC('month', createdat), 'Month YYYY') AS month,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
    COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled,
    AVG(
      CASE 
        WHEN status = 'COMPLETED' AND completedat IS NOT NULL AND assignedat IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (completedat - assignedat)) / 3600 
        ELSE NULL 
      END
    ) AS avg_completion_hours
  FROM orders
  GROUP BY DATE_TRUNC('month', createdat)
  ORDER BY DATE_TRUNC('month', createdat) DESC
  LIMIT 6;
END;
$$ LANGUAGE plpgsql;