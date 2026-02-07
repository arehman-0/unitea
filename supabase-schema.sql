-- UniTea Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- APPROVED EMAILS (List A - Unlinkable)
-- ============================================
CREATE TABLE approved_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX idx_approved_emails_hash ON approved_emails(email_hash);

-- ============================================
-- USERS (List B - Token-based, Unlinkable to emails)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id TEXT UNIQUE NOT NULL,
  signature TEXT NOT NULL,
  trust_score DECIMAL(4,2) DEFAULT 2.5,
  total_votes INTEGER DEFAULT 0,
  correct_votes INTEGER DEFAULT 0,
  incorrect_votes INTEGER DEFAULT 0,
  rumors_posted INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_token ON users(token_id);
CREATE INDEX idx_users_trust_score ON users(trust_score);

-- ============================================
-- SERVER KEYS (RSA keypair for blind signatures)
-- ============================================
CREATE TABLE server_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  private_key TEXT NOT NULL,
  public_key TEXT NOT NULL,
  n TEXT NOT NULL,
  e TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- ============================================
-- RUMORS
-- ============================================
CREATE TYPE rumor_state AS ENUM ('NEUTRAL', 'PROBATION', 'EMERGENT_TRUTH', 'FINALIZED');
CREATE TYPE emergent_truth_type AS ENUM ('CONFIRMED', 'DENIED', 'UNDETERMINED');

CREATE TABLE rumors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  author_token_id TEXT NOT NULL REFERENCES users(token_id),
  category TEXT DEFAULT 'general',
  state rumor_state DEFAULT 'NEUTRAL',

  -- Trust scoring
  trust_score DECIMAL(4,2) DEFAULT 2.5,
  frozen_trust_score DECIMAL(4,2),

  -- Vote counts
  confirm_votes INTEGER DEFAULT 0,
  deny_votes INTEGER DEFAULT 0,
  weighted_confirm_votes DECIMAL(10,4) DEFAULT 0,
  weighted_deny_votes DECIMAL(10,4) DEFAULT 0,

  -- Truth determination
  emergent_truth emergent_truth_type,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  state_changed_at TIMESTAMPTZ DEFAULT NOW(),
  finalized_at TIMESTAMPTZ,

  -- Archival
  archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_rumors_state ON rumors(state);
CREATE INDEX idx_rumors_category ON rumors(category);
CREATE INDEX idx_rumors_created_at ON rumors(created_at DESC);
CREATE INDEX idx_rumors_trust_score ON rumors(trust_score);
CREATE INDEX idx_rumors_archived ON rumors(archived);

-- ============================================
-- VOTE TIMESTAMPS (for velocity tracking)
-- ============================================
CREATE TABLE vote_timestamps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rumor_id UUID NOT NULL REFERENCES rumors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vote_timestamps_rumor ON vote_timestamps(rumor_id);
CREATE INDEX idx_vote_timestamps_created ON vote_timestamps(created_at);

-- ============================================
-- VOTES
-- ============================================
CREATE TYPE vote_type AS ENUM ('CONFIRM', 'DENY');

CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rumor_id UUID NOT NULL REFERENCES rumors(id) ON DELETE CASCADE,
  voter_token_id TEXT NOT NULL REFERENCES users(token_id),
  vote_type vote_type NOT NULL,
  feedback TEXT NOT NULL,

  -- Weight calculations
  base_weight DECIMAL(6,4) DEFAULT 1,
  semantic_weight DECIMAL(6,4) DEFAULT 1,
  collusion_weight DECIMAL(6,4) DEFAULT 1,
  final_weight DECIMAL(6,4) DEFAULT 1,

  -- Audit tracking
  audited BOOLEAN DEFAULT FALSE,
  aligned_with_truth BOOLEAN,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  audited_at TIMESTAMPTZ,

  -- Unique constraint: one vote per user per rumor
  UNIQUE(rumor_id, voter_token_id)
);

-- Indexes
CREATE INDEX idx_votes_rumor ON votes(rumor_id);
CREATE INDEX idx_votes_voter ON votes(voter_token_id);
CREATE INDEX idx_votes_audited ON votes(audited);

-- ============================================
-- AUDIT LOG
-- ============================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_type TEXT NOT NULL,
  details JSONB,
  rumors_processed INTEGER DEFAULT 0,
  users_rewarded INTEGER DEFAULT 0,
  users_penalized INTEGER DEFAULT 0,
  duration_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_type ON audit_logs(audit_type);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE approved_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE rumors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_timestamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Public read access for rumors (non-archived)
CREATE POLICY "Rumors are viewable by everyone" ON rumors
  FOR SELECT USING (archived = FALSE);

-- Public read access for votes
CREATE POLICY "Votes are viewable by everyone" ON votes
  FOR SELECT USING (TRUE);

-- Service role has full access (for API operations)
CREATE POLICY "Service role has full access to approved_emails" ON approved_emails
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to users" ON users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to server_keys" ON server_keys
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to rumors" ON rumors
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to vote_timestamps" ON vote_timestamps
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to votes" ON votes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to audit_logs" ON audit_logs
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to calculate vote velocity
CREATE OR REPLACE FUNCTION get_vote_velocity(p_rumor_id UUID, p_window_minutes INTEGER DEFAULT 60)
RETURNS DECIMAL AS $$
DECLARE
  vote_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO vote_count
  FROM vote_timestamps
  WHERE rumor_id = p_rumor_id
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  RETURN vote_count::DECIMAL / p_window_minutes;
END;
$$ LANGUAGE plpgsql;

-- Function to update rumor trust score
CREATE OR REPLACE FUNCTION update_rumor_trust_score(p_rumor_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  total_weighted DECIMAL;
  confirm_ratio DECIMAL;
  new_score DECIMAL;
BEGIN
  SELECT weighted_confirm_votes + weighted_deny_votes INTO total_weighted
  FROM rumors WHERE id = p_rumor_id;

  IF total_weighted = 0 THEN
    RETURN 2.5;
  END IF;

  SELECT weighted_confirm_votes / total_weighted INTO confirm_ratio
  FROM rumors WHERE id = p_rumor_id;

  new_score := confirm_ratio * 5;

  UPDATE rumors SET trust_score = new_score WHERE id = p_rumor_id AND state != 'PROBATION';

  RETURN new_score;
END;
$$ LANGUAGE plpgsql;

-- Function to record a vote
CREATE OR REPLACE FUNCTION record_vote(
  p_rumor_id UUID,
  p_voter_token_id TEXT,
  p_vote_type vote_type,
  p_feedback TEXT,
  p_voter_trust_score DECIMAL
)
RETURNS UUID AS $$
DECLARE
  v_vote_id UUID;
  v_base_weight DECIMAL;
BEGIN
  -- Calculate base weight from voter's trust score
  v_base_weight := p_voter_trust_score / 5.0;

  -- Insert vote
  INSERT INTO votes (rumor_id, voter_token_id, vote_type, feedback, base_weight, final_weight)
  VALUES (p_rumor_id, p_voter_token_id, p_vote_type, p_feedback, v_base_weight, v_base_weight)
  RETURNING id INTO v_vote_id;

  -- Record timestamp for velocity tracking
  INSERT INTO vote_timestamps (rumor_id) VALUES (p_rumor_id);

  -- Update rumor vote counts
  IF p_vote_type = 'CONFIRM' THEN
    UPDATE rumors SET
      confirm_votes = confirm_votes + 1,
      weighted_confirm_votes = weighted_confirm_votes + v_base_weight
    WHERE id = p_rumor_id;
  ELSE
    UPDATE rumors SET
      deny_votes = deny_votes + 1,
      weighted_deny_votes = weighted_deny_votes + v_base_weight
    WHERE id = p_rumor_id;
  END IF;

  -- Update trust score
  PERFORM update_rumor_trust_score(p_rumor_id);

  -- Update user stats
  UPDATE users SET
    total_votes = total_votes + 1,
    last_active_at = NOW()
  WHERE token_id = p_voter_token_id;

  RETURN v_vote_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert a note about unlinkability
COMMENT ON TABLE approved_emails IS 'List A: Email hashes of approved registrations. UNLINKABLE to users table.';
COMMENT ON TABLE users IS 'List B: Token-based users. UNLINKABLE to approved_emails table.';
