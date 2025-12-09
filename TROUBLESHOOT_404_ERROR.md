# Troubleshooting: 404 Error for verify_hotel_admin_password

## Problem
The function `verify_hotel_admin_password` exists in the database but returns 404 when called via Supabase API.

## Root Cause
PostgREST (Supabase's API layer) caches the database schema. New functions may not appear until the cache refreshes.

## Solutions (Try in Order)

### Solution 1: Restart Supabase Project (MOST RELIABLE)

1. Go to **Supabase Dashboard** → **Settings** → **General**
2. Scroll down to **"Restart Project"** section
3. Click **"Restart Project"** button
4. Wait 2-3 minutes for restart to complete
5. Try logging in again

**Why this works:** Restarting forces PostgREST to reload its entire schema cache.

---

### Solution 2: Verify Function Exists and Permissions

Run this SQL in Supabase SQL Editor:

```sql
-- Check if function exists
SELECT 
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as parameters,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'verify_hotel_admin_password'
AND n.nspname = 'public';

-- Check permissions
SELECT 
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
AND routine_name = 'verify_hotel_admin_password';
```

**Expected Results:**
- Function should exist in `public` schema
- Parameters should be: `p_hotel_identifier text, p_password text`
- Permissions should include: `anon`, `authenticated`, `service_role`

---

### Solution 3: Recreate Function with Explicit Schema

Run `FORCE_REFRESH_SCHEMA.sql` which:
- Drops and recreates the function with explicit `public.` schema
- Grants all necessary permissions
- Verifies the function

Then **restart the project** (Solution 1).

---

### Solution 4: Wait for Automatic Cache Refresh

PostgREST automatically refreshes its cache every 5-10 minutes. If you've just created the function:
- Wait 5-10 minutes
- Try again

---

### Solution 5: Check API Explorer

1. Go to **Supabase Dashboard** → **API** → **REST**
2. Look for `verify_hotel_admin_password` in the list of available functions
3. If it's NOT listed, the schema cache hasn't refreshed yet

---

## Additional Checks

### Check if hotels table is accessible

The console also shows a 404 for the `hotels` table. Run this SQL:

```sql
-- Check if hotels table exists and has RLS policies
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'hotels'
AND schemaname = 'public';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'hotels';
```

If RLS is enabled but no policies exist, the table won't be accessible via API.

---

## Quick Test

After restarting, test the function directly in SQL Editor:

```sql
SELECT verify_hotel_admin_password('Hotel-101', 'karthick@123');
-- Should return: true
```

If this works but API still returns 404, it's definitely a cache issue - restart the project.

---

## Most Common Fix

**90% of the time, restarting the Supabase project solves this issue.**

1. Settings → General → Restart Project
2. Wait 2-3 minutes
3. Try login again

---

## If Still Not Working

1. Check Supabase status page for any service issues
2. Verify you're using the correct project (check API URL matches)
3. Check browser console for other errors
4. Try accessing the function via Supabase API Explorer directly

