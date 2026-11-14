CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users table (with skills & timezone for the matcher)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  skills TEXT[] NOT NULL DEFAULT '{}',
  desired_skills TEXT[] NOT NULL DEFAULT '{}',
  timezone_offset NUMERIC(4,2) NOT NULL DEFAULT 5.5, -- e.g. 5.5 for IST
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Teams table (denormalized current_member_count for O(1) board reads)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hackathon_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  leader_id UUID NOT NULL REFERENCES users(id),
  min_size INT NOT NULL DEFAULT 2,
  max_size INT NOT NULL DEFAULT 4,
  current_member_count INT NOT NULL DEFAULT 1,
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  is_looking_for_members BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_team_bounds CHECK (
    min_size >= 1 AND
    max_size >= min_size AND
    current_member_count >= 1 AND
    current_member_count <= max_size
  ),
  UNIQUE (hackathon_id, name)
);

-- Fast partial index for GET /api/board (keeps p95 well under 200ms)
CREATE INDEX IF NOT EXISTS idx_board_open_teams
  ON teams (hackathon_id, created_at DESC, id DESC)
  WHERE is_looking_for_members = TRUE;

-- 3. Team Members (Hard rule: 1 team per user per hackathon)
CREATE TABLE IF NOT EXISTS team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hackathon_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('LEADER', 'MEMBER')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id),
  CONSTRAINT one_team_per_user_per_hackathon UNIQUE (hackathon_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_order
  ON team_members (team_id, joined_at ASC);

-- 4. Expiring Invite Codes (High entropy, non-brute-forceable)
CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Join Requests (Leader accepts or declines)
CREATE TABLE IF NOT EXISTS join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hackathon_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- 6. Immutable Audit Log (Who, What, When - survives team deletion)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  hackathon_id TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_team
  ON audit_logs (team_id, created_at DESC);

-- 7. Idempotency Keys (Prevents double-clicks / retry duplicates)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  status_code INT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key, user_id)
);