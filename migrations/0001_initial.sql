-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_name TEXT NOT NULL,
  owner_name TEXT,
  industry TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  google_maps_url TEXT,
  has_website INTEGER DEFAULT 0,
  website_url TEXT,
  status TEXT DEFAULT 'new',
  notes TEXT,
  source TEXT DEFAULT 'google_maps',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  business_name TEXT NOT NULL,
  owner_name TEXT,
  industry TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  package_tier TEXT NOT NULL,
  package_price REAL NOT NULL,
  recurring_fee REAL DEFAULT 0,
  website_url TEXT,
  status TEXT DEFAULT 'active',
  start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  client_id INTEGER,
  business_name TEXT NOT NULL,
  owner_name TEXT,
  package_tier TEXT NOT NULL,
  package_price REAL NOT NULL,
  recurring_fee REAL DEFAULT 0,
  features TEXT,
  custom_message TEXT,
  status TEXT DEFAULT 'draft',
  sent_at DATETIME,
  viewed_at DATETIME,
  accepted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Activities table (timeline/audit log)
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  entity_type TEXT,
  entity_id INTEGER,
  due_date DATETIME,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry);
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
