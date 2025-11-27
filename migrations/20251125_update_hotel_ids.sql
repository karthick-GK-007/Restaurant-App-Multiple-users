-- Update Hotel IDs Safely
-- This script helps you change hotel IDs while maintaining all relationships

-- IMPORTANT: Read the instructions below before running!

-- ============================================
-- INSTRUCTIONS:
-- ============================================
-- 1. Replace 'old-hotel-id' with the current hotel ID you want to change
-- 2. Replace 'new-hotel-id' with your desired new hotel ID
-- 3. Run the entire script in a transaction (BEGIN...COMMIT)
-- 4. The script will update all related data automatically

-- ============================================
-- EXAMPLE: Change 'hotel-a' to 'my-hotel-1'
-- ============================================

BEGIN;

-- Step 1: Update all branches that reference the old hotel ID
UPDATE branches
SET hotel_id = 'new-hotel-id'  -- Your new hotel ID
WHERE hotel_id = 'old-hotel-id';  -- Your old hotel ID

-- Step 2: Update all menu_items that reference the old hotel ID
UPDATE menu_items
SET hotel_id = 'new-hotel-id'
WHERE hotel_id = 'old-hotel-id';

-- Step 3: Update all transactions that reference the old hotel ID
UPDATE transactions
SET hotel_id = 'new-hotel-id'
WHERE hotel_id = 'old-hotel-id';

-- Step 4: Update all transaction_items that reference the old hotel ID
UPDATE transaction_items
SET hotel_id = 'new-hotel-id'
WHERE hotel_id = 'old-hotel-id';

-- Step 5: Update all orders that reference the old hotel ID
UPDATE orders
SET hotel_id = 'new-hotel-id'
WHERE hotel_id = 'old-hotel-id';

-- Step 6: Delete the old hotel record
DELETE FROM hotels
WHERE id = 'old-hotel-id';

-- Step 7: Insert the new hotel record (or update if it already exists)
INSERT INTO hotels (id, name, slug) VALUES
('new-hotel-id', 'Your Hotel Name', 'new-hotel-slug')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;

COMMIT;

-- ============================================
-- VERIFICATION: Check that everything updated correctly
-- ============================================

-- Check branches
SELECT 'Branches:' AS check_type;
SELECT id, hotel_id, name 
FROM branches 
WHERE hotel_id = 'new-hotel-id';

-- Check menu items
SELECT 'Menu Items:' AS check_type;
SELECT COUNT(*) AS count 
FROM menu_items 
WHERE hotel_id = 'new-hotel-id';

-- Check transactions
SELECT 'Transactions:' AS check_type;
SELECT COUNT(*) AS count 
FROM transactions 
WHERE hotel_id = 'new-hotel-id';

-- Verify old hotel is gone
SELECT 'Old Hotel Check:' AS check_type;
SELECT COUNT(*) AS should_be_zero 
FROM hotels 
WHERE id = 'old-hotel-id';

-- Verify new hotel exists
SELECT 'New Hotel Check:' AS check_type;
SELECT id, name, slug 
FROM hotels 
WHERE id = 'new-hotel-id';

