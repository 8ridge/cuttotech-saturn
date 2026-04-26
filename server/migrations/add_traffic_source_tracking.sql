-- Migration: Add traffic source tracking for advertising campaigns
-- Run this with: psql -U urlshortener -d urlshortener -f migrations/add_traffic_source_tracking.sql
-- Date: 2025-01-XX

-- ============================================================================
-- 1. ADD TRAFFIC SOURCE COLUMNS TO urls TABLE
-- ============================================================================

-- UTM parameters
ALTER TABLE urls 
ADD COLUMN IF NOT EXISTS utm_source VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS utm_content VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS utm_term VARCHAR(255) DEFAULT NULL;

-- Google Ads click ID
ALTER TABLE urls 
ADD COLUMN IF NOT EXISTS gclid VARCHAR(255) DEFAULT NULL;

-- Referrer (HTTP referer header)
ALTER TABLE urls 
ADD COLUMN IF NOT EXISTS referrer TEXT DEFAULT NULL;

-- ============================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for utm_campaign (most important for analytics)
CREATE INDEX IF NOT EXISTS idx_urls_utm_campaign ON urls(utm_campaign);

-- Index for utm_source
CREATE INDEX IF NOT EXISTS idx_urls_utm_source ON urls(utm_source);

-- Index for gclid (for Google Ads tracking)
CREATE INDEX IF NOT EXISTS idx_urls_gclid ON urls(gclid);

-- Composite index for campaign analytics
CREATE INDEX IF NOT EXISTS idx_urls_utm_campaign_created ON urls(utm_campaign, created_at);

-- ============================================================================
-- 3. GRANT PERMISSIONS
-- ============================================================================

-- Permissions are already granted on urls table, but ensure they exist
GRANT ALL PRIVILEGES ON TABLE urls TO urlshortener;

-- ============================================================================
-- 4. ROLLBACK SCRIPT (uncomment to rollback)
-- ============================================================================

/*
-- WARNING: This will remove all traffic source tracking data!

-- Drop indexes first
DROP INDEX IF EXISTS idx_urls_utm_campaign_created;
DROP INDEX IF EXISTS idx_urls_gclid;
DROP INDEX IF EXISTS idx_urls_utm_source;
DROP INDEX IF EXISTS idx_urls_utm_campaign;

-- Remove columns from urls table
ALTER TABLE urls 
DROP COLUMN IF EXISTS utm_source,
DROP COLUMN IF EXISTS utm_medium,
DROP COLUMN IF EXISTS utm_campaign,
DROP COLUMN IF EXISTS utm_content,
DROP COLUMN IF EXISTS utm_term,
DROP COLUMN IF EXISTS gclid,
DROP COLUMN IF EXISTS referrer;
*/

