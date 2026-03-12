-- Migration: price_intelligence_fields
-- Date: 2026-03-12
-- Purpose: Add structured product-identification fields to auctions for improved
--          price intelligence accuracy, and trace/inspection columns to
--          auction_ai_metadata for deterministic benchmarking diagnostics.

-- Add optional item detail columns to auctions (for price intelligence accuracy)
ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS model_number TEXT,
  ADD COLUMN IF NOT EXISTS key_specs TEXT;

-- Add trace/inspection columns to auction_ai_metadata
ALTER TABLE auction_ai_metadata
  ADD COLUMN IF NOT EXISTS recommended_unit_price INTEGER,
  ADD COLUMN IF NOT EXISTS recommended_total_price INTEGER,
  ADD COLUMN IF NOT EXISTS comparable_count INTEGER,
  ADD COLUMN IF NOT EXISTS rejected_count INTEGER,
  ADD COLUMN IF NOT EXISTS item_classification TEXT;
