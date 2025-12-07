# Quick Fix Guide - Supabase Client Not Initializing

## The Problem
You're seeing "Supabase client not initialized" errors even though the config is saved in localStorage.

## Solution: Re-configure Supabase

### Step 1: Clear Browser Cache
1. Open your browser
2. Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
3. Select "Cached images and files"
4. Click "Clear data"

### Step 2: Re-configure Supabase
1. Visit: `https://restaurant-app-multiple-users.vercel.app/supabase-config.html`
2. Enter your Supabase credentials:
   - **Supabase URL**: `https://hmupdmxwokdoffehwipz.supabase.co`
   - **Supabase Anon Key**: (Your full anon key)
3. Click **"Save Configuration"**
4. Wait for the success message

### Step 3: Test the Pages

**Admin Page:**
- URL: `https://restaurant-app-multiple-users.vercel.app/admin.html#/kagzso/admin/suganya-hotel/tondairpet`
- Password: `suganya@123`

**User Page:**
- URL: `https://restaurant-app-multiple-users.vercel.app/index.html#/kagzso/user/karthick-hotel/madurai`

### Step 4: Check Console
Open browser console (F12) and look for:
- ✅ `window.SUPABASE_CONFIG set from localStorage`
- ✅ `Supabase client initialized successfully`
- ❌ If you still see errors, check what they say

## If It Still Doesn't Work

### Check localStorage
Run this in the browser console:
```javascript
const config = localStorage.getItem('supabase_config');
console.log('Config:', config);
const parsed = JSON.parse(config);
console.log('Parsed:', parsed);
console.log('window.SUPABASE_CONFIG:', window.SUPABASE_CONFIG);
```

### Verify Supabase Credentials
1. Go to your Supabase Dashboard
2. Settings → API
3. Make sure you're using:
   - **Project URL** (not the anon key URL)
   - **anon/public key** (starts with `eyJ...`)

### Reset Password for Hotel-102
If admin login still fails, run this in Supabase SQL Editor:
```sql
SELECT reset_hotel_admin_password('Hotel-102', 'suganya@123', 'Suganya default');
```

## Working URLs Format

**Use hash-based URLs (most reliable):**

Admin:
```
https://restaurant-app-multiple-users.vercel.app/admin.html#/kagzso/admin/suganya-hotel/tondairpet
```

User:
```
https://restaurant-app-multiple-users.vercel.app/index.html#/kagzso/user/karthick-hotel/madurai
```

**Path-based URLs (should work after Vercel rewrites):**
```
https://restaurant-app-multiple-users.vercel.app/kagzso/admin/suganya-hotel/tondairpet
https://restaurant-app-multiple-users.vercel.app/kagzso/user/karthick-hotel/madurai
```

## Password Reference

- **Suganya Hotel** (Hotel-102): `suganya@123`
- **Karthick Hotel** (Hotel-101): `karthick@123`
- **Kagan Hotel** (Hotel-002): `kagan@123`
- **Maha Hotel** (hotel-004): `maha@123`

