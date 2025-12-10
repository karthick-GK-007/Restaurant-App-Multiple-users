-- WORKAROUND: Table-based password verification
-- If RPC function doesn't work, use this table-based approach
-- This creates a view that PostgREST can query directly

BEGIN;

-- Step 1: Create a view that exposes password verification
-- This view will be queryable via PostgREST
CREATE OR REPLACE VIEW public.hotel_admin_auth_check AS
SELECT 
    ha.hotel_id,
    h.id as hotel_id_from_hotels,
    h.name as hotel_name,
    h.slug as hotel_slug,
    -- Create normalized identifiers for matching
    LOWER(ha.hotel_id) as hotel_id_normalized,
    LOWER(COALESCE(h.slug, '')) as slug_normalized,
    LOWER(COALESCE(h.name, '')) as name_normalized,
    LOWER(REPLACE(COALESCE(h.name, ''), ' ', '-')) as name_slugified,
    LOWER(REPLACE(COALESCE(h.name, ''), ' hotel', '')) as name_without_hotel,
    ha.password_hash,
    ha.password_hint
FROM hotel_admins ha
JOIN hotels h ON h.id = ha.hotel_id;

-- Step 2: Grant access to the view
GRANT SELECT ON public.hotel_admin_auth_check TO anon;
GRANT SELECT ON public.hotel_admin_auth_check TO authenticated;
GRANT SELECT ON public.hotel_admin_auth_check TO service_role;

-- Step 3: Create a helper function that can be called from the client
-- This function will be simpler and more likely to work with PostgREST
CREATE OR REPLACE FUNCTION public.check_hotel_password(
    hotel_identifier text,
    password_to_check text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    matched_record RECORD;
    normalized_id text;
    is_valid boolean := false;
BEGIN
    -- Normalize identifier
    normalized_id := LOWER(TRIM(hotel_identifier));
    
    -- Try to find matching hotel
    SELECT * INTO matched_record
    FROM hotel_admin_auth_check
    WHERE 
        hotel_id_normalized = normalized_id
        OR slug_normalized = normalized_id
        OR name_normalized = normalized_id
        OR name_slugified = normalized_id
        OR name_without_hotel = normalized_id
        OR name_slugified = REPLACE(normalized_id, '-hotel', '')
        OR name_without_hotel = REPLACE(normalized_id, '-hotel', '')
    LIMIT 1;
    
    -- If found, verify password
    IF matched_record.password_hash IS NOT NULL THEN
        is_valid := extensions.crypt(password_to_check, matched_record.password_hash) = matched_record.password_hash;
    END IF;
    
    -- Return result as JSON
    RETURN jsonb_build_object(
        'valid', is_valid,
        'hotel_id', matched_record.hotel_id,
        'hotel_name', matched_record.hotel_name
    );
END;
$$;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION public.check_hotel_password(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_hotel_password(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_hotel_password(text, text) TO service_role;

-- Step 5: Test the new function
SELECT 
    'Workaround Test' as test_type,
    public.check_hotel_password('Hotel-101', 'karthick@123') as hotel_101_test,
    public.check_hotel_password('karthick-hotel', 'karthick@123') as karthick_hotel_test;

COMMIT;

-- USAGE: If verify_hotel_admin_password doesn't work, 
-- you can use check_hotel_password instead in your code.
-- It returns JSON: {"valid": true/false, "hotel_id": "...", "hotel_name": "..."}

