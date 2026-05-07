-- =============================================
-- WEBSITE BUILDER + DEEP RESEARCH TABLES
-- =============================================

-- Deep research reports on each business/lead
CREATE TABLE IF NOT EXISTS research_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT,
  city TEXT,
  -- Google Places data
  place_id TEXT,
  google_rating REAL,
  google_review_count INTEGER DEFAULT 0,
  google_types TEXT,           -- JSON array of place types
  google_price_level INTEGER,
  google_hours TEXT,           -- JSON business hours
  google_photos TEXT,          -- JSON photo references
  google_reviews TEXT,         -- JSON top reviews (max 5)
  google_website TEXT,
  google_phone TEXT,
  google_address TEXT,
  -- Competitor analysis
  competitors TEXT,            -- JSON array of nearby competitors
  competitor_count INTEGER DEFAULT 0,
  avg_competitor_rating REAL,
  -- Market intelligence
  market_demand_score INTEGER DEFAULT 0,   -- 0-100
  local_population TEXT,
  median_income TEXT,
  -- Business intelligence extracted
  business_description TEXT,   -- AI-written summary from all data
  key_services TEXT,           -- JSON array of likely services
  target_customers TEXT,       -- who their customers are
  unique_selling_points TEXT,  -- what makes them stand out
  pain_points TEXT,            -- problems a website would solve for them
  -- Content for website
  hero_headline TEXT,          -- generated hero headline
  hero_subheadline TEXT,
  about_us_copy TEXT,
  services_copy TEXT,          -- JSON array of service descriptions
  cta_text TEXT,               -- call to action text
  color_palette TEXT,          -- JSON {primary, secondary, accent}
  brand_tone TEXT,             -- professional/friendly/energetic/etc
  -- Research status
  research_status TEXT DEFAULT 'pending',
  -- pending | running | completed | failed
  research_depth TEXT DEFAULT 'standard',
  -- standard | deep
  sources_checked INTEGER DEFAULT 0,
  confidence_score INTEGER DEFAULT 0,  -- 0-100
  error_message TEXT,
  research_completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Track every auto-generated website build
CREATE TABLE IF NOT EXISTS website_builds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  research_id INTEGER,         -- linked research report
  business_name TEXT NOT NULL,
  industry TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  owner_name TEXT,
  google_rating REAL,
  google_review_count INTEGER DEFAULT 0,
  package_tier TEXT DEFAULT 'Basic',
  -- Basic | Professional | Premium
  build_status TEXT DEFAULT 'queued',
  -- queued | researching | generating | generated | published | failed
  lovable_prompt TEXT,
  lovable_project_url TEXT,
  preview_url TEXT,
  published_url TEXT,
  outreach_status TEXT DEFAULT 'pending',
  -- pending | sent | opened | replied | converted
  outreach_email_sent INTEGER DEFAULT 0,
  outreach_sms_sent INTEGER DEFAULT 0,
  outreach_message TEXT,
  outreach_sent_at DATETIME,
  error_message TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (research_id) REFERENCES research_reports(id)
);

-- Outreach message log
CREATE TABLE IF NOT EXISTS outreach_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  build_id INTEGER NOT NULL,
  lead_id INTEGER NOT NULL,
  channel TEXT NOT NULL,       -- email | sms
  recipient TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'sent',  -- sent | delivered | failed | opened | replied
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (build_id) REFERENCES website_builds(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Builder / outreach configuration
CREATE TABLE IF NOT EXISTS builder_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_research_reports_lead_id ON research_reports(lead_id);
CREATE INDEX IF NOT EXISTS idx_research_reports_status ON research_reports(research_status);
CREATE INDEX IF NOT EXISTS idx_website_builds_lead_id ON website_builds(lead_id);
CREATE INDEX IF NOT EXISTS idx_website_builds_status ON website_builds(build_status);
CREATE INDEX IF NOT EXISTS idx_website_builds_outreach ON website_builds(outreach_status);
CREATE INDEX IF NOT EXISTS idx_outreach_log_build_id ON outreach_log(build_id);

-- Default builder config
INSERT OR IGNORE INTO builder_config (key, value) VALUES
  ('auto_research_on_discover', '1'),
  ('auto_build_after_research', '1'),
  ('auto_outreach', '1'),
  ('research_depth', 'deep'),
  ('owner_name', 'Eric Developing Thompson'),
  ('owner_phone', '(985)860-7891'),
  ('owner_email', 'e.w.Thompson10.10@gmail.com'),
  ('sendgrid_api_key', ''),
  ('twilio_account_sid', ''),
  ('twilio_auth_token', ''),
  ('twilio_from_number', ''),
  ('lovable_api_key', ''),
  ('openai_api_key', ''),
  ('default_package', 'Professional'),
  ('total_builds', '0'),
  ('total_outreach_sent', '0'),
  ('total_researched', '0');
