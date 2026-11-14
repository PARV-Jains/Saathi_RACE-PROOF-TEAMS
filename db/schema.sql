

CREATE TABLE users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hackathons (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  min_team_size int  NOT NULL DEFAULT 1,
  max_team_size int  NOT NULL DEFAULT 4,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_size_bounds CHECK (min_team_size >= 1 AND max_team_size >= min_team_size)
);

CREATE TABLE teams (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hackathon_id uuid NOT NULL REFERENCES hackathons(id),
  name         text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  leader_id    uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hackathon_id, name)
);


CREATE TABLE team_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hackathon_id uuid NOT NULL REFERENCES hackathons(id),
  user_id      uuid NOT NULL REFERENCES users(id),
  joined_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (team_id, user_id)
);
CREATE UNIQUE INDEX one_team_per_user_per_hackathon
  ON team_members (hackathon_id, user_id);
CREATE INDEX team_members_team_joined ON team_members (team_id, joined_at, id);


CREATE TABLE invite_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  code_hash   bytea NOT NULL UNIQUE,
  created_by  uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz
);

CREATE TABLE join_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hackathon_id uuid NOT NULL REFERENCES hackathons(id),
  user_id      uuid NOT NULL REFERENCES users(id),
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  decided_at   timestamptz,
  decided_by   uuid REFERENCES users(id)
);
CREATE UNIQUE INDEX one_pending_request_per_user_team
  ON join_requests (team_id, user_id) WHERE status = 'pending';
CREATE INDEX join_requests_user_pending
  ON join_requests (hackathon_id, user_id) WHERE status = 'pending';


CREATE TABLE idempotency_keys (
  user_id      uuid NOT NULL,
  key          text NOT NULL CHECK (length(key) BETWEEN 1 AND 255),
  operation    text NOT NULL,
  request_hash text NOT NULL,
  response     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);


CREATE TABLE audit_logs (
  id           bigserial PRIMARY KEY,
  at           timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_id     uuid NOT NULL,
  action       text NOT NULL,
  team_id      uuid,
  hackathon_id uuid,
  details      jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX audit_logs_team ON audit_logs (team_id, id);


CREATE FUNCTION audit_logs_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END $$;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
