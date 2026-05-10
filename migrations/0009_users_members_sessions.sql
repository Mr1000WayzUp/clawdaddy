-- App users table (profile info for the admin/owner)
CREATE TABLE IF NOT EXISTS app_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL DEFAULT 'Your Name',
  business_name TEXT NOT NULL DEFAULT 'Your Business',
  email TEXT UNIQUE,
  phone TEXT,
  avatar_initials TEXT DEFAULT 'YB',
  avatar_color TEXT DEFAULT 'green',
  role TEXT DEFAULT 'admin',
  bio TEXT,
  timezone TEXT DEFAULT 'America/Chicago',
  google_id TEXT UNIQUE,
  google_email TEXT,
  google_name TEXT,
  google_picture TEXT,
  auth_provider TEXT DEFAULT 'local', -- local, google
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Team members table
CREATE TABLE IF NOT EXISTS app_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'viewer', -- admin, manager, viewer
  status TEXT DEFAULT 'invited', -- invited, active, suspended
  avatar_initials TEXT,
  avatar_color TEXT DEFAULT 'blue',
  invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active DATETIME,
  permissions TEXT DEFAULT '{}', -- JSON: {leads, proposals, clients, revenue, builder, settings}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- App sessions (for Google OAuth state tracking)
CREATE TABLE IF NOT EXISTS app_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT UNIQUE NOT NULL,
  user_id INTEGER,
  provider TEXT DEFAULT 'local',
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES app_users(id)
);

-- Insert default admin user
INSERT OR IGNORE INTO app_users (id, full_name, business_name, email, avatar_initials, avatar_color, role)
VALUES (1, 'Your Name', 'Your Business', 'admin@yourbusiness.com', 'YB', 'green', 'admin');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_members_email ON app_members(email);
CREATE INDEX IF NOT EXISTS idx_app_members_status ON app_members(status);
CREATE INDEX IF NOT EXISTS idx_app_sessions_token ON app_sessions(session_token);
