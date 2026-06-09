-- Add payment frequency and day-of-month to deals
ALTER TABLE dealer_deals ADD COLUMN pay_frequency TEXT DEFAULT 'monthly';
ALTER TABLE dealer_deals ADD COLUMN payment_day INTEGER;
