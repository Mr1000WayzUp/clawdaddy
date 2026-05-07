-- =============================================
-- AUTO-PROSPECTOR TABLES
-- =============================================

-- ZIP code queue with geo coordinates + status
CREATE TABLE IF NOT EXISTS zip_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zip TEXT NOT NULL UNIQUE,
  city TEXT,
  state TEXT,
  lat REAL,
  lng REAL,
  status TEXT DEFAULT 'pending',
  -- pending | active | exhausted | skipped
  priority INTEGER DEFAULT 0,
  leads_found INTEGER DEFAULT 0,
  leads_terminal INTEGER DEFAULT 0,
  distance_from_seed REAL DEFAULT 0,
  seed_zip TEXT,
  last_searched_at DATETIME,
  exhausted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Configuration for the auto-prospector
CREATE TABLE IF NOT EXISTS prospector_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Log of every auto-search run
CREATE TABLE IF NOT EXISTS search_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zip TEXT NOT NULL,
  city TEXT,
  state TEXT,
  industry TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  -- running | completed | failed
  leads_discovered INTEGER DEFAULT 0,
  leads_added INTEGER DEFAULT 0,
  leads_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Individual discovered businesses from Places API
CREATE TABLE IF NOT EXISTS discovered_places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id TEXT UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  website TEXT,
  has_website INTEGER DEFAULT 0,
  lat REAL,
  lng REAL,
  industry TEXT,
  google_rating REAL,
  google_review_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'new',
  -- new | added_as_lead | skipped_has_website | skipped_duplicate
  lead_id INTEGER,
  run_id INTEGER,
  discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (run_id) REFERENCES search_runs(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_zip_queue_status ON zip_queue(status);
CREATE INDEX IF NOT EXISTS idx_zip_queue_priority ON zip_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_search_runs_zip ON search_runs(zip);
CREATE INDEX IF NOT EXISTS idx_search_runs_status ON search_runs(status);
CREATE INDEX IF NOT EXISTS idx_discovered_places_zip ON discovered_places(zip);
CREATE INDEX IF NOT EXISTS idx_discovered_places_place_id ON discovered_places(place_id);

-- Default prospector config
INSERT OR IGNORE INTO prospector_config (key, value) VALUES
  ('enabled', '1'),
  ('cron_time', '06:00'),
  ('seed_zip', '78701'),
  ('seed_city', 'Austin'),
  ('seed_state', 'TX'),
  ('target_industries', 'Home Services,Restaurant,Salon,Auto Repair,Retail,Healthcare'),
  ('max_results_per_zip', '20'),
  ('max_zips_per_run', '3'),
  ('google_maps_api_key', ''),
  ('last_run_at', ''),
  ('total_leads_found', '0'),
  ('total_zips_worked', '0'),
  ('current_active_zip', ''),
  ('auto_advance_zip', '1'),
  ('skip_has_website', '1');
