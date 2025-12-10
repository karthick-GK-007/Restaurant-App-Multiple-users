-- DIAGNOSTIC: Check what PostgREST can see
-- Run this to see if PostgREST can access the function

-- 1. Check function exists
SELECT 
    'Function Exists Check' as check_type,
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as parameters,
    p.proacl as permissions,
    CASE 
        WHEN p.proacl IS NULL THEN 'No explicit permissions'
        ELSE 'Has permissions'
    END as permission_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'verify_hotel_admin_password'
AND n.nspname = 'public';

-- 2. Check if function is exposed to anon role
SELECT 
    'Permission Check' as check_type,
    has_function_privilege('anon', 'public.verify_hotel_admin_password(text, text)', 'EXECUTE') as anon_can_execute,
    has_function_privilege('authenticated', 'public.verify_hotel_admin_password(text, text)', 'EXECUTE') as authenticated_can_execute,
    has_function_privilege('service_role', 'public.verify_hotel_admin_password(text, text)', 'EXECUTE') as service_role_can_execute;

-- 3. List all functions in public schema (to see what PostgREST should see)
SELECT 
    'All Public Functions' as check_type,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as parameters
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%hotel%'
ORDER BY p.proname;

