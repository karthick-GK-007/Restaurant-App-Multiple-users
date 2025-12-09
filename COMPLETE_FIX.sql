-- COMPLETE FIX: Password Verification Function + Reset All Passwords
-- Run this ENTIRE file in Supabase SQL Editor

BEGIN;

-- Step 1: Ensure pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Step 2: Drop and recreate the verification function with comprehensive matching
DROP FUNCTION IF EXISTS verify_hotel_admin_password(TEXT, TEXT);

CREATE OR REPLACE FUNCTION verify_hotel_admin_password(
    p_hotel_identifier TEXT,
    p_password TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    stored_hash TEXT;
    matched_hotel_id TEXT;
    normalized_identifier TEXT;
BEGIN
    -- Validate inputs
    IF p_hotel_identifier IS NULL OR p_hotel_identifier = '' THEN
        RETURN FALSE;
    END IF;
    IF p_password IS NULL OR p_password = '' THEN
        RETURN FALSE;
    END IF;

    -- Normalize the identifier (lowercase, trim)
    normalized_identifier := LOWER(TRIM(p_hotel_identifier));

    -- Comprehensive matching: Try multiple strategies to find the hotel
    SELECT ha.hotel_id, ha.password_hash
    INTO matched_hotel_id, stored_hash
    FROM hotel_admins ha
    JOIN hotels h ON h.id = ha.hotel_id
    WHERE 
        -- Strategy 1: Match by hotel_id (exact, case-insensitive)
        LOWER(ha.hotel_id) = normalized_identifier
        -- Strategy 2: Match by hotel slug (if exists)
        OR LOWER(COALESCE(h.slug, '')) = normalized_identifier
        -- Strategy 3: Match by hotel name (exact, case-insensitive)
        OR LOWER(COALESCE(h.name, '')) = normalized_identifier
        -- Strategy 4: Match by hotel name with spaces replaced by hyphens
        OR LOWER(REPLACE(COALESCE(h.name, ''), ' ', '-')) = normalized_identifier
        -- Strategy 5: Match identifier without "-hotel" to hotel name
        OR LOWER(REPLACE(COALESCE(h.name, ''), ' ', '-')) = REPLACE(normalized_identifier, '-hotel', '')
        -- Strategy 6: Match identifier to hotel name without " hotel" suffix
        OR LOWER(REPLACE(COALESCE(h.name, ''), ' hotel', '')) = REPLACE(normalized_identifier, '-hotel', '')
        OR LOWER(REPLACE(COALESCE(h.name, ''), ' hotel', '')) = normalized_identifier
    LIMIT 1;

    -- If no match found, return false
    IF stored_hash IS NULL OR matched_hotel_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Verify password against stored hash using pgcrypto
    RETURN extensions.crypt(p_password, stored_hash) = stored_hash;
END;
$$;

-- Grant execute permissions
REVOKE ALL ON FUNCTION verify_hotel_admin_password(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_hotel_admin_password(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_hotel_admin_password(TEXT, TEXT) TO authenticated;

-- Step 3: Reset passwords for all hotels
SELECT reset_hotel_admin_password('Hotel-101', 'karthick@123', 'Karthick default');
SELECT reset_hotel_admin_password('Hotel-102', 'suganya@123', 'Suganya default');
SELECT reset_hotel_admin_password('Hotel-001', 'suganya@123', 'Suganya default');
SELECT reset_hotel_admin_password('Hotel-002', 'kagan@123', 'Kagan default');
SELECT reset_hotel_admin_password('Hotel-003', 'karthick@123', 'Karthick default');
SELECT reset_hotel_admin_password('hotel-004', 'maha@123', 'Maha default');

-- Step 4: Test the function with all identifier formats
SELECT 
    'Test Results' as description,
    verify_hotel_admin_password('Hotel-101', 'karthick@123') as hotel_101_id,
    verify_hotel_admin_password('karthick-hotel', 'karthick@123') as karthick_hotel_url,
    verify_hotel_admin_password('karthick', 'karthick@123') as karthick_name,
    verify_hotel_admin_password('Hotel-102', 'suganya@123') as hotel_102_id,
    verify_hotel_admin_password('suganya-hotel', 'suganya@123') as suganya_hotel_url,
    verify_hotel_admin_password('suganya', 'suganya@123') as suganya_name;

COMMIT;

