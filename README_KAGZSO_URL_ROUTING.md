# Kagzso URL Routing Implementation

## Overview
Implemented path-based URL routing with separate admin and user URLs stored in the database. URLs follow the format:
- **Admin**: `/kagzso/admin/{hotel_name}/{branch_slug}` → routes to `admin.html`
- **User**: `/kagzso/user/{hotel_name}/{branch_slug}` → routes to `index.html`

## Database Changes

### New Columns in `branches` Table
- `admin_url`: Stores admin URL path (e.g., `kagzso/admin/suganya/madurai`)
- `user_url`: Stores user URL path (e.g., `kagzso/user/suganya/madurai`)

### Migration File
**File**: `migrations/20251125_add_admin_user_url_columns.sql`
- Adds `admin_url` and `user_url` columns
- Populates URLs using format: `kagzso/{admin|user}/{hotel.name}/{branch.slug}`
- Adds indexes and unique constraints

### Per-Hotel Admin Passwords

**File**: `migrations/20251128_add_hotel_admins_auth.sql`
- Creates `hotel_admins` table with `hotel_id`, `password_hash`, optional `password_hint`
- Seeds default passwords for `Hotel-001`–`Hotel-004` (hashed with `pgcrypto`)
- Adds RPC `verify_hotel_admin_password(identifier, password)` so the frontend can validate credentials without revealing hashes
- Grants execute permission to `anon`/`authenticated` roles used by Supabase client
- **Follow-up fix**: `migrations/20251128_fix_hotel_admins_pgcrypto.sql` installs `pgcrypto` into the shared `extensions` schema, sets `search_path = public, extensions`, and allows matching by hotel ID, slug, plain name, or the slugified version of the name (spaces → hyphens). This ensures URLs like `/kagzso/admin/mano-fast-food/...` authenticate correctly.

**Updating/adding passwords**
```sql
INSERT INTO hotel_admins (hotel_id, password_hash, password_hint)
VALUES
  ('Hotel-005', crypt('newpass@123', gen_salt('bf')), 'Optional hint')
ON CONFLICT (hotel_id) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    password_hint = EXCLUDED.password_hint,
    updated_at = NOW();
```
Use the hotel `id`, `slug`, or `name` in URLs— the RPC matches any of those identifiers.

## URL Format Examples

### Admin URLs
- `/kagzso/admin/suganya/madurai` → admin.html (Hotel: suganya, Branch: madurai)
- `/kagzso/admin/suganya` → admin.html (Hotel: suganya, show all branches)
- `/kagzso/admin/kagan/tondairpet` → admin.html (Hotel: kagan, Branch: tondairpet)

### User URLs
- `/kagzso/user/suganya/madurai` → index.html (Hotel: suganya, Branch: madurai)
- `/kagzso/user/suganya` → index.html (Hotel: suganya, show all branches)
- `/kagzso/user/kagan/tondairpet` → index.html (Hotel: kagan, Branch: tondairpet)

## Implementation Details

### 1. BranchRouter Updates (supabase-service.js)
- **parsePath()**: Parses `/kagzso/admin/...` and `/kagzso/user/...` formats
- **getPathFromBranch()**: Constructs URLs using `admin_url`/`user_url` columns
- **getCurrentPageType()**: Determines if current page is admin or user
- **matchesBranch()**: Matches branches by hotel name (from hotels.name) and branch slug
- **resolveSelection()**: Handles hotel-only URLs (returns hotelId but no branchId)

### 2. Hotel Name Matching
- URLs use hotel's `name` field (e.g., "suganya", "kagan")
- Hotel names are normalized (lowercase, spaces replaced with hyphens)
- Matching is case-insensitive

### 3. Branch Slug Matching
- URLs use branch's `slug` field (e.g., "madurai", "tondairpet")
- Matching is case-insensitive

### 4. Hotel-Only URLs
- `/kagzso/admin/{hotel_name}` → Shows all branches for that hotel
- `/kagzso/user/{hotel_name}` → Shows all branches for that hotel
- Branch tiles are clickable to navigate to specific branch URLs

### 5. Page Routing
- Client-side routing detects URL type and redirects if needed
- Supports hash-based routing for static hosting: `index.html#/kagzso/admin/...`
- Also supports path-based routing if server supports it

## Code Changes

### supabase-service.js
- Updated `parsePath()` to handle kagzso format
- Updated `fetchBranches()` to include `admin_url`, `user_url`, and `hotelName`
- Updated `matchesBranch()` to match by hotel name
- Updated `getPathFromBranch()` to use admin_url/user_url columns
- Updated `resolveSelection()` to handle hotel-only URLs

### script.js
- Added routing logic to redirect based on URL type
- Updated hotel resolution to match by hotel name for kagzso format
- Updated branch tiles to be clickable for hotel-only URLs
- Updated branch selection logic to show all branches for hotel-only URLs

### admin.js
- Updated hotel resolution to match by hotel name for kagzso format
- Updated branch tiles to be clickable for hotel-only URLs
- Updated branch selection logic to show all branches for hotel-only URLs

## Usage

### Running the Migration
1. Run `migrations/20251125_add_admin_user_url_columns.sql` in Supabase
2. This will populate `admin_url` and `user_url` for all existing branches

### Running the Server

**Option 1: Node.js Server (Recommended for Path-Based URLs)**
```bash
node server.js
```
Then access:
- **Admin**: `http://localhost:8000/kagzso/admin/suganya/madurai`
- **User**: `http://localhost:8000/kagzso/user/suganya/madurai`

**Option 2: Static Server with Hash-Based URLs**
If using `http-server` or similar static server:
- **Admin**: `http://localhost:8000/admin.html#/kagzso/admin/suganya/madurai`
- **User**: `http://localhost:8000/index.html#/kagzso/user/suganya/madurai`

### Accessing URLs
- **Admin**: Navigate to `/kagzso/admin/suganya/madurai` (requires Node.js server) or use hash: `admin.html#/kagzso/admin/suganya/madurai`
- **User**: Navigate to `/kagzso/user/suganya/madurai` (requires Node.js server) or use hash: `index.html#/kagzso/user/suganya/madurai`

### Hotel-Only Access
- **Admin**: Navigate to `/kagzso/admin/suganya` to see all branches
- **User**: Navigate to `/kagzso/user/suganya` to see all branches
- Click on any branch tile to navigate to that specific branch

## Static Hosting Compatibility

For static hosting (no server-side routing), the system uses hash-based routing:
- URLs are stored as: `kagzso/admin/suganya/madurai`
- Accessed as: `admin.html#/kagzso/admin/suganya/madurai`
- The router automatically handles hash parsing

## Backward Compatibility

The system maintains backward compatibility with:
- Query param format: `?hotel=Hotel-001&branch=branch-1`
- Legacy path format: `/Hotel-001/branch-1`

## Notes

- Hotel names are normalized: spaces → hyphens, lowercase
- Branch slugs are used as-is (from database)
- URLs are unique per branch (enforced by database constraints)
- Both admin and user URLs are stored in the database for easy sharing

