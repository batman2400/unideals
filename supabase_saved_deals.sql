-- ============================================================
-- Uni Deals — Phase 3: Saved Deals Schema
-- ============================================================

-- Create the saved_deals junction table
CREATE TABLE saved_deals (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id BIGINT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, deal_id) -- Composite key prevents duplicate saves
);

-- Enable Row Level Security
ALTER TABLE saved_deals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read only their own saved deals
CREATE POLICY "Users can view own saved deals"
  ON saved_deals
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own saved deals
CREATE POLICY "Users can insert own saved deals"
  ON saved_deals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own saved deals
CREATE POLICY "Users can delete own saved deals"
  ON saved_deals
  FOR DELETE
  USING (auth.uid() = user_id);
