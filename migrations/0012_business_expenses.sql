-- Company expense tracking: bills, repairs, taxes, registrations

CREATE TABLE IF NOT EXISTS business_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT 'bill',
  description TEXT NOT NULL,
  vendor TEXT,
  amount REAL NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'unpaid',
  deal_id INTEGER REFERENCES dealer_deals(id),
  payment_method TEXT,
  reference_number TEXT,
  recurring INTEGER DEFAULT 0,
  recur_frequency TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_biz_exp_category ON business_expenses(category);
CREATE INDEX IF NOT EXISTS idx_biz_exp_status   ON business_expenses(status);
CREATE INDEX IF NOT EXISTS idx_biz_exp_deal      ON business_expenses(deal_id);
CREATE INDEX IF NOT EXISTS idx_biz_exp_due       ON business_expenses(due_date);
