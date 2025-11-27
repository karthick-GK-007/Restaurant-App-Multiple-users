-- Add missing hotel '0002-hotel' or update existing hotels
-- Run this if you're getting foreign key constraint errors

BEGIN;

-- Insert the missing hotel
INSERT INTO hotels (id, name, slug) VALUES
('0002-hotel', 'Hotel 0002', '0002-hotel')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;

-- If you have other hotels to add, add them here:
-- INSERT INTO hotels (id, name, slug) VALUES
-- ('hotel-xyz', 'Hotel XYZ', 'hotel-xyz')
-- ON CONFLICT (id) DO UPDATE SET
--     name = EXCLUDED.name,
--     slug = EXCLUDED.slug;

COMMIT;

-- Verify the hotel was created
SELECT id, name, slug FROM hotels WHERE id = '0002-hotel';

-- List all hotels
SELECT id, name, slug FROM hotels ORDER BY id;

