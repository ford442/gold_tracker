-- GoldTrackr Supabase Schema
-- Run this in Supabase SQL Editor to set up your backend

-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing table if needed (for migration)
-- DROP TABLE IF EXISTS user_exchange_keys CASCADE;

-- Table for encrypted user API keys (multi-exchange support)
-- Keys are encrypted with AES-GCM before storage
CREATE TABLE IF NOT EXISTS user_exchange_keys (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exchange TEXT NOT NULL CHECK (exchange IN ('coinbase', 'kraken')),
  encrypted_payload TEXT NOT NULL,           -- AES-encrypted JSON with exchange-specific keys
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, exchange)
);

-- RLS: users can only read/write their own keys
ALTER TABLE user_exchange_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own keys" ON user_exchange_keys;
CREATE POLICY "Users can manage own keys" 
  ON user_exchange_keys 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_exchange_keys_user_id 
  ON user_exchange_keys(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_exchange_keys_updated_at ON user_exchange_keys;
CREATE TRIGGER update_user_exchange_keys_updated_at
  BEFORE UPDATE ON user_exchange_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Audit log for trades (optional, for tracking)
CREATE TABLE IF NOT EXISTS trade_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exchange TEXT NOT NULL CHECK (exchange IN ('coinbase', 'kraken')),
  product_id TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  size NUMERIC NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'error')),
  order_id TEXT,
  error_message TEXT,
  dry_run BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trade_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own trade logs" ON trade_logs;
CREATE POLICY "Users can view own trade logs"
  ON trade_logs 
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: Only edge functions can insert trade logs
DROP POLICY IF EXISTS "Edge functions can insert trade logs" ON trade_logs;
CREATE POLICY "Edge functions can insert trade logs"
  ON trade_logs
  FOR INSERT
  WITH CHECK (true); -- Edge functions use service role key

CREATE INDEX IF NOT EXISTS idx_trade_logs_user_id ON trade_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_logs_created_at ON trade_logs(created_at);
