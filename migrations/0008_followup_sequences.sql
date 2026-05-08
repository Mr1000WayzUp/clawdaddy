-- Follow-up sequence tables for 14-day nurture flow
CREATE TABLE IF NOT EXISTS followup_sequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  build_id INTEGER,
  sequence_type TEXT DEFAULT 'standard', -- standard, premium, reengagement
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 7,
  status TEXT DEFAULT 'active', -- active, paused, completed, converted, opted_out
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  next_send_at DATETIME,
  completed_at DATETIME,
  converted_at DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE TABLE IF NOT EXISTS followup_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sequence_id INTEGER NOT NULL,
  lead_id INTEGER NOT NULL,
  step_number INTEGER NOT NULL,
  channel TEXT NOT NULL, -- email, sms
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, sent, failed, opened, replied
  scheduled_at DATETIME,
  sent_at DATETIME,
  opened_at DATETIME,
  replied_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sequence_id) REFERENCES followup_sequences(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE TABLE IF NOT EXISTS outreach_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  build_id INTEGER,
  image_type TEXT DEFAULT 'offer_card', -- offer_card, social_proof, urgency_banner
  image_url TEXT NOT NULL,
  image_prompt TEXT,
  package_tier TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_followup_sequences_lead_id ON followup_sequences(lead_id);
CREATE INDEX IF NOT EXISTS idx_followup_sequences_status ON followup_sequences(status);
CREATE INDEX IF NOT EXISTS idx_followup_sequences_next_send ON followup_sequences(next_send_at);
CREATE INDEX IF NOT EXISTS idx_followup_messages_sequence_id ON followup_messages(sequence_id);
CREATE INDEX IF NOT EXISTS idx_followup_messages_status ON followup_messages(status);
CREATE INDEX IF NOT EXISTS idx_outreach_images_lead_id ON outreach_images(lead_id);

-- Add image_url column to website_builds for generated offer images
ALTER TABLE website_builds ADD COLUMN offer_image_url TEXT;
ALTER TABLE website_builds ADD COLUMN followup_sequence_id INTEGER;
ALTER TABLE website_builds ADD COLUMN outreach_variant TEXT DEFAULT 'A'; -- A/B testing
