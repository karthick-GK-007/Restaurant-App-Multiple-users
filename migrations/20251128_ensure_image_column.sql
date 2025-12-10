-- Ensure image column exists in menu_items table
-- This fixes the "Could not find the 'image' column" error

BEGIN;

-- Add image column if it doesn't exist
ALTER TABLE menu_items
    ADD COLUMN IF NOT EXISTS image TEXT;

-- If image_url exists but image doesn't, copy data from image_url to image
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'menu_items' 
        AND column_name = 'image_url'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'menu_items' 
        AND column_name = 'image'
    ) THEN
        -- Copy image_url to image where image is null
        UPDATE menu_items
        SET image = image_url
        WHERE image IS NULL AND image_url IS NOT NULL;
    END IF;
END $$;

COMMIT;

-- Verify the column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'menu_items' 
  AND column_name IN ('image', 'image_url')
ORDER BY column_name;

