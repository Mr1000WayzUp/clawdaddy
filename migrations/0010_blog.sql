CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'AI News',
  tags TEXT DEFAULT '[]',
  featured_image_keyword TEXT DEFAULT 'artificial intelligence',
  author TEXT DEFAULT 'Begyn.ai Team',
  status TEXT DEFAULT 'published',
  seo_title TEXT,
  seo_description TEXT,
  source_urls TEXT DEFAULT '[]',
  views INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published_at DESC);

CREATE TABLE IF NOT EXISTS blog_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
INSERT OR IGNORE INTO blog_settings (key, value) VALUES
  ('auto_post_enabled', '1'),
  ('posts_per_day', '4'),
  ('last_auto_post', NULL),
  ('anthropic_api_key', ''),
  ('openai_api_key', '');
