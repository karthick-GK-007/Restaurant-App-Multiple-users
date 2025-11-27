-- Simple Script to Change One Hotel ID
-- Just replace the values below and run!

BEGIN;

-- ============================================
-- STEP 1: CHANGE THESE VALUES (Replace with your values):
-- ============================================

-- OLD hotel ID (the one you want to change FROM)
-- Example: 'hotel-a'
DO $$ 
DECLARE
    old_hotel_id TEXT := 'hotel-a';  -- ⬅️ CHANGE THIS
    
    -- NEW hotel ID (what you want to change it TO)
    new_hotel_id TEXT := 'my-hotel-1';  -- ⬅️ CHANGE THIS
    
    -- NEW hotel name
    new_hotel_name TEXT := 'My Hotel 1';  -- ⬅️ CHANGE THIS
    
    -- NEW hotel slug (usually same as ID)
    new_hotel_slug TEXT := 'my-hotel-1';  -- ⬅️ CHANGE THIS

BEGIN
    -- STEP 1: Create the new hotel FIRST (so foreign keys can reference it)
    INSERT INTO hotels (id, name, slug) VALUES
    (new_hotel_id, new_hotel_name, new_hotel_slug)
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug;
    
    -- STEP 2: Now update all references to use the new hotel_id
    UPDATE branches
    SET hotel_id = new_hotel_id
    WHERE hotel_id = old_hotel_id;
    
    UPDATE menu_items
    SET hotel_id = new_hotel_id
    WHERE hotel_id = old_hotel_id;
    
    UPDATE transactions
    SET hotel_id = new_hotel_id
    WHERE hotel_id = old_hotel_id;
    
    UPDATE transaction_items
    SET hotel_id = new_hotel_id
    WHERE hotel_id = old_hotel_id;
    
    UPDATE orders
    SET hotel_id = new_hotel_id
    WHERE hotel_id = old_hotel_id;
    
    -- STEP 3: Finally, delete the old hotel (only if it's different from new)
    IF old_hotel_id != new_hotel_id THEN
        DELETE FROM hotels
        WHERE id = old_hotel_id;
    END IF;
    
    RAISE NOTICE '✅ Successfully changed hotel ID from % to %', old_hotel_id, new_hotel_id;
END $$;

COMMIT;

-- ============================================
-- STEP 2: VERIFICATION (Check the results)
-- ============================================

-- Check old hotel is gone (replace 'hotel-a' with your old ID)
SELECT 'Old hotel check (should be 0):' AS check_type;
SELECT COUNT(*) AS count FROM hotels WHERE id = 'hotel-a';

-- Check new hotel exists (replace 'my-hotel-1' with your new ID)
SELECT 'New hotel check (should show your hotel):' AS check_type;
SELECT id, name, slug FROM hotels WHERE id = 'my-hotel-1';

-- Check branches were updated (replace 'my-hotel-1' with your new ID)
SELECT 'Branches updated (should show count):' AS check_type;
SELECT COUNT(*) AS branch_count FROM branches WHERE hotel_id = 'my-hotel-1';

