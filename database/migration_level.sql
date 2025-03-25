-- database/migration_level.sql
-- Script SQL pour ajouter le support des niveaux de difficulté aux projets

-- Ajouter une colonne level à la table orders (par défaut niveau 1)
ALTER TABLE IF EXISTS public.orders 
ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;

-- Créer une contrainte de vérification pour s'assurer que le niveau est entre 1 et 6
ALTER TABLE IF EXISTS public.orders 
ADD CONSTRAINT check_level_range CHECK (level >= 1 AND level <= 6);

-- Créer un index pour améliorer les performances des recherches par niveau
CREATE INDEX IF NOT EXISTS idx_orders_level ON public.orders (level);