-- Supabase tenant migration
-- Adds branch/tenant support plus supporting indexes

BEGIN;

-- Ensure UUID helpers exist for future IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Canonical branches/tenants table
CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    qr_code_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed a demo branch to keep legacy data valid
INSERT INTO branches (id, name, slug)
VALUES ('demo-branch', 'Demo Branch', 'demo')
ON CONFLICT (id) DO NOTHING;

-- menu_items tenant column + reference
ALTER TABLE IF EXISTS menu_items
    ADD COLUMN IF NOT EXISTS branch_id TEXT;

ALTER TABLE IF EXISTS menu_items
    ADD COLUMN IF NOT EXISTS branch_name TEXT;

UPDATE menu_items
SET
    branch_id = COALESCE(branch_id, 'demo-branch'),
    branch_name = COALESCE(branch_name, 'Demo Branch')
WHERE branch_id IS NULL;

ALTER TABLE IF EXISTS menu_items
    ADD CONSTRAINT menu_items_branch_fk
        FOREIGN KEY (branch_id) REFERENCES branches (id)
        ON DELETE CASCADE;

-- orders table (if present) tenant column
ALTER TABLE IF EXISTS orders
    ADD COLUMN IF NOT EXISTS branch_id TEXT;

ALTER TABLE IF EXISTS orders
    ADD CONSTRAINT orders_branch_fk
        FOREIGN KEY (branch_id) REFERENCES branches (id)
        ON DELETE SET NULL;

-- transactions table tenant column
ALTER TABLE IF EXISTS transactions
    ADD COLUMN IF NOT EXISTS branch_id TEXT;

UPDATE transactions
SET branch_id = COALESCE(branch_id, 'demo-branch')
WHERE branch_id IS NULL;

ALTER TABLE IF EXISTS transactions
    ADD CONSTRAINT transactions_branch_fk
        FOREIGN KEY (branch_id) REFERENCES branches (id)
        ON DELETE SET NULL;

-- transaction_items inherits tenant for RLS joins
ALTER TABLE IF EXISTS transaction_items
    ADD COLUMN IF NOT EXISTS branch_id TEXT;

UPDATE transaction_items ti
SET branch_id = COALESCE(t.branch_id, 'demo-branch')
FROM transactions t
WHERE ti.transaction_id = t.id
  AND (ti.branch_id IS NULL OR ti.branch_id = '');

-- Add tenant column to any legacy tables that read/write sales locally
ALTER TABLE IF EXISTS sales
    ADD COLUMN IF NOT EXISTS branch_id TEXT;

-- Helpful lookup indexes
CREATE INDEX IF NOT EXISTS idx_menu_items_branch_id ON menu_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_branch_id ON transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_branch_id ON transaction_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);

COMMIT;

