-- Add Hotel/Organization level above branches for multi-hotel support
-- Supports: Hotel A (branch 1, branch 2), Hotel B (branch 1, branch 2, branch 3), etc.
-- Each hotel is completely isolated; branches are unique within a hotel

BEGIN;

-- Create hotels/organizations table
CREATE TABLE IF NOT EXISTS hotels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add hotel_id to branches (branch belongs to a hotel)
-- Start with nullable, will be populated and made NOT NULL later
ALTER TABLE IF EXISTS branches
    ADD COLUMN IF NOT EXISTS hotel_id TEXT;

-- Add hotel_id to all data tables
ALTER TABLE IF EXISTS menu_items
    ADD COLUMN IF NOT EXISTS hotel_id TEXT;

ALTER TABLE IF EXISTS transactions
    ADD COLUMN IF NOT EXISTS hotel_id TEXT;

ALTER TABLE IF EXISTS transaction_items
    ADD COLUMN IF NOT EXISTS hotel_id TEXT;

ALTER TABLE IF EXISTS orders
    ADD COLUMN IF NOT EXISTS hotel_id TEXT;

-- Populate hotel_id from branch_id (backward compatibility)
-- For existing data, create a default hotel and assign all branches to it
DO $$
DECLARE
    default_hotel_id TEXT := 'default-hotel';
    constraint_record RECORD;
    slug_attnum SMALLINT;
BEGIN
    -- Create default hotel if it doesn't exist
    INSERT INTO hotels (id, name, slug)
    VALUES (default_hotel_id, 'Default Hotel', 'default')
    ON CONFLICT (id) DO NOTHING;
    
    -- Assign existing branches to default hotel
    UPDATE branches
    SET hotel_id = default_hotel_id
    WHERE hotel_id IS NULL;
    
    -- Now that all branches have hotel_id, make it NOT NULL
    ALTER TABLE branches
        ALTER COLUMN hotel_id SET NOT NULL;
    
    -- IMPORTANT: Change primary key to composite (hotel_id, id)
    -- This allows "branch-1" to exist in both Hotel A and Hotel B
    -- Drop the old primary key constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'branches_pkey' 
        AND conrelid = 'branches'::regclass
    ) THEN
        ALTER TABLE branches DROP CONSTRAINT branches_pkey;
    END IF;
    
    -- Create new composite primary key on (hotel_id, id)
    ALTER TABLE branches
        ADD CONSTRAINT branches_pkey PRIMARY KEY (hotel_id, id);
    
    -- Fix slug unique constraint (make it unique per hotel, not globally)
    -- Drop any existing unique constraints on slug
    -- Common constraint names first
    ALTER TABLE branches
        DROP CONSTRAINT IF EXISTS branches_slug_key;
    
    ALTER TABLE branches
        DROP CONSTRAINT IF EXISTS branches_slug_unique;
    
    -- Also drop any other unique constraints that might involve slug
    -- Get the attribute number for slug column
    SELECT attnum INTO slug_attnum
    FROM pg_attribute
    WHERE attrelid = 'branches'::regclass
        AND attname = 'slug';
    
    -- Find unique constraints that involve the slug column
    FOR constraint_record IN
        SELECT DISTINCT c.conname
        FROM pg_constraint c
        CROSS JOIN LATERAL unnest(c.conkey) AS key_attnum
        WHERE c.conrelid = 'branches'::regclass
            AND c.contype = 'u'
            AND key_attnum::smallint = slug_attnum
    LOOP
        EXECUTE format('ALTER TABLE branches DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    END LOOP;
    
    -- Create composite unique constraint: slug is unique within a hotel
    ALTER TABLE branches
        DROP CONSTRAINT IF EXISTS branches_hotel_slug_unique;
    
    ALTER TABLE branches
        ADD CONSTRAINT branches_hotel_slug_unique UNIQUE (hotel_id, slug);
    
    -- Add foreign key from branches to hotels (now that hotel_id is NOT NULL)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'branches_hotel_fk' 
        AND conrelid = 'branches'::regclass
    ) THEN
        ALTER TABLE branches
            ADD CONSTRAINT branches_hotel_fk
                FOREIGN KEY (hotel_id) REFERENCES hotels (id)
                ON DELETE CASCADE;
    END IF;
    
    -- Populate hotel_id in data tables from branch's hotel_id
    UPDATE menu_items mi
    SET hotel_id = b.hotel_id
    FROM branches b
    WHERE mi.branch_id = b.id AND mi.hotel_id IS NULL;
    
    UPDATE transactions t
    SET hotel_id = b.hotel_id
    FROM branches b
    WHERE t.branch_id = b.id AND t.hotel_id IS NULL;
    
    UPDATE transaction_items ti
    SET hotel_id = t.hotel_id
    FROM transactions t
    WHERE ti.transaction_id = t.id AND ti.hotel_id IS NULL;
    
    UPDATE orders o
    SET hotel_id = b.hotel_id
    FROM branches b
    WHERE o.branch_id = b.id AND o.hotel_id IS NULL;
END $$;

-- Add indexes for hotel_id lookups
CREATE INDEX IF NOT EXISTS idx_branches_hotel_id ON branches(hotel_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_hotel_id ON menu_items(hotel_id);
CREATE INDEX IF NOT EXISTS idx_transactions_hotel_id ON transactions(hotel_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_hotel_id ON transaction_items(hotel_id);
CREATE INDEX IF NOT EXISTS idx_orders_hotel_id ON orders(hotel_id);

-- Composite indexes for hotel + branch queries (most common)
CREATE INDEX IF NOT EXISTS idx_menu_items_hotel_branch ON menu_items(hotel_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_hotel_branch ON transactions(hotel_id, branch_id);

COMMIT;

-- Example data structure after migration:
-- hotels: 
--   - id: 'hotel-a', name: 'Hotel A'
--   - id: 'hotel-b', name: 'Hotel B'
--   - id: 'hotel-c', name: 'Hotel C'
--
-- branches:
--   - id: 'branch-1', hotel_id: 'hotel-a', name: 'Branch 1'
--   - id: 'branch-2', hotel_id: 'hotel-a', name: 'Branch 2'
--   - id: 'branch-1', hotel_id: 'hotel-b', name: 'Branch 1' (different from hotel-a's branch-1)
--   - id: 'branch-2', hotel_id: 'hotel-b', name: 'Branch 2'
--   - id: 'branch-3', hotel_id: 'hotel-b', name: 'Branch 3'

