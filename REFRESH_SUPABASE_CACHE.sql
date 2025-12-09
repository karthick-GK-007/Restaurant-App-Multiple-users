-- Force Supabase/PostgREST to refresh its schema cache
-- This is needed after creating new functions so they become available via the API

-- Method 1: Notify PostgREST to reload schema
-- This is done by calling pg_notify (if available) or by touching a system table
NOTIFY pgrst, 'reload schema';

-- Method 2: Grant explicit permissions (ensures function is accessible)
GRANT EXECUTE ON FUNCTION verify_hotel_admin_password(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_hotel_admin_password(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_hotel_admin_password(TEXT, TEXT) TO service_role;

-- Method 3: Verify the function exists and is in the correct schema
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    CASE 
        WHEN p.prosecdef THEN 'SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
    END as security_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'verify_hotel_admin_password'
AND n.nspname = 'public';

-- Method 4: Test the function directly (bypasses API cache)
SELECT verify_hotel_admin_password('Hotel-101', 'karthick@123') as test_result;

