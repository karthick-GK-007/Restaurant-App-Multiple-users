# Supabase Tenant Migration

## Overview
- Migrates menu, checkout, and admin data flows from local JSON/Google Sheets into Supabase.
- Adds tenant awareness via `branch_id`, Supabase migrations, and RLS policies with zero UI/CSS changes.
- Preserves offline/localStorage fallbacks so behavior is identical if Supabase is unavailable.

## Prerequisites
1. Supabase project with SQL editor access and JWTs that can carry a `branch_id` claim (or use service-role keys).
2. Supabase JS client already linked in `index.html` / `admin.html` via CDN.
3. Copy `supabase-config.js.example` to `supabase-config.js` (ignored by git) and set real credentials:
   ```js
   window.SUPABASE_CONFIG = {
     url: 'https://PROJECT.supabase.co',
     anonKey: 'public-anon-key',
     serviceRoleKey: 'service-role-key-if-needed'
   };
   ```
   Load this script before `supabase-service.js`.

## Apply Database Changes
1. Tenant schema migration:
   ```sql
   \i migrations/20251125_add_supabase_tenants.sql
   ```
   Creates `branches`, adds `branch_id` columns, seeds `demo-branch`, and builds tenant indexes.
2. RLS migration:
   ```sql
   \i migrations/20251125_rls_policies.sql
   ```
   Enables tenant RLS policies referencing the `branch_id` JWT claim (service role bypasses).
3. Only adjust `current_branch_id()` if your JWT format differs.

## Seed Data
1. Confirm `branches` contains at least one real branch (demo entry is inserted automatically).
2. Import `data/menu.json` into `menu_items` via Supabase Table Editor → Import JSON. Required fields: `id`, `branch_id`, `branch_name`, `name`, `category`, `price`, `has_sizes`, `sizes`, GST metadata, etc.
3. Import `data/sales.json` into `transactions` and `transaction_items`. Example:
   ```sql
   INSERT INTO transactions (id, branch_id, branch_name, date, date_time, order_type,
     total_base_amount, total_cgst_amount, total_sgst_amount, total_gst_amount,
     total, payment_mode, applied_gst_rate, show_tax_on_bill)
   VALUES (...);
   ```
   Insert corresponding rows into `transaction_items` with matching `transaction_id` + `branch_id`.
4. Update the `branches` table with real names, slugs, and QR URLs for every tenant.

## App Configuration
1. Keep `supabase-service.js` included before `script.js` and `admin.js`.
2. Deploy `supabase-config.js` to each environment without committing actual keys.
3. Offline caches live in `branches_cache`, `menu_<branch>`, and `restaurant_sales` localStorage keys.

## Testing Checklist
Tracked in `tests/after/test-results.md`.
- Menu load per branch (Supabase) – NOT RUN (requires manual browser test).
- Cart workflow & checkout – NOT RUN (manual verification required).
- Supabase order persistence – NOT RUN (confirm via Supabase dashboard after checkout).
- Admin sales filters/summary – NOT RUN (needs real data).
- Offline fallback (invalid Supabase key) – NOT RUN (manually tamper config to confirm localStorage path).
- Before/after screenshots – NOT RUN (capture locally; placeholders present under `tests/before` and `tests/after`).

## Rollback Plan
1. Restore JS/service files from `backup/original-20251125204049/` or reset the branch.
2. Database rollback template:
   ```sql
   BEGIN;
   DROP POLICY IF EXISTS tenant_read_transaction_items ON transaction_items;
   DROP POLICY IF EXISTS tenant_write_transaction_items ON transaction_items;
   DROP POLICY IF EXISTS tenant_read_transactions ON transactions;
   DROP POLICY IF EXISTS tenant_write_transactions ON transactions;
   DROP POLICY IF EXISTS tenant_select_menu_items ON menu_items;
   DROP POLICY IF EXISTS tenant_write_menu_items ON menu_items;
   DROP POLICY IF EXISTS tenant_select_branches ON branches;
   DROP POLICY IF EXISTS tenant_modify_branches ON branches;
   ALTER TABLE transaction_items DROP COLUMN IF EXISTS branch_id;
   ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_branch_fk;
   ALTER TABLE transactions DROP COLUMN IF EXISTS branch_id;
   ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS menu_items_branch_fk;
   ALTER TABLE menu_items DROP COLUMN IF EXISTS branch_id;
   DROP TABLE IF EXISTS branches;
   DROP FUNCTION IF EXISTS public.current_branch_id();
   DROP FUNCTION IF EXISTS public.is_service_role();
   COMMIT;
   ```
3. Remove `supabase-config.js` from deployments if reverting fully to local JSON mode.

## Strict Tenant Isolation

**IMPORTANT**: This migration enforces strict tenant isolation where each branch (Demo Branch, Downtown Branch, etc.) is treated as a completely separate vendor. Cross-tenant data access is blocked at both frontend and backend levels.

### Frontend Enforcement:
- **Admin Panel**: Removed "All Branches" option. Admins must select a specific branch and can only view/manage that branch's data.
- **User Menu**: Users can only see menu items for their selected branch.
- **Sales/Transactions**: All queries filter by `branch_id` - no cross-tenant data is ever displayed.
- **URL Routing**: Branch selection is encoded in URLs (`?branch=demo`) for shareable links while maintaining isolation.

### Backend Enforcement:
- **RLS Policies**: Run `migrations/20251125_strict_tenant_isolation_rls.sql` to remove NULL fallback policies that could allow cross-tenant access.
- **Client-Side Filtering**: All Supabase queries include `.eq('branch_id', branchId)` to ensure only tenant-specific data is fetched.
- **Cached Data**: localStorage keys are branch-specific (e.g., `menu_demo-branch`, `restaurant_sales_demo-branch`).

### Testing Isolation:
1. Open `admin.html?branch=demo` - should only show Demo Branch menu/transactions.
2. Open `admin.html?branch=downtown` - should only show Downtown Branch data.
3. Verify no cross-tenant data appears in any view.
4. Check Supabase dashboard - confirm queries include `branch_id` filters.

## Notes
- Requested archive `develpment - V2.zip` was not present; the working tree already contained extracted assets.
- Browser-based screenshots/tests cannot be captured from this headless environment; placeholders highlight the manual steps for the operator.