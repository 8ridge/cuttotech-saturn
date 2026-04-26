-- Authentication schema for local user management
-- Run this with: psql -U urlshortener -d urlshortener -f schema_auth.sql

-- Users table for local authentication
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Update URLs table to reference local users table
-- Note: This will change user_id from UUID (Supabase) to UUID (local)
-- Existing data will need migration if you have users from Supabase

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE users TO urlshortener;

-- Trigger for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

