-- Add Houma, LA and surrounding Terrebonne/Lafourche Parish ZIPs
INSERT OR IGNORE INTO zip_queue (zip, city, state, lat, lng, status, priority, seed_zip, distance_from_seed) VALUES
-- Houma LA (core)
('70360', 'Houma', 'LA', 29.5958, -90.7195, 'pending', 22, '78701', 498.0),
('70361', 'Houma', 'LA', 29.5763, -90.7312, 'pending', 22, '78701', 498.2),
('70363', 'Houma', 'LA', 29.6238, -90.7489, 'pending', 22, '78701', 497.8),
('70364', 'Houma', 'LA', 29.5681, -90.6974, 'pending', 21, '78701', 498.5),
-- Thibodaux LA (nearby)
('70301', 'Thibodaux', 'LA', 29.7958, -90.8187, 'pending', 20, '78701', 493.1),
('70302', 'Thibodaux', 'LA', 29.7924, -90.8240, 'pending', 19, '78701', 493.3),
-- Gray / Schriever LA
('70359', 'Gray', 'LA', 29.6680, -90.7718, 'pending', 18, '78701', 496.0),
('70395', 'Schriever', 'LA', 29.7166, -90.8097, 'pending', 18, '78701', 494.5),
-- Chauvin / Montegut LA
('70344', 'Chauvin', 'LA', 29.4451, -90.5951, 'pending', 16, '78701', 502.1),
('70377', 'Montegut', 'LA', 29.4720, -90.5693, 'pending', 16, '78701', 501.8);
