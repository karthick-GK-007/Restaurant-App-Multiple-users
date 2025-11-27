# Guide: How to Set Up Hotels

This guide explains how to create hotels and assign branches to them in your multi-tenant system.

## Step 1: Create Hotels

### Option A: Using Supabase SQL Editor (Recommended)

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Run this SQL to create hotels:

```sql
-- Create hotels
INSERT INTO hotels (id, name, slug) VALUES
('hotel-a', 'Hotel A', 'hotel-a'),
('hotel-b', 'Hotel B', 'hotel-b'),
('hotel-c', 'Hotel C', 'hotel-c'),
('0002-hotel', 'Hotel 0002', '0002-hotel')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;
```

**Important:**
- `id`: Unique identifier for the hotel (used in URLs: `?hotel=hotel-a`)
- `name`: Display name (e.g., "Hotel A")
- `slug`: URL-friendly version (usually same as id)

### Option B: Using Supabase Table Editor

1. Go to **Table Editor** → **hotels** table
2. Click **Insert row** or **+** button
3. Fill in:
   - `id`: e.g., `hotel-a`
   - `name`: e.g., `Hotel A`
   - `slug`: e.g., `hotel-a`
4. Click **Save**

## Step 2: Verify Hotels Were Created

Run this query to see all hotels:

```sql
SELECT id, name, slug, created_at 
FROM hotels 
ORDER BY name;
```

You should see all your hotels listed.

## Step 3: Assign Branches to Hotels

### Option A: Update Existing Branches

If you have existing branches that need to be assigned to hotels:

```sql
-- Update a specific branch to use a hotel
UPDATE branches
SET hotel_id = 'hotel-a'  -- Change to your hotel ID
WHERE id = 'branch-id';   -- Change to your branch ID
```

**Example:**
```sql
-- Assign "downtown" branch to "hotel-a"
UPDATE branches
SET hotel_id = 'hotel-a'
WHERE id = 'downtown';
```

### Option B: Create New Branches with Hotels

```sql
-- Create a new branch and assign it to a hotel
INSERT INTO branches (id, hotel_id, name, slug) VALUES
('branch-1', 'hotel-a', 'Branch 1', 'branch-1')
ON CONFLICT (hotel_id, id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;
```

### Option C: Bulk Update Multiple Branches

```sql
-- Update multiple branches at once
UPDATE branches
SET hotel_id = 'hotel-a'
WHERE id IN ('branch-1', 'branch-2', 'branch-3');
```

## Step 4: Verify Branch-Hotel Assignments

Check that all branches are properly assigned:

```sql
-- List all branches with their hotels
SELECT 
    h.id AS hotel_id,
    h.name AS hotel_name,
    b.id AS branch_id,
    b.name AS branch_name,
    b.slug AS branch_slug
FROM branches b
LEFT JOIN hotels h ON b.hotel_id = h.id
ORDER BY h.name, b.name;
```

## Step 5: Find and Fix Orphaned Branches

Branches without valid hotels will cause errors. Find them:

```sql
-- Find branches with invalid hotel_id
SELECT 
    b.id AS branch_id,
    b.name AS branch_name,
    b.hotel_id,
    CASE 
        WHEN h.id IS NULL THEN '❌ Hotel does not exist'
        ELSE '✅ Hotel exists'
    END AS hotel_status
FROM branches b
LEFT JOIN hotels h ON b.hotel_id = h.id
WHERE h.id IS NULL;
```

**Fix orphaned branches:**

```sql
-- Option 1: Assign to an existing hotel
UPDATE branches
SET hotel_id = 'hotel-a'  -- Use an existing hotel ID
WHERE hotel_id NOT IN (SELECT id FROM hotels);

-- Option 2: Create a default hotel and assign
INSERT INTO hotels (id, name, slug) VALUES
('default-hotel', 'Default Hotel', 'default')
ON CONFLICT (id) DO NOTHING;

UPDATE branches
SET hotel_id = 'default-hotel'
WHERE hotel_id NOT IN (SELECT id FROM hotels);
```

## Complete Example: Full Setup

Here's a complete example setting up 3 hotels with branches:

```sql
BEGIN;

-- Step 1: Create hotels
INSERT INTO hotels (id, name, slug) VALUES
('hotel-a', 'Hotel A', 'hotel-a'),
('hotel-b', 'Hotel B', 'hotel-b'),
('hotel-c', 'Hotel C', 'hotel-c')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;

-- Step 2: Create branches for Hotel A
INSERT INTO branches (id, hotel_id, name, slug) VALUES
('branch-1', 'hotel-a', 'Branch 1', 'branch-1'),
('branch-2', 'hotel-a', 'Branch 2', 'branch-2')
ON CONFLICT (hotel_id, id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;

-- Step 3: Create branches for Hotel B
INSERT INTO branches (id, hotel_id, name, slug) VALUES
('branch-1', 'hotel-b', 'Branch 1', 'branch-1'),
('branch-2', 'hotel-b', 'Branch 2', 'branch-2'),
('branch-3', 'hotel-b', 'Branch 3', 'branch-3')
ON CONFLICT (hotel_id, id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;

-- Step 4: Create branches for Hotel C
INSERT INTO branches (id, hotel_id, name, slug) VALUES
('branch-1', 'hotel-c', 'Branch 1', 'branch-1'),
('branch-2', 'hotel-c', 'Branch 2', 'branch-2'),
('branch-3', 'hotel-c', 'Branch 3', 'branch-3')
ON CONFLICT (hotel_id, id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;

COMMIT;

-- Step 5: Verify everything
SELECT 
    h.name AS hotel,
    b.id AS branch_id,
    b.name AS branch_name
FROM branches b
JOIN hotels h ON b.hotel_id = h.id
ORDER BY h.name, b.id;
```

## Common Issues and Solutions

### Issue 1: "Foreign key constraint violation"

**Error:** `Key (hotel_id)=(xxx) is not present in table "hotels"`

**Solution:** Create the hotel first:
```sql
INSERT INTO hotels (id, name, slug) VALUES
('xxx', 'Hotel Name', 'xxx');
```

### Issue 2: "Cannot update branch - hotel doesn't exist"

**Solution:** Check if hotel exists:
```sql
SELECT * FROM hotels WHERE id = 'your-hotel-id';
```

If it doesn't exist, create it first.

### Issue 3: "Duplicate key violation" when creating branches

**Error:** `duplicate key value violates unique constraint "branches_pkey"`

**Solution:** The branch ID already exists for that hotel. Use `ON CONFLICT` or update instead:
```sql
INSERT INTO branches (id, hotel_id, name, slug) VALUES
('branch-1', 'hotel-a', 'Branch 1', 'branch-1')
ON CONFLICT (hotel_id, id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;
```

## Using the UI (Supabase Table Editor)

### Creating a Hotel:

1. Go to **Table Editor** → **hotels**
2. Click **Insert row** or **+**
3. Fill in:
   - `id`: `hotel-a` (unique identifier)
   - `name`: `Hotel A` (display name)
   - `slug`: `hotel-a` (URL-friendly)
4. Click **Save**

### Assigning a Branch to a Hotel:

1. Go to **Table Editor** → **branches**
2. Find the branch you want to update
3. Click on the row to edit
4. In the `hotel_id` field, enter a valid hotel ID (e.g., `hotel-a`)
5. Click **Save**

**Note:** The `hotel_id` must exist in the `hotels` table, otherwise you'll get a foreign key error.

## Testing Your Setup

After setting up hotels and branches, test with URLs:

- `http://localhost:8000/?hotel=hotel-a&branch=branch-1`
- `http://localhost:8000/?hotel=hotel-b&branch=branch-1`
- `http://localhost:8000/admin.html?hotel=hotel-a&branch=branch-1`

Each URL should show only data for that specific hotel + branch combination.

## Quick Reference

| Action | SQL Command |
|--------|-------------|
| Create hotel | `INSERT INTO hotels (id, name, slug) VALUES ('id', 'Name', 'slug');` |
| List hotels | `SELECT * FROM hotels;` |
| Assign branch to hotel | `UPDATE branches SET hotel_id = 'hotel-id' WHERE id = 'branch-id';` |
| List branches with hotels | `SELECT b.*, h.name AS hotel_name FROM branches b JOIN hotels h ON b.hotel_id = h.id;` |
| Find orphaned branches | `SELECT * FROM branches WHERE hotel_id NOT IN (SELECT id FROM hotels);` |

