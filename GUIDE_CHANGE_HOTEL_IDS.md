# Guide: How to Change Hotel IDs

Yes, you can change hotel IDs, but you need to update all related data. Here are your options:

## ⚠️ Important Notes

- **Hotel `id` is the PRIMARY KEY** - it's used in URLs (`?hotel=hotel-id`)
- **Many tables reference it** - branches, menu_items, transactions, etc.
- **You must update all references** before changing the ID

## Option 1: Change Hotel ID (Recommended)

### Step-by-Step Process:

1. **Update all foreign key references** (branches, menu_items, transactions, etc.)
2. **Delete the old hotel record**
3. **Create the new hotel record** with your desired ID

### Example: Change `hotel-a` to `my-hotel-1`

```sql
BEGIN;

-- Step 1: Update all branches
UPDATE branches SET hotel_id = 'my-hotel-1' WHERE hotel_id = 'hotel-a';

-- Step 2: Update all menu items
UPDATE menu_items SET hotel_id = 'my-hotel-1' WHERE hotel_id = 'hotel-a';

-- Step 3: Update all transactions
UPDATE transactions SET hotel_id = 'my-hotel-1' WHERE hotel_id = 'hotel-a';

-- Step 4: Update all transaction items
UPDATE transaction_items SET hotel_id = 'my-hotel-1' WHERE hotel_id = 'hotel-a';

-- Step 5: Update all orders
UPDATE orders SET hotel_id = 'my-hotel-1' WHERE hotel_id = 'hotel-a';

-- Step 6: Delete old hotel
DELETE FROM hotels WHERE id = 'hotel-a';

-- Step 7: Create new hotel (or update if exists)
INSERT INTO hotels (id, name, slug) VALUES
('my-hotel-1', 'My Hotel 1', 'my-hotel-1')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;

COMMIT;
```

## Option 2: Using Supabase Table Editor (Simple but Manual)

If you only have a few records:

1. **Go to Table Editor → hotels**
2. **Click on the hotel row** you want to change
3. **Change the `id` field** to your new value
4. **Click Save**

**⚠️ Warning:** This will fail if there are foreign key references. You must update those first!

## Option 3: Bulk Change Multiple Hotels

Use the script: `migrations/20251125_update_hotel_ids.sql`

Modify it with your old and new IDs, then run it.

## Quick Reference: What Gets Updated

When you change a hotel ID, these tables need updating:

| Table | Column | Description |
|-------|--------|-------------|
| `branches` | `hotel_id` | All branches assigned to this hotel |
| `menu_items` | `hotel_id` | All menu items for this hotel |
| `transactions` | `hotel_id` | All transactions for this hotel |
| `transaction_items` | `hotel_id` | All transaction items |
| `orders` | `hotel_id` | All orders for this hotel |

## Example: Change Multiple Hotels at Once

```sql
BEGIN;

-- Change hotel-a to hotel-1
UPDATE branches SET hotel_id = 'hotel-1' WHERE hotel_id = 'hotel-a';
UPDATE menu_items SET hotel_id = 'hotel-1' WHERE hotel_id = 'hotel-a';
UPDATE transactions SET hotel_id = 'hotel-1' WHERE hotel_id = 'hotel-a';
UPDATE transaction_items SET hotel_id = 'hotel-1' WHERE hotel_id = 'hotel-a';
UPDATE orders SET hotel_id = 'hotel-1' WHERE hotel_id = 'hotel-a';
DELETE FROM hotels WHERE id = 'hotel-a';
INSERT INTO hotels (id, name, slug) VALUES ('hotel-1', 'Hotel 1', 'hotel-1');

-- Change hotel-b to hotel-2
UPDATE branches SET hotel_id = 'hotel-2' WHERE hotel_id = 'hotel-b';
UPDATE menu_items SET hotel_id = 'hotel-2' WHERE hotel_id = 'hotel-b';
UPDATE transactions SET hotel_id = 'hotel-2' WHERE hotel_id = 'hotel-b';
UPDATE transaction_items SET hotel_id = 'hotel-2' WHERE hotel_id = 'hotel-b';
UPDATE orders SET hotel_id = 'hotel-2' WHERE hotel_id = 'hotel-b';
DELETE FROM hotels WHERE id = 'hotel-b';
INSERT INTO hotels (id, name, slug) VALUES ('hotel-2', 'Hotel 2', 'hotel-2');

COMMIT;
```

## Verification After Changes

Always verify your changes worked:

```sql
-- Check that old hotel is gone
SELECT * FROM hotels WHERE id = 'old-hotel-id';  -- Should return nothing

-- Check that new hotel exists
SELECT * FROM hotels WHERE id = 'new-hotel-id';  -- Should return the hotel

-- Check branches are updated
SELECT id, hotel_id, name FROM branches WHERE hotel_id = 'new-hotel-id';

-- Check for any orphaned data
SELECT COUNT(*) FROM branches WHERE hotel_id NOT IN (SELECT id FROM hotels);
SELECT COUNT(*) FROM menu_items WHERE hotel_id NOT IN (SELECT id FROM hotels);
```

## Best Practices

1. **Use transactions** - Wrap everything in `BEGIN...COMMIT` so you can rollback if something goes wrong
2. **Test first** - Run verification queries before and after
3. **Backup** - Export your data before making changes
4. **Update URLs** - After changing IDs, update any bookmarked URLs or links
5. **Use meaningful IDs** - Choose IDs that are easy to remember and type

## Common Mistakes to Avoid

❌ **Don't** try to update the hotel ID directly without updating foreign keys first
❌ **Don't** forget to update all related tables
❌ **Don't** change IDs that are already in use in production without planning

✅ **Do** use transactions
✅ **Do** verify all changes
✅ **Do** test in a development environment first

## Need Help?

If you're not sure what to change, run this query to see all hotels and their relationships:

```sql
SELECT 
    h.id AS hotel_id,
    h.name AS hotel_name,
    COUNT(DISTINCT b.id) AS branch_count,
    COUNT(DISTINCT mi.id) AS menu_item_count,
    COUNT(DISTINCT t.id) AS transaction_count
FROM hotels h
LEFT JOIN branches b ON h.id = b.hotel_id
LEFT JOIN menu_items mi ON h.id = mi.hotel_id
LEFT JOIN transactions t ON h.id = t.hotel_id
GROUP BY h.id, h.name
ORDER BY h.name;
```

This shows you how many records depend on each hotel, so you know what will be affected.

