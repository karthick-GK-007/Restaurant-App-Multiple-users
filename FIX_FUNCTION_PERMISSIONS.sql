-- Fix function permissions and ensure it's accessible via Supabase API
-- Run this if the function exists but returns 404

BEGIN;

-- Step 1: Ensure function exists and recreate if needed
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

-- Step 2: Grant explicit permissions to all roles
GRANT EXECUTE ON FUNCTION verify_hotel_admin_password(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_hotel_admin_password(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_hotel_admin_password(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION verify_hotel_admin_password(TEXT, TEXT) TO postgres;

-- Step 3: Verify function is accessible
SELECT 
    'Function created successfully' as status,
    verify_hotel_admin_password('Hotel-101', 'karthick@123') as test_hotel_101,
    verify_hotel_admin_password('Hotel-102', 'suganya@123') as test_hotel_102;

COMMIT;

-- IMPORTANT: After running this, wait 1-2 minutes for Supabase to refresh its schema cache
-- Or try accessing the function via the API again

