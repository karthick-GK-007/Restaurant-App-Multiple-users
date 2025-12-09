# 🔧 Fix Login Issues - Step by Step Guide

## Problem
You're seeing:
- `localStorage supabase_config: null` in console
- `Supabase client not initialized` error
- "Incorrect password" even with correct passwords

## Root Causes
1. **Supabase config not saved** - In incognito mode, localStorage is separate
2. **Password verification function** needs update in database

---

## ✅ Solution (Do These Steps)

### Step 1: Configure Supabase (CRITICAL - Do This First!)

1. **Open your Vercel app** in a **regular (non-incognito) browser window**
   - Go to: `https://restaurant-app-multiple-users.vercel.app/supabase-config.html`

2. **Enter your Supabase credentials:**
   - **Supabase Project URL**: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
   - **Supabase Anon Key**: Your Supabase anon/public key

3. **Click "Save Configuration"**

4. **Verify it saved:**
   - Open browser console (F12)
   - Type: `localStorage.getItem('supabase_config')`
   - You should see your config JSON

5. **If using incognito mode:**
   - You MUST configure it again in incognito mode (localStorage is separate)
   - Or use regular browser window

---

### Step 2: Fix Database Password Verification

1. **Open Supabase Dashboard** → SQL Editor

2. **Run `COMPLETE_FIX.sql`** (entire file):
   - This will:
     - Update the password verification function
     - Reset all passwords to defaults
     - Test the function

3. **Verify passwords are set:**
   ```sql
   SELECT 
       ha.hotel_id,
       h.name as hotel_name,
       CASE WHEN ha.password_hash IS NOT NULL THEN '✅ Set' ELSE '❌ Missing' END as password_status
   FROM hotel_admins ha
   JOIN hotels h ON h.id = ha.hotel_id
   ORDER BY ha.hotel_id;
   ```

---

### Step 3: Test Login

**Default Passwords:**
- **Karthick Hotel** (`karthick-hotel`): `karthick@123`
- **Suganya Hotel** (`suganya-hotel`): `suganya@123`
- **Kagan Hotel** (`kagan-hotel`): `kagan@123`
- **Maha Hotel** (`maha-hotel`): `maha@123`

**Test URLs:**
- Admin: `https://restaurant-app-multiple-users.vercel.app/kagzso/admin/karthick-hotel/tambaram`
- User: `https://restaurant-app-multiple-users.vercel.app/kagzso/user/karthick-hotel/tambaram`

---

## 🔍 Troubleshooting

### If still getting "Supabase client not initialized":

1. **Check localStorage:**
   ```javascript
   // In browser console
   console.log('Config:', localStorage.getItem('supabase_config'));
   console.log('Window config:', window.SUPABASE_CONFIG);
   ```

2. **If null, configure again:**
   - Visit `/supabase-config.html`
   - Save config
   - Refresh the page

3. **Clear cache and reload:**
   - Press `Ctrl+Shift+R` (hard refresh)
   - Or clear browser cache

### If password still fails:

1. **Check which hotel you're accessing:**
   - Look at URL: `/kagzso/admin/suganya-hotel/...` = Suganya Hotel
   - Use password: `suganya@123`

2. **Verify in database:**
   ```sql
   -- Test password verification
   SELECT verify_hotel_admin_password('suganya-hotel', 'suganya@123');
   -- Should return: true
   ```

3. **Reset password if needed:**
   ```sql
   SELECT reset_hotel_admin_password('Hotel-102', 'suganya@123', 'Suganya default');
   ```

---

## 📝 Quick Checklist

- [ ] Configured Supabase in `/supabase-config.html` (in same browser mode you're using)
- [ ] Ran `COMPLETE_FIX.sql` in Supabase SQL Editor
- [ ] Verified passwords are set in database
- [ ] Using correct password for the hotel in URL
- [ ] Hard refreshed page (Ctrl+Shift+R)
- [ ] Checked console for errors

---

## 🚨 Important Notes

1. **Incognito Mode**: localStorage is separate - configure Supabase again in incognito
2. **Browser Cache**: Clear cache if config seems saved but not loading
3. **Hotel Identifier**: The URL identifier (e.g., `suganya-hotel`) must match the hotel name/slug in database
4. **Password Format**: Passwords are case-sensitive

---

## Need Help?

If still having issues, check:
1. Browser console errors (F12)
2. Network tab for failed API calls
3. Supabase logs for RPC function errors

