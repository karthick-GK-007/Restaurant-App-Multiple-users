-- Quick Setup: Create Hotels and Assign Branches
-- Run this script to quickly set up your hotels

BEGIN;

-- ============================================
-- STEP 1: Create Your Hotels
-- ============================================
-- Add your hotels here. Modify the values as needed.

INSERT INTO hotels (id, name, slug) VALUES
('hotel-a', 'Hotel A', 'hotel-a'),
('hotel-b', 'Hotel B', 'hotel-b'),
('hotel-c', 'Hotel C', 'hotel-c'),
('0002-hotel', 'Hotel 0002', '0002-hotel')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;

-- ============================================
-- STEP 2: Assign Existing Branches to Hotels
-- ============================================
-- Update your existing branches here.
-- Replace 'branch-id' with your actual branch IDs.

-- Example: Assign "downtown" branch to "hotel-a"
UPDATE branches
SET hotel_id = 'hotel-a'
WHERE id = 'downtown';

-- Example: Assign "karthick" branch to "0002-hotel"
UPDATE branches
SET hotel_id = '0002-hotel'
WHERE id = 'karthick';

-- Add more UPDATE statements for your branches:
-- UPDATE branches SET hotel_id = 'hotel-a' WHERE id = 'your-branch-id';
-- UPDATE branches SET hotel_id = 'hotel-b' WHERE id = 'another-branch-id';

-- ============================================
-- STEP 3: Fix Any Orphaned Branches
-- ============================================
-- Assign any branches without valid hotels to a default hotel

UPDATE branches
SET hotel_id = 'hotel-a'  -- Change to your preferred default hotel
WHERE hotel_id IS NULL 
   OR hotel_id NOT IN (SELECT id FROM hotels);

COMMIT;

-- ============================================
-- VERIFICATION: Check Your Setup
-- ============================================

-- View all hotels
SELECT 'Hotels:' AS info;
SELECT id, name, slug FROM hotels ORDER BY name;

-- View all branches with their hotels
SELECT 'Branches with Hotels:' AS info;
SELECT 
    h.name AS hotel_name,
    b.id AS branch_id,
    b.name AS branch_name,
    b.hotel_id
FROM branches b
LEFT JOIN hotels h ON b.hotel_id = h.id
ORDER BY h.name, b.name;

-- Check for any problems
SELECT 'Issues Found:' AS info;
SELECT 
    b.id AS branch_id,
    b.name AS branch_name,
    b.hotel_id,
    CASE 
        WHEN b.hotel_id IS NULL THEN '❌ No hotel assigned'
        WHEN h.id IS NULL THEN '❌ Hotel does not exist'
        ELSE '✅ OK'
    END AS status
FROM branches b
LEFT JOIN hotels h ON b.hotel_id = h.id
WHERE b.hotel_id IS NULL OR h.id IS NULL;

