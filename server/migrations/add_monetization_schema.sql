-- Migration: Add monetization schema for offer system
-- Run this with: psql -U urlshortener -d urlshortener -f migrations/add_monetization_schema.sql
-- Date: 2025-12-23

-- ============================================================================
-- 1. MODIFY urls TABLE
-- ============================================================================

-- Add creator_ip column (IP address of the user who created the link)
ALTER TABLE urls 
ADD COLUMN IF NOT EXISTS creator_ip INET DEFAULT NULL;

-- Add creator_token column (UUID token for tracking anonymous creators)
ALTER TABLE urls 
ADD COLUMN IF NOT EXISTS creator_token UUID DEFAULT NULL;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_urls_creator_token ON urls(creator_token);
CREATE INDEX IF NOT EXISTS idx_urls_creator_ip ON urls(creator_ip);

-- ============================================================================
-- 2. CREATE offer_decisions TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS offer_decisions (
  id SERIAL PRIMARY KEY,
  url_id INTEGER NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
  ip_address INET,
  country_code VARCHAR(2) CHECK (LENGTH(country_code) = 2 AND country_code = UPPER(country_code)),
  showed_offer BOOLEAN NOT NULL DEFAULT FALSE,
  decision_reason TEXT,
  offer_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 3. CREATE INDEXES FOR offer_decisions
-- ============================================================================

-- Index for querying by url_id (most common query)
CREATE INDEX IF NOT EXISTS idx_offer_decisions_url_id ON offer_decisions(url_id);

-- Index for querying by created_at (for time-based analytics)
CREATE INDEX IF NOT EXISTS idx_offer_decisions_created_at ON offer_decisions(created_at);

-- Composite index for common queries (url_id + created_at)
CREATE INDEX IF NOT EXISTS idx_offer_decisions_url_created ON offer_decisions(url_id, created_at);

-- Index for country_code (for geo-based analytics)
CREATE INDEX IF NOT EXISTS idx_offer_decisions_country_code ON offer_decisions(country_code);

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================

GRANT ALL PRIVILEGES ON TABLE offer_decisions TO urlshortener;
GRANT ALL PRIVILEGES ON SEQUENCE offer_decisions_id_seq TO urlshortener;

-- ============================================================================
-- 5. ROLLBACK SCRIPT (uncomment to rollback)
-- ============================================================================

/*
-- WARNING: This will delete all data in offer_decisions table!
-- Only run this if you need to completely remove the monetization schema.

-- Drop indexes first
DROP INDEX IF EXISTS idx_offer_decisions_country_code;
DROP INDEX IF EXISTS idx_offer_decisions_url_created;
DROP INDEX IF EXISTS idx_offer_decisions_created_at;
DROP INDEX IF EXISTS idx_offer_decisions_url_id;

-- Drop the table
DROP TABLE IF EXISTS offer_decisions;

-- Remove columns from urls table
DROP INDEX IF EXISTS idx_urls_creator_ip;
DROP INDEX IF EXISTS idx_urls_creator_token;
ALTER TABLE urls DROP COLUMN IF EXISTS creator_ip;
ALTER TABLE urls DROP COLUMN IF EXISTS creator_token;
*/


