-- Migration: Add limit settings table
-- Run this with: psql -U urlshortener -d urlshortener -f migrations/add_limit_settings.sql

-- Global limit settings
CREATE TABLE IF NOT EXISTS limit_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User-specific limit overrides
CREATE TABLE IF NOT EXISTS user_limit_overrides (
  id SERIAL PRIMARY KEY,
  user_id UUID, -- NULL for anonymous users (fingerprint-based)
  fingerprint VARCHAR(255), -- NULL for registered users (user_id-based)
  limit_enabled BOOLEAN DEFAULT TRUE,
  max_links INTEGER DEFAULT 5,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, fingerprint),
  CHECK ((user_id IS NOT NULL) OR (fingerprint IS NOT NULL))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_limit_overrides_user_id ON user_limit_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_limit_overrides_fingerprint ON user_limit_overrides(fingerprint);

-- Insert default global settings
INSERT INTO limit_settings (setting_key, setting_value, description) 
VALUES 
  ('anonymous_limit_enabled', 'true', 'Enable/disable anonymous user limit globally'),
  ('anonymous_limit_max', '5', 'Maximum number of links for anonymous users')
ON CONFLICT (setting_key) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_limit_settings_updated_at BEFORE UPDATE ON limit_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_limit_overrides_updated_at BEFORE UPDATE ON user_limit_overrides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON limit_settings TO urlshortener;
GRANT ALL PRIVILEGES ON user_limit_overrides TO urlshortener;

