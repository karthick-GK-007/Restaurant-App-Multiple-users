# Vercel Environment Variables Setup Guide

This guide explains how to configure Supabase credentials using Vercel environment variables for production deployment.

## Overview

The application uses a **two-tier configuration system**:

1. **Production (Vercel)**: Environment variables are injected at build time
2. **Local Development**: Fallback to `localStorage` via `/supabase-config.html`

In production, users **do not need to configure Supabase manually** - it's automatically set via environment variables.

---

## Setting Up Environment Variables in Vercel

### Step 1: Access Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **Restaurant-App-Multiple-users**

### Step 2: Navigate to Environment Variables

1. Click on your project
2. Go to **Settings** → **Environment Variables**

### Step 3: Add Environment Variables

Add the following two environment variables:

#### Variable 1: `NEXT_PUBLIC_SUPABASE_URL`

- **Name**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: Your Supabase project URL
  - Format: `https://xxxxx.supabase.co`
  - Found in: Supabase Dashboard → Project Settings → API → Project URL
- **Environment**: Select all (Production, Preview, Development)

#### Variable 2: `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: Your Supabase anon/public key
  - Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  - Found in: Supabase Dashboard → Project Settings → API → Project API keys → `anon` `public`
- **Environment**: Select all (Production, Preview, Development)

### Step 4: Save and Redeploy

1. Click **Save** for each variable
2. Go to **Deployments** tab
3. Click **Redeploy** on the latest deployment (or push a new commit)
4. The build script (`build.js`) will automatically inject these variables into the HTML files

---

## How It Works

### Build Process

1. When Vercel builds your project, it runs `build.js`
2. `build.js` reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. These values are injected into `admin.html` and `index.html` as inline scripts
4. The injected script sets `window.__VERCEL_SUPABASE_URL__` and `window.__VERCEL_SUPABASE_ANON_KEY__`

### Runtime Configuration Loading

The application checks for configuration in this order:

1. **Vercel Environment Variables** (Production)
   - Injected at build time
   - Available as `window.__VERCEL_SUPABASE_URL__` and `window.__VERCEL_SUPABASE_ANON_KEY__`

2. **localStorage** (Local Development Fallback)
   - Used when env vars are not available
   - Configured via `/supabase-config.html`

3. **Error Handling**
   - If neither is available, the app shows helpful error messages
   - In local development, it redirects to `/supabase-config.html`

---

## Verification

### Check if Environment Variables are Set

1. Deploy to Vercel
2. Open your deployed app
3. Open browser console (F12)
4. Look for: `✅ window.SUPABASE_CONFIG set from Vercel environment variables (production)`

### If You See Errors

If you see: `❌ window.SUPABASE_CONFIG not properly set!`

**Possible causes:**

1. **Environment variables not set in Vercel**
   - Solution: Add them in Vercel dashboard (see Step 3 above)

2. **Build script didn't run**
   - Solution: Check `vercel.json` has `"buildCommand": "node build.js"`
   - Verify `build.js` exists in your repository

3. **Variables not available during build**
   - Solution: Ensure variables are set for the correct environment (Production/Preview/Development)
   - Redeploy after adding variables

---

## Local Development

For local development, you have two options:

### Option 1: Use supabase-config.html (Recommended)

1. Run your local server: `npx http-server -p 8000`
2. Visit: `http://localhost:8000/supabase-config.html`
3. Enter your Supabase credentials
4. They will be saved to `localStorage`

### Option 2: Set Environment Variables Locally

If you want to test the build process locally:

```bash
# Windows PowerShell
$env:NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
node build.js

# Linux/Mac
export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
node build.js
```

Then serve the files:
```bash
npx http-server -p 8000
```

---

## Troubleshooting

### Build Script Warnings

If you see during build:
```
⚠️  WARNING: Supabase environment variables not found!
```

**This is normal for:**
- First-time setup (before variables are added)
- Local development (when not using env vars)

**The app will still work** by falling back to `localStorage` configuration.

### Variables Not Injecting

1. **Check vercel.json**:
   ```json
   {
     "buildCommand": "node build.js",
     ...
   }
   ```

2. **Check build.js exists** in repository root

3. **Check build logs** in Vercel dashboard:
   - Go to Deployment → Build Logs
   - Look for `✅ Found Supabase environment variables`

### Production Users Still See Config Page

If production users are redirected to `/supabase-config.html`:

1. **Check environment variables are set** in Vercel dashboard
2. **Verify they're set for Production environment** (not just Preview/Development)
3. **Redeploy** after adding variables
4. **Check browser console** for specific error messages

---

## Security Notes

- **Anon keys are safe to expose** - They're designed to be public and have Row Level Security (RLS) protection
- **Never commit** your actual Supabase credentials to Git
- **Use environment variables** for all sensitive configuration
- The `supabase-config.html` page is kept for local development convenience only

---

## Quick Reference

### Environment Variable Names
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon/public key

### Files Involved
- `build.js` - Build script that injects env vars
- `vercel.json` - Vercel configuration with build command
- `admin.html` - Admin panel (receives injected config)
- `index.html` - User interface (receives injected config)
- `supabase-service.js` - Config loading logic
- `supabase-config.html` - Local dev fallback page

### Where to Find Supabase Credentials
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Find:
   - **Project URL**: Under "Project URL"
   - **Anon Key**: Under "Project API keys" → `anon` `public`

---

## Support

If you encounter issues:

1. Check Vercel build logs for errors
2. Check browser console for specific error messages
3. Verify environment variables are set correctly
4. Ensure you've redeployed after adding variables

