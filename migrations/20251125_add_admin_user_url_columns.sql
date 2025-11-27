-- Add admin_url and user_url columns to branches table
-- Format: kagzso/admin/{hotel_name}/{branch_slug} and kagzso/user/{hotel_name}/{branch_slug}

BEGIN;

-- Add admin_url and user_url columns to branches table
ALTER TABLE IF EXISTS branches
    ADD COLUMN IF NOT EXISTS admin_url TEXT;

ALTER TABLE IF EXISTS branches
    ADD COLUMN IF NOT EXISTS user_url TEXT;

-- Populate admin_url and user_url for existing branches
-- Format: kagzso/admin/{hotel.name}/{branch.slug} and kagzso/user/{hotel.name}/{branch.slug}
UPDATE branches b
SET 
    admin_url = 'kagzso/admin/' || LOWER(REPLACE(h.name, ' ', '-')) || '/' || COALESCE(b.slug, b.id),
    user_url = 'kagzso/user/' || LOWER(REPLACE(h.name, ' ', '-')) || '/' || COALESCE(b.slug, b.id)
FROM hotels h
WHERE b.hotel_id = h.id
  AND (b.admin_url IS NULL OR b.user_url IS NULL);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_branches_admin_url ON branches(admin_url);
CREATE INDEX IF NOT EXISTS idx_branches_user_url ON branches(user_url);

-- Add unique constraints (urls should be unique)
ALTER TABLE branches
    DROP CONSTRAINT IF EXISTS branches_admin_url_unique;

ALTER TABLE branches
    DROP CONSTRAINT IF EXISTS branches_user_url_unique;

CREATE UNIQUE INDEX IF NOT EXISTS branches_admin_url_unique ON branches(admin_url) WHERE admin_url IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS branches_user_url_unique ON branches(user_url) WHERE user_url IS NOT NULL;

COMMIT;

-- Verify the columns were added and populated
SELECT 
    b.id,
    b.name AS branch_name,
    h.name AS hotel_name,
    b.slug AS branch_slug,
    b.admin_url,
    b.user_url
FROM branches b
JOIN hotels h ON b.hotel_id = h.id
ORDER BY h.name, b.name
LIMIT 10;

