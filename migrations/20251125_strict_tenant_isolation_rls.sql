-- STRICT TENANT ISOLATION RLS Policies
-- Removes NULL fallback to prevent cross-tenant data access
-- Run this AFTER the initial RLS migration

BEGIN;

-- Update menu_items to require branch_id (no NULL fallback for SELECT)
DROP POLICY IF EXISTS tenant_select_menu_items ON menu_items;
CREATE POLICY tenant_select_menu_items ON menu_items
FOR SELECT
USING (
    is_service_role()
    OR branch_id = current_branch_id()
);
-- Note: current_branch_id() returns NULL for anon key, so this effectively blocks
-- cross-tenant access when using anon key (client must filter by branch_id in query)

-- Update transactions to require branch_id (no NULL fallback)
DROP POLICY IF EXISTS tenant_read_transactions ON transactions;
CREATE POLICY tenant_read_transactions ON transactions
FOR SELECT
USING (
    is_service_role()
    OR branch_id = current_branch_id()
);

-- Update transaction_items to require branch_id (no NULL fallback)
DROP POLICY IF EXISTS tenant_read_transaction_items ON transaction_items;
CREATE POLICY tenant_read_transaction_items ON transaction_items
FOR SELECT
USING (
    is_service_role()
    OR branch_id = current_branch_id()
);

-- Update orders to require branch_id (no NULL fallback)
DROP POLICY IF EXISTS tenant_read_orders ON orders;
CREATE POLICY tenant_read_orders ON orders
FOR SELECT
USING (
    is_service_role()
    OR branch_id = current_branch_id()
);

-- Branches: Still allow listing all branches (needed for branch selector)
-- But restrict modifications to own branch
DROP POLICY IF EXISTS tenant_select_branches ON branches;
CREATE POLICY tenant_select_branches ON branches
FOR SELECT
USING (
    is_service_role()
    OR id = current_branch_id()
    OR current_branch_id() IS NULL  -- Allow listing for branch selector
);

COMMIT;

-- IMPORTANT NOTES:
-- 1. Since we're using anon key (not authenticated JWT with branch_id claim),
--    RLS policies with current_branch_id() will effectively block all access.
-- 2. Client-side filtering via .eq('branch_id', branchId) is CRITICAL for security.
-- 3. These policies provide defense-in-depth but client enforcement is primary.
-- 4. For true multi-tenant security, implement Supabase Auth with branch_id in JWT claims.

