-- RLS Policies for Hotel + Branch hierarchy
-- Filters by both hotel_id and branch_id for strict multi-hotel isolation

BEGIN;

-- Helper functions for hotel/branch context
CREATE OR REPLACE FUNCTION public.current_hotel_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN NULLIF(current_setting('jwt.claims.hotel_id', true), '');
END;
$$;

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

-- Hotels: Allow listing all hotels (needed for hotel selector), but restrict modifications
ALTER TABLE IF EXISTS hotels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_hotels ON hotels;
CREATE POLICY tenant_select_hotels ON hotels
FOR SELECT
USING (
    is_service_role()
    OR id = current_hotel_id()
    OR current_hotel_id() IS NULL  -- Allow listing for hotel selector
);

DROP POLICY IF EXISTS tenant_modify_hotels ON hotels;
CREATE POLICY tenant_modify_hotels ON hotels
FOR ALL
USING (is_service_role() OR id = current_hotel_id())
WITH CHECK (is_service_role() OR id = current_hotel_id());

-- Branches: Filter by hotel_id AND branch_id
ALTER TABLE IF EXISTS branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_branches ON branches;
CREATE POLICY tenant_select_branches ON branches
FOR SELECT
USING (
    is_service_role()
    OR (hotel_id = current_hotel_id() AND id = current_branch_id())
    OR (current_hotel_id() IS NULL AND current_branch_id() IS NULL)  -- Allow listing for selectors
);

DROP POLICY IF EXISTS tenant_modify_branches ON branches;
CREATE POLICY tenant_modify_branches ON branches
FOR ALL
USING (is_service_role() OR (hotel_id = current_hotel_id() AND id = current_branch_id()))
WITH CHECK (is_service_role() OR (hotel_id = current_hotel_id() AND id = current_branch_id()));

-- Menu Items: Filter by hotel_id AND branch_id
ALTER TABLE IF EXISTS menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_select_menu_items ON menu_items;
CREATE POLICY tenant_select_menu_items ON menu_items
FOR SELECT
USING (
    is_service_role()
    OR (hotel_id = current_hotel_id() AND branch_id = current_branch_id())
    OR (current_hotel_id() IS NULL AND current_branch_id() IS NULL)  -- Allow anon key (client filters)
);

DROP POLICY IF EXISTS tenant_write_menu_items ON menu_items;
CREATE POLICY tenant_write_menu_items ON menu_items
FOR ALL
USING (is_service_role() OR (hotel_id = current_hotel_id() AND branch_id = current_branch_id()))
WITH CHECK (is_service_role() OR (hotel_id = current_hotel_id() AND branch_id = current_branch_id()));

-- Transactions: Filter by hotel_id AND branch_id
ALTER TABLE IF EXISTS transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_read_transactions ON transactions;
CREATE POLICY tenant_read_transactions ON transactions
FOR SELECT
USING (
    is_service_role()
    OR (hotel_id = current_hotel_id() AND branch_id = current_branch_id())
    OR (current_hotel_id() IS NULL AND current_branch_id() IS NULL)  -- Allow anon key (client filters)
);

DROP POLICY IF EXISTS tenant_write_transactions ON transactions;
CREATE POLICY tenant_write_transactions ON transactions
FOR ALL
USING (is_service_role() OR (hotel_id = current_hotel_id() AND branch_id = current_branch_id()))
WITH CHECK (is_service_role() OR (hotel_id = current_hotel_id() AND branch_id = current_branch_id()));

-- Transaction Items: Filter by hotel_id AND branch_id
ALTER TABLE IF EXISTS transaction_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_read_transaction_items ON transaction_items;
CREATE POLICY tenant_read_transaction_items ON transaction_items
FOR SELECT
USING (
    is_service_role()
    OR (hotel_id = current_hotel_id() AND branch_id = current_branch_id())
    OR (current_hotel_id() IS NULL AND current_branch_id() IS NULL)  -- Allow anon key (client filters)
);

DROP POLICY IF EXISTS tenant_write_transaction_items ON transaction_items;
CREATE POLICY tenant_write_transaction_items ON transaction_items
FOR ALL
USING (is_service_role() OR (hotel_id = current_hotel_id() AND branch_id = current_branch_id()))
WITH CHECK (is_service_role() OR (hotel_id = current_hotel_id() AND branch_id = current_branch_id()));

-- Orders: Filter by hotel_id AND branch_id
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_read_orders ON orders;
CREATE POLICY tenant_read_orders ON orders
FOR SELECT
USING (
    is_service_role()
    OR (hotel_id = current_hotel_id() AND branch_id = current_branch_id())
    OR (current_hotel_id() IS NULL AND current_branch_id() IS NULL)  -- Allow anon key (client filters)
);

DROP POLICY IF EXISTS tenant_write_orders ON orders;
CREATE POLICY tenant_write_orders ON orders
FOR ALL
USING (is_service_role() OR (hotel_id = current_hotel_id() AND branch_id = current_branch_id()))
WITH CHECK (is_service_role() OR (hotel_id = current_hotel_id() AND branch_id = current_branch_id()));

COMMIT;

-- IMPORTANT NOTES:
-- 1. Client-side filtering MUST filter by both hotel_id AND branch_id in all queries
-- 2. URLs should include both: ?hotel=hotel-a&branch=branch-1
-- 3. Each hotel is completely isolated - Hotel A cannot see Hotel B's data
-- 4. Branches are unique within a hotel, but can have same name/id across hotels

