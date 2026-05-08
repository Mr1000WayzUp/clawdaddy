-- Add payment processing tables
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  client_id INTEGER,
  proposal_id INTEGER,
  stripe_invoice_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'draft',
  description TEXT,
  due_date DATE,
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (proposal_id) REFERENCES proposals(id)
);

CREATE INDEX idx_invoices_lead_id ON invoices(lead_id);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_proposal_id ON invoices(proposal_id);
CREATE INDEX idx_invoices_stripe_invoice_id ON invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  plan_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  interval TEXT DEFAULT 'month',
  status TEXT DEFAULT 'active',
  current_period_start DATETIME,
  current_period_end DATETIME,
  cancel_at_period_end BOOLEAN DEFAULT 0,
  canceled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX idx_subscriptions_client_id ON subscription_plans(client_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscription_plans(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscription_plans(status);

-- Add Stripe payment link columns to proposals
ALTER TABLE proposals ADD COLUMN stripe_payment_link TEXT;
ALTER TABLE proposals ADD COLUMN payment_status TEXT DEFAULT 'pending';

-- Add payment tracking to clients
ALTER TABLE clients ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE clients ADD COLUMN payment_method_on_file BOOLEAN DEFAULT 0;
