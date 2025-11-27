-- Helper queries for managing hotels and branches

-- 1. List all hotels
SELECT id, name, slug, created_at 
FROM hotels 
ORDER BY name;

-- 2. List all branches with their hotels
SELECT 
    h.id AS hotel_id,
    h.name AS hotel_name,
    b.id AS branch_id,
    b.name AS branch_name,
    b.slug AS branch_slug
FROM branches b
LEFT JOIN hotels h ON b.hotel_id = h.id
ORDER BY h.name, b.name;

-- 3. Find branches with invalid hotel_id (foreign key violations)
SELECT 
    b.id AS branch_id,
    b.name AS branch_name,
    b.hotel_id,
    CASE 
        WHEN h.id IS NULL THEN '❌ Hotel does not exist'
        ELSE '✅ Hotel exists'
    END AS hotel_status
FROM branches b
LEFT JOIN hotels h ON b.hotel_id = h.id
WHERE h.id IS NULL;

-- 4. Add a new hotel (template)
-- INSERT INTO hotels (id, name, slug) VALUES
-- ('your-hotel-id', 'Your Hotel Name', 'your-hotel-slug')
-- ON CONFLICT (id) DO UPDATE SET
--     name = EXCLUDED.name,
--     slug = EXCLUDED.slug;

-- 5. Update a branch's hotel_id (after ensuring the hotel exists)
-- UPDATE branches
-- SET hotel_id = 'valid-hotel-id'
-- WHERE id = 'branch-id';

-- 6. Create hotel and assign branch in one transaction
-- BEGIN;
-- INSERT INTO hotels (id, name, slug) VALUES
-- ('new-hotel-id', 'New Hotel Name', 'new-hotel-slug')
-- ON CONFLICT (id) DO UPDATE SET
--     name = EXCLUDED.name,
--     slug = EXCLUDED.slug;
-- 
-- UPDATE branches
-- SET hotel_id = 'new-hotel-id'
-- WHERE id = 'branch-id';
-- COMMIT;

