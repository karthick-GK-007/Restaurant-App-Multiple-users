-- Fix branches table primary key to support multi-hotel
-- This script handles foreign key constraints that reference branches.id
-- Run this BEFORE inserting hotels/branches data

BEGIN;

-- Step 1: Drop foreign key constraints that reference branches.id
-- These will be recreated later if needed, but for now we need to change the primary key

DO $$
DECLARE
    fk_record RECORD;
BEGIN
    -- Find all foreign keys that reference branches.id
    FOR fk_record IN
        SELECT 
            tc.table_name, 
            tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND ccu.table_name = 'branches'
            AND ccu.column_name = 'id'
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', 
            fk_record.table_name, 
            fk_record.constraint_name);
        RAISE NOTICE 'Dropped foreign key: %.%', fk_record.table_name, fk_record.constraint_name;
    END LOOP;
END $$;

-- Step 2: Create hotels table if it doesn't exist
CREATE TABLE IF NOT EXISTS hotels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Ensure hotel_id column exists and is populated
ALTER TABLE IF EXISTS branches
    ADD COLUMN IF NOT EXISTS hotel_id TEXT;

-- Create default hotel if it doesn't exist
INSERT INTO hotels (id, name, slug)
VALUES ('default-hotel', 'Default Hotel', 'default')
ON CONFLICT (id) DO NOTHING;

-- Assign all existing branches to default hotel
UPDATE branches
SET hotel_id = 'default-hotel'
WHERE hotel_id IS NULL;

-- Make hotel_id NOT NULL
ALTER TABLE branches
    ALTER COLUMN hotel_id SET NOT NULL;

-- Step 4: Drop old primary key
ALTER TABLE IF EXISTS branches
    DROP CONSTRAINT IF EXISTS branches_pkey;

-- Step 5: Create new composite primary key
ALTER TABLE branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (hotel_id, id);

-- Step 6: Fix slug unique constraint (make it unique per hotel, not globally)
-- Drop any existing unique constraints on slug
-- Common constraint names: branches_slug_key, branches_slug_unique, etc.
ALTER TABLE IF EXISTS branches
    DROP CONSTRAINT IF EXISTS branches_slug_key;

ALTER TABLE IF EXISTS branches
    DROP CONSTRAINT IF EXISTS branches_slug_unique;

-- Also drop any other unique constraints that might involve slug
DO $$
DECLARE
    constraint_record RECORD;
    slug_attnum SMALLINT;
BEGIN
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
        RAISE NOTICE 'Dropped unique constraint: %', constraint_record.conname;
    END LOOP;
END $$;

-- Create composite unique constraint: slug is unique within a hotel
ALTER TABLE branches
    DROP CONSTRAINT IF EXISTS branches_hotel_slug_unique;

ALTER TABLE branches
    ADD CONSTRAINT branches_hotel_slug_unique UNIQUE (hotel_id, slug);

-- Step 7: Add foreign key from branches to hotels
ALTER TABLE branches
    DROP CONSTRAINT IF EXISTS branches_hotel_fk;

ALTER TABLE branches
    ADD CONSTRAINT branches_hotel_fk
        FOREIGN KEY (hotel_id) REFERENCES hotels (id)
        ON DELETE CASCADE;

COMMIT;

-- After running this migration, you can insert branches with same IDs for different hotels:
-- INSERT INTO branches (id, hotel_id, name, slug) VALUES
-- ('branch-1', 'hotel-a', 'Branch 1', 'branch-1'),
-- ('branch-1', 'hotel-b', 'Branch 1', 'branch-1');  -- This will now work!

