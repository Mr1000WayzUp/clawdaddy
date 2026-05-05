-- Seed leads
INSERT OR IGNORE INTO leads (business_name, owner_name, industry, city, phone, email, address, status, notes, source) VALUES
('Mike''s Plumbing', 'Mike Johnson', 'Home Services', 'Austin', '(512) 555-0101', 'mike@mikesplumbing.com', '123 Main St, Austin TX', 'contacted', 'Interested, call back Thursday', 'google_maps'),
('Sunrise Cafe', 'Maria Garcia', 'Restaurant', 'Austin', '(512) 555-0102', NULL, '456 Oak Ave, Austin TX', 'new', NULL, 'google_maps'),
('Elite Auto Repair', 'Tom Williams', 'Auto Repair', 'Austin', '(512) 555-0103', 'tom@eliteauto.com', '789 Elm St, Austin TX', 'demo_sent', 'Showed mockup, very interested', 'google_maps'),
('Glamour Salon', 'Lisa Chen', 'Salon', 'Austin', '(512) 555-0104', NULL, '321 Pine Rd, Austin TX', 'new', NULL, 'google_maps'),
('FastFix Electrical', 'Bob Martinez', 'Home Services', 'Austin', '(512) 555-0105', 'bob@fastfix.com', '654 Cedar Ln, Austin TX', 'won', 'Closed $1200 deal', 'google_maps'),
('The Burger Joint', 'Sarah Davis', 'Restaurant', 'Houston', '(713) 555-0201', NULL, '100 Burger St, Houston TX', 'new', NULL, 'google_maps'),
('Pro HVAC Solutions', 'James Wilson', 'Home Services', 'Houston', '(713) 555-0202', 'james@prohvac.com', '200 Cool Ave, Houston TX', 'contacted', 'Left voicemail', 'google_maps'),
('City Cuts Barbershop', 'Marcus Lee', 'Salon', 'Houston', '(713) 555-0203', NULL, '300 Trim Blvd, Houston TX', 'new', NULL, 'google_maps'),
('Lopez Landscaping', 'Carlos Lopez', 'Home Services', 'Houston', '(713) 555-0204', 'carlos@lopez.com', '400 Green Way, Houston TX', 'lost', 'Not interested right now', 'google_maps'),
('Tasty Tacos', 'Ana Rodriguez', 'Restaurant', 'Austin', '(512) 555-0106', NULL, '555 Taco Ln, Austin TX', 'new', NULL, 'google_maps'),
('Quick Lube Express', 'Derek Thompson', 'Auto Repair', 'Austin', '(512) 555-0107', NULL, '777 Speed St, Austin TX', 'contacted', 'Appointment set for Monday', 'google_maps'),
('Nails & Spa Heaven', 'Tina Park', 'Salon', 'Dallas', '(214) 555-0301', NULL, '111 Beauty Blvd, Dallas TX', 'new', NULL, 'google_maps');

-- Seed clients
INSERT OR IGNORE INTO clients (lead_id, business_name, owner_name, industry, city, phone, email, package_tier, package_price, recurring_fee, website_url, status, notes) VALUES
(5, 'FastFix Electrical', 'Bob Martinez', 'Home Services', 'Austin', '(512) 555-0105', 'bob@fastfix.com', 'Professional', 1200.00, 75.00, 'https://fastfixelectrical.com', 'active', 'Great client, referred 2 others'),
(NULL, 'Green Valley Nursery', 'Patricia Green', 'Retail', 'Austin', '(512) 555-0200', 'pat@greenvalley.com', 'Basic', 650.00, 50.00, 'https://greenvalleynursery.com', 'active', 'Happy with results'),
(NULL, 'Downtown Dental', 'Dr. Kevin Shaw', 'Healthcare', 'Houston', '(713) 555-0300', 'kevin@downtowndental.com', 'Premium', 3000.00, 150.00, 'https://downtowndental.com', 'active', 'Wants SEO add-on next month'),
(NULL, 'Riverside Diner', 'Jenny Walsh', 'Restaurant', 'Dallas', '(214) 555-0400', NULL, 'Basic', 600.00, 0.00, 'https://riversidediner.com', 'active', NULL);

-- Seed proposals
INSERT OR IGNORE INTO proposals (lead_id, business_name, owner_name, package_tier, package_price, recurring_fee, features, custom_message, status) VALUES
(3, 'Elite Auto Repair', 'Tom Williams', 'Professional', 1500.00, 75.00, 'SEO Optimization,Google Business Profile,Image Gallery,Social Media Links,Analytics', 'Hi Tom, based on our conversation I''ve put together a proposal for a professional website that will help your auto repair shop stand out online.', 'sent'),
(1, 'Mike''s Plumbing', 'Mike Johnson', 'Basic', 750.00, 50.00, 'Contact Form,Mobile Responsive,Google Maps Integration,Click-to-Call', 'Hi Mike, here''s the proposal we discussed. A clean, professional site to help customers find you.', 'draft'),
(11, 'Quick Lube Express', 'Derek Thompson', 'Professional', 1400.00, 75.00, 'SEO Optimization,Google Business Profile,Image Gallery,Social Media Links,Analytics', 'Derek, your shop deserves an online presence! Here''s how we can help.', 'draft');

-- Seed activities
INSERT OR IGNORE INTO activities (entity_type, entity_id, action, description) VALUES
('lead', 1, 'status_change', 'Status changed to contacted'),
('lead', 1, 'note_added', 'Interested, call back Thursday'),
('lead', 3, 'status_change', 'Status changed to demo_sent'),
('lead', 3, 'note_added', 'Showed mockup, very interested'),
('lead', 5, 'status_change', 'Status changed to won'),
('client', 1, 'client_created', 'New client FastFix Electrical onboarded'),
('client', 2, 'client_created', 'New client Green Valley Nursery onboarded'),
('client', 3, 'client_created', 'New client Downtown Dental onboarded'),
('proposal', 1, 'proposal_sent', 'Proposal sent to Elite Auto Repair');

-- Seed tasks
INSERT OR IGNORE INTO tasks (title, description, entity_type, entity_id, due_date, priority, status) VALUES
('Call Mike back', 'He asked to be called Thursday afternoon', 'lead', 1, datetime('now', '+2 days'), 'high', 'pending'),
('Finalize demo for Elite Auto', 'Complete the mockup website before meeting', 'lead', 3, datetime('now', '+1 days'), 'high', 'pending'),
('Send invoice to FastFix', 'Send recurring maintenance invoice', 'client', 1, datetime('now', '+5 days'), 'medium', 'pending'),
('Follow up Quick Lube', 'Appointment set for Monday', 'lead', 11, datetime('now', '+3 days'), 'medium', 'pending'),
('Check SEO progress Downtown Dental', 'Monthly SEO report due', 'client', 3, datetime('now', '+7 days'), 'low', 'pending');
