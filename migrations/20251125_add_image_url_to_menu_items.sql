-- Add image_url column to menu_items table if it doesn't exist

BEGIN;

-- Add image_url column to menu_items
ALTER TABLE menu_items
    ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMIT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menu_items' 
  AND column_name = 'image_url';

