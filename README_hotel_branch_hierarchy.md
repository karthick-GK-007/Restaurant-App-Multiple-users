# Hotel + Branch Hierarchy Implementation

## Overview

The system now supports a **two-level tenant hierarchy**:
- **Hotel/Organization Level** (top tenant)
- **Branch Level** (sub-tenant within hotel)

This allows:
- **Hotel A** to have branches: `branch-1`, `branch-2`
- **Hotel B** to have branches: `branch-1`, `branch-2`, `branch-3`
- **Hotel C** to have branches: `branch-1`, `branch-2`, `branch-3`

Each hotel is **completely isolated** - Hotel A cannot see Hotel B's data, even if they share branch names.

## URL Structure

### Shareable URLs

**User/Customer Pages:**
```
https://yoursite.com/?hotel=hotel-a&branch=branch-1
https://yoursite.com/?hotel=hotel-b&branch=branch-2
```

**Admin Pages:**
```
https://yoursite.com/admin.html?hotel=hotel-a&branch=branch-1
https://yoursite.com/admin.html?hotel=hotel-b&branch=branch-2
```

### Legacy Support

For backward compatibility, branch-only URLs still work:
```
https://yoursite.com/?branch=branch-1
```

If a branch exists in multiple hotels, the first match will be used. **Always use `?hotel=X&branch=Y` for multi-hotel scenarios.**

## Database Schema

### New Tables

**`hotels` table:**
```sql
CREATE TABLE hotels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Updated Tables

**`branches` table:**
- Added `hotel_id TEXT` column
- Composite unique constraint: `(hotel_id, id)` - allows same branch ID across hotels

**Data tables** (`menu_items`, `transactions`, `transaction_items`, `orders`):
- Added `hotel_id TEXT` column
- All queries filter by both `hotel_id` AND `branch_id`

## Migration Steps

1. **Run hotel schema migration:**
   ```sql
   -- Run: migrations/20251125_add_hotel_organization_level.sql
   ```

2. **Run RLS policies:**
   ```sql
   -- Run: migrations/20251125_hotel_branch_rls_policies.sql
   ```

3. **Seed example data:**
   ```sql
   -- Insert hotels
   INSERT INTO hotels (id, name, slug) VALUES
   ('hotel-a', 'Hotel A', 'hotel-a'),
   ('hotel-b', 'Hotel B', 'hotel-b'),
   ('hotel-c', 'Hotel C', 'hotel-c');
   
   -- Insert branches for Hotel A
   INSERT INTO branches (id, hotel_id, name, slug) VALUES
   ('branch-1', 'hotel-a', 'Branch 1', 'branch-1'),
   ('branch-2', 'hotel-a', 'Branch 2', 'branch-2');
   
   -- Insert branches for Hotel B
   INSERT INTO branches (id, hotel_id, name, slug) VALUES
   ('branch-1', 'hotel-b', 'Branch 1', 'branch-1'),
   ('branch-2', 'hotel-b', 'Branch 2', 'branch-2'),
   ('branch-3', 'hotel-b', 'Branch 3', 'branch-3');
   
   -- Insert branches for Hotel C
   INSERT INTO branches (id, hotel_id, name, slug) VALUES
   ('branch-1', 'hotel-c', 'Branch 1', 'branch-1'),
   ('branch-2', 'hotel-c', 'Branch 2', 'branch-2'),
   ('branch-3', 'hotel-c', 'Branch 3', 'branch-3');
   ```

4. **Update existing data:**
   - The migration automatically assigns existing branches to a default hotel
   - Update `hotel_id` in data tables based on your requirements

## Code Changes

### JavaScript Updates

**`supabase-service.js`:**
- `fetchBranches({ hotelId })` - filters branches by hotel
- `fetchMenu(branchId, { hotelId })` - filters menu by hotel + branch
- `fetchSales({ hotelId, branchId })` - filters sales by hotel + branch
- `saveOrder(order)` - includes `hotel_id` in transactions

**`script.js` & `admin.js`:**
- Added `selectedHotelId` variable
- Updated `BranchRouter` to parse `?hotel=X&branch=Y` from URL
- All data loading filters by both `hotel_id` and `branch_id`
- Client-side filtering enforces strict isolation

## Security (RLS Policies)

All RLS policies now filter by **both** `hotel_id` AND `branch_id`:

```sql
-- Example: Menu items policy
CREATE POLICY tenant_select_menu_items ON menu_items
FOR SELECT
USING (
    is_service_role()
    OR (hotel_id = current_hotel_id() AND branch_id = current_branch_id())
    OR (current_hotel_id() IS NULL AND current_branch_id() IS NULL)  -- Allow anon key
);
```

**Important:** When using the anon key, client-side filtering MUST enforce `hotel_id` + `branch_id` filtering (defense in depth).

## Testing Checklist

- [ ] Hotel A, Branch 1: Can only see Hotel A Branch 1 data
- [ ] Hotel A, Branch 2: Can only see Hotel A Branch 2 data
- [ ] Hotel B, Branch 1: Can only see Hotel B Branch 1 data (different from Hotel A Branch 1)
- [ ] Hotel B, Branch 2: Can only see Hotel B Branch 2 data
- [ ] Hotel B, Branch 3: Can only see Hotel B Branch 3 data
- [ ] URL routing: `?hotel=hotel-a&branch=branch-1` loads correct data
- [ ] URL routing: `?hotel=hotel-b&branch=branch-1` loads different data
- [ ] Admin panel: Only shows branches for selected hotel
- [ ] Menu items: Filtered by hotel + branch
- [ ] Transactions: Filtered by hotel + branch
- [ ] Reports: Only show data for selected hotel + branch

## Backward Compatibility

- Existing URLs with only `?branch=X` still work
- If `hotel_id` is not provided, system falls back to branch-only filtering
- Default hotel is created for existing data during migration

## Notes

- **Branch IDs can be duplicated across hotels** (e.g., "branch-1" in Hotel A and Hotel B)
- **Hotel isolation is strict** - no cross-hotel data leakage
- **URLs should always include both `hotel` and `branch`** for multi-hotel scenarios
- **Session storage** stores both `selectedHotelId` and `selectedBranchId`

