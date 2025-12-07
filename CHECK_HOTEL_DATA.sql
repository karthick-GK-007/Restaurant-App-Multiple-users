-- Check hotel data to see what identifiers will work
-- Run this in Supabase SQL Editor to see the actual hotel names and IDs

SELECT 
    h.id as hotel_id,
    h.name as hotel_name,
    h.slug as hotel_slug,
    LOWER(h.id) as normalized_id,
    LOWER(h.name) as normalized_name,
    LOWER(REPLACE(h.name, ' ', '-')) as normalized_name_with_hyphens,
    LOWER(COALESCE(h.slug, '')) as normalized_slug,
    CASE 
        WHEN ha.password_hash IS NOT NULL THEN 'Has password'
        ELSE 'No password'
    END as password_status
FROM hotels h
LEFT JOIN hotel_admins ha ON h.id = ha.hotel_id
ORDER BY h.id;

-- Test password verification with different identifiers
-- Replace 'suganya@123' with the actual password you're using

SELECT 'Testing Hotel-001' as test, verify_hotel_admin_password('Hotel-001', 'suganya@123') as result
UNION ALL
SELECT 'Testing hotel-001', verify_hotel_admin_password('hotel-001', 'suganya@123')
UNION ALL
SELECT 'Testing suganya', verify_hotel_admin_password('suganya', 'suganya@123')
UNION ALL
SELECT 'Testing suganya-hotel', verify_hotel_admin_password('suganya-hotel', 'suganya@123')
UNION ALL
SELECT 'Testing Suganya', verify_hotel_admin_password('Suganya', 'suganya@123');

