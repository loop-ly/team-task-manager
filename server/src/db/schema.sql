-- Team Task Manager schema. Idempotent: safe to run on every boot.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,      -- always stored lower-cased
  password_hash TEXT         NOT NULL,             -- bcrypt hash, never the password
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT         NOT NULL DEFAULT '',
  created_by  INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id   INTEGER     NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      VARCHAR(10) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS team_members_user_idx ON team_members (user_id);

CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  team_id     INTEGER      NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  description TEXT         NOT NULL DEFAULT '',
  status      VARCHAR(12)  NOT NULL DEFAULT 'todo'   CHECK (status IN ('todo', 'in_progress', 'done')),
  priority    VARCHAR(10)  NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date    DATE,
  assignee_id INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_by  INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_team_idx     ON tasks (team_id);
CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON tasks (assignee_id);
CREATE INDEX IF NOT EXISTS tasks_due_idx      ON tasks (due_date);

-- Pending invitations for people who have not registered yet (email sending is stubbed).
CREATE TABLE IF NOT EXISTS team_invites (
  id         SERIAL PRIMARY KEY,
  team_id    INTEGER      NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email      VARCHAR(255) NOT NULL,
  invited_by INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (team_id, email)
);

-- Session store used by connect-pg-simple.
CREATE TABLE IF NOT EXISTS user_sessions (
  sid    VARCHAR     NOT NULL PRIMARY KEY,
  sess   JSON        NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS user_sessions_expire_idx ON user_sessions (expire);
