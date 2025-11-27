-- Add url_path column to branches table for path-based URL routing
-- Format: hotel_id/branch_slug (e.g., Hotel-001/madurai)

BEGIN;

-- Add url_path column to branches table
ALTER TABLE IF EXISTS branches
    ADD COLUMN IF NOT EXISTS url_path TEXT;

-- Populate url_path for existing branches
-- Format: hotel_id + '/' + branch_slug
UPDATE branches
SET url_path = hotel_id || '/' || COALESCE(slug, id)
WHERE url_path IS NULL;

-- Add index on url_path for fast lookups
CREATE INDEX IF NOT EXISTS idx_branches_url_path ON branches(url_path);

-- Add composite unique constraint: url_path is unique within a hotel
-- This allows same url_path across different hotels if needed
ALTER TABLE branches
    DROP CONSTRAINT IF EXISTS branches_hotel_url_path_unique;

CREATE UNIQUE INDEX IF NOT EXISTS branches_hotel_url_path_unique 
    ON branches(hotel_id, url_path);

COMMIT;

-- Verify the column was added and populated
SELECT 
    id,
    hotel_id,
    name,
    slug,
    url_path
FROM branches
ORDER BY hotel_id, id
LIMIT 10;

