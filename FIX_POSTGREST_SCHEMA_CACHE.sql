-- AGGRESSIVE FIX: Force PostgREST to recognize verify_hotel_admin_password
-- This script does everything possible to make the function visible to PostgREST

BEGIN;

-- Step 1: Completely remove all versions of the function
DROP FUNCTION IF EXISTS verify_hotel_admin_password(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.verify_hotel_admin_password(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS verify_hotel_admin_password(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.verify_hotel_admin_password(text, text) CASCADE;

-- Step 2: Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Step 3: Recreate the function with explicit public schema and exact parameter types
CREATE OR REPLACE FUNCTION public.verify_hotel_admin_password(
    p_hotel_identifier text,
    p_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    stored_hash text;
    matched_hotel_id text;
    normalized_identifier text;
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

-- Step 4: Grant explicit permissions to ALL roles (including anon)
GRANT EXECUTE ON FUNCTION public.verify_hotel_admin_password(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_hotel_admin_password(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_hotel_admin_password(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_hotel_admin_password(text, text) TO postgres;

-- Step 5: Explicitly expose the function to PostgREST by ensuring it's in public schema
ALTER FUNCTION public.verify_hotel_admin_password(text, text) OWNER TO postgres;

-- Step 6: Verify function exists and is accessible
SELECT 
    'Function Verification' as status,
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as parameters,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'verify_hotel_admin_password'
AND n.nspname = 'public';

-- Step 7: Test the function directly
SELECT 
    'Direct Function Test' as test_type,
    public.verify_hotel_admin_password('Hotel-101', 'karthick@123') as hotel_101_result,
    public.verify_hotel_admin_password('Hotel-102', 'suganya@123') as hotel_102_result,
    public.verify_hotel_admin_password('karthick-hotel', 'karthick@123') as karthick_hotel_result;

COMMIT;

-- CRITICAL: After running this script:
-- 1. Go to Supabase Dashboard → Settings → General
-- 2. Click "Restart Project" 
-- 3. Wait 3-5 minutes for full restart
-- 4. Clear browser cache (Ctrl+Shift+Delete) or use Incognito mode
-- 5. Try login again

-- If still not working, try this additional step:
-- Run this query to check PostgREST schema exposure:
-- SELECT * FROM pg_catalog.pg_proc WHERE proname = 'verify_hotel_admin_password';

