-- Dealership In-House Payment Tracking

CREATE TABLE IF NOT EXISTS dealer_customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dealer_deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES dealer_customers(id) ON DELETE CASCADE,
  vehicle_year TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_vin TEXT,
  vehicle_color TEXT,
  vehicle_stock TEXT,
  sale_price REAL NOT NULL DEFAULT 0,
  down_payment REAL NOT NULL DEFAULT 0,
  amount_financed REAL NOT NULL DEFAULT 0,
  deal_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dealer_payment_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES dealer_deals(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount_due REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dealer_payment_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES dealer_deals(id) ON DELETE CASCADE,
  schedule_id INTEGER REFERENCES dealer_payment_schedules(id),
  paid_date DATE NOT NULL,
  amount_paid REAL NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  reference_number TEXT,
  received_by TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dealer_deals_customer ON dealer_deals(customer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_schedules_deal ON dealer_payment_schedules(deal_id);
CREATE INDEX IF NOT EXISTS idx_dealer_schedules_due ON dealer_payment_schedules(due_date);
CREATE INDEX IF NOT EXISTS idx_dealer_records_deal ON dealer_payment_records(deal_id);
CREATE INDEX IF NOT EXISTS idx_dealer_records_schedule ON dealer_payment_records(schedule_id);
