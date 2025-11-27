-- Supabase RLS policies scoped by branch/tenant

BEGIN;

-- Helper functions ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_branch_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN NULLIF(current_setting('jwt.claims.branch_id', true), '');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN current_setting('request.jwt.claim.role', true) = 'service_role';
END;
$$;

-- Branches -----------------------------------------------------------------

ALTER TABLE IF EXISTS branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_branches ON branches;
CREATE POLICY tenant_select_branches ON branches
FOR SELECT
USING (
    is_service_role()
    OR id = current_branch_id()
    OR current_branch_id() IS NULL
);

DROP POLICY IF EXISTS tenant_modify_branches ON branches;
CREATE POLICY tenant_modify_branches ON branches
FOR ALL
USING (is_service_role() OR id = current_branch_id())
WITH CHECK (is_service_role() OR id = current_branch_id());

-- Menu Items ---------------------------------------------------------------

ALTER TABLE IF EXISTS menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_menu_items ON menu_items;
CREATE POLICY tenant_select_menu_items ON menu_items
FOR SELECT
USING (
    is_service_role()
    OR branch_id = current_branch_id()
    OR current_branch_id() IS NULL
);

DROP POLICY IF EXISTS tenant_write_menu_items ON menu_items;
CREATE POLICY tenant_write_menu_items ON menu_items
FOR ALL
USING (is_service_role() OR branch_id = current_branch_id())
WITH CHECK (
    is_service_role()
    OR branch_id = current_branch_id()
);

-- Orders (if table exists) -------------------------------------------------

ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_read_orders ON orders;
CREATE POLICY tenant_read_orders ON orders
FOR SELECT
USING (
    is_service_role()
    OR branch_id = current_branch_id()
);

DROP POLICY IF EXISTS tenant_write_orders ON orders;
CREATE POLICY tenant_write_orders ON orders
FOR ALL
USING (is_service_role() OR branch_id = current_branch_id())
WITH CHECK (is_service_role() OR branch_id = current_branch_id());

-- Transactions -------------------------------------------------------------

ALTER TABLE IF EXISTS transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_read_transactions ON transactions;
CREATE POLICY tenant_read_transactions ON transactions
FOR SELECT
USING (
    is_service_role()
    OR branch_id = current_branch_id()
);

DROP POLICY IF EXISTS tenant_write_transactions ON transactions;
CREATE POLICY tenant_write_transactions ON transactions
FOR ALL
USING (is_service_role() OR branch_id = current_branch_id())
WITH CHECK (is_service_role() OR branch_id = current_branch_id());

-- Transaction Items --------------------------------------------------------

ALTER TABLE IF EXISTS transaction_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_read_transaction_items ON transaction_items;
CREATE POLICY tenant_read_transaction_items ON transaction_items
FOR SELECT
USING (
    is_service_role()
    OR branch_id = current_branch_id()
);

DROP POLICY IF EXISTS tenant_write_transaction_items ON transaction_items;
CREATE POLICY tenant_write_transaction_items ON transaction_items
FOR ALL
USING (is_service_role() OR branch_id = current_branch_id())
WITH CHECK (is_service_role() OR branch_id = current_branch_id());

-- Config -------------------------------------------------------------------

ALTER TABLE IF EXISTS config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_config ON config;
CREATE POLICY service_role_config ON config
FOR ALL
USING (is_service_role())
WITH CHECK (is_service_role());

COMMIT;

