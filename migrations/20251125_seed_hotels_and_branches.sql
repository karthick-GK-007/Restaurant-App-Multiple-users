-- Seed Hotels and Branches
-- Run this AFTER running 20251125_fix_branches_primary_key.sql

BEGIN;

-- Insert hotels
INSERT INTO hotels (id, name, slug) VALUES
('hotel-a', 'Hotel A', 'hotel-a'),
('hotel-b', 'Hotel B', 'hotel-b'),
('hotel-c', 'Hotel C', 'hotel-c')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;

-- Insert branches for Hotel A
INSERT INTO branches (id, hotel_id, name, slug) VALUES
('branch-1', 'hotel-a', 'Branch 1', 'branch-1'),
('branch-2', 'hotel-a', 'Branch 2', 'branch-2')
ON CONFLICT (hotel_id, id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;

-- Insert branches for Hotel B (same IDs and slugs work now!)
INSERT INTO branches (id, hotel_id, name, slug) VALUES
('branch-1', 'hotel-b', 'Branch 1', 'branch-1'),
('branch-2', 'hotel-b', 'Branch 2', 'branch-2'),
('branch-3', 'hotel-b', 'Branch 3', 'branch-3')
ON CONFLICT (hotel_id, id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;

-- Insert branches for Hotel C
INSERT INTO branches (id, hotel_id, name, slug) VALUES
('branch-1', 'hotel-c', 'Branch 1', 'branch-1'),
('branch-2', 'hotel-c', 'Branch 2', 'branch-2'),
('branch-3', 'hotel-c', 'Branch 3', 'branch-3')
ON CONFLICT (hotel_id, id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;

COMMIT;

-- Verify the data
SELECT 
    h.name AS hotel_name,
    b.id AS branch_id,
    b.name AS branch_name,
    b.slug AS branch_slug
FROM branches b
JOIN hotels h ON b.hotel_id = h.id
ORDER BY h.name, b.id;

