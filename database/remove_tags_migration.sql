-- database/remove_tags_migration.sql
-- Script SQL pour supprimer le support des tags des offres

-- Supprimer la colonne tags de la table orders
ALTER TABLE IF EXISTS public.orders DROP COLUMN IF EXISTS tags;

-- Supprimer l'index pour les tags
DROP INDEX IF EXISTS idx_orders_tags;

-- Supprimer la fonction de recherche par tag
DROP FUNCTION IF EXISTS search_orders_by_tag(TEXT); 