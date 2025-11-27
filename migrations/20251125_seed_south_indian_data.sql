-- Seed Data for South Indian Multi-Tenant Restaurant System
-- Hotel-001: Non-Veg Biryani Stall (suganya)
-- Hotel-002: Fast Food (kagan)
-- Hotel-003: karthick

BEGIN;

-- ============================================
-- HOTEL-001: Non-Veg Biryani Stall (suganya)
-- Branches: madurai, bangalore, chennai
-- ============================================

-- Menu Items for Hotel-001, Branch-1 (madurai)
INSERT INTO menu_items (id, hotel_id, branch_id, name, category, price, description, availability, image_url) VALUES
('item-001-madurai-chicken-biryani', 'Hotel-001', 'branch-1', 'Chicken Biryani', 'Biryani', 180.00, 'Fragrant basmati rice with tender chicken pieces, aromatic spices, and fried onions', 'Available', NULL),
('item-001-madurai-mutton-biryani', 'Hotel-001', 'branch-1', 'Mutton Biryani', 'Biryani', 220.00, 'Traditional mutton biryani with rich spices and basmati rice', 'Available', NULL),
('item-001-madurai-egg-biryani', 'Hotel-001', 'branch-1', 'Egg Biryani', 'Biryani', 120.00, 'Delicious biryani with boiled eggs and aromatic spices', 'Available', NULL),
('item-001-madurai-prawn-biryani', 'Hotel-001', 'branch-1', 'Prawn Biryani', 'Biryani', 200.00, 'Fresh prawns cooked with basmati rice and South Indian spices', 'Available', NULL),
('item-001-madurai-chicken-65', 'Hotel-001', 'branch-1', 'Chicken 65', 'Starters', 150.00, 'Spicy deep-fried chicken chunks with curry leaves', 'Available', NULL),
('item-001-madurai-mutton-chukka', 'Hotel-001', 'branch-1', 'Mutton Chukka', 'Starters', 180.00, 'Dry mutton fry with South Indian spices', 'Available', NULL),
('item-001-madurai-raita', 'Hotel-001', 'branch-1', 'Raita', 'Sides', 40.00, 'Cool yogurt with cucumber and onions', 'Available', NULL),
('item-001-madurai-brindavan', 'Hotel-001', 'branch-1', 'Brindavan', 'Sides', 50.00, 'Spicy onion and tomato chutney', 'Available', NULL)
ON CONFLICT (id) DO UPDATE SET
    hotel_id = EXCLUDED.hotel_id,
    branch_id = EXCLUDED.branch_id,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    price = EXCLUDED.price,
    description = EXCLUDED.description,
    availability = EXCLUDED.availability,
    image_url = EXCLUDED.image_url;

-- Menu Items for Hotel-001, Branch-2 (bangalore)
INSERT INTO menu_items (id, hotel_id, branch_id, name, category, price, description, availability, image_url) VALUES
('item-001-bangalore-chicken-biryani', 'Hotel-001', 'branch-2', 'Chicken Biryani', 'Biryani', 190.00, 'Fragrant basmati rice with tender chicken pieces, aromatic spices, and fried onions', 'Available', NULL),
('item-001-bangalore-mutton-biryani', 'Hotel-001', 'branch-2', 'Mutton Biryani', 'Biryani', 230.00, 'Traditional mutton biryani with rich spices and basmati rice', 'Available', NULL),
('item-001-bangalore-egg-biryani', 'Hotel-001', 'branch-2', 'Egg Biryani', 'Biryani', 130.00, 'Delicious biryani with boiled eggs and aromatic spices', 'Available', NULL),
('item-001-bangalore-fish-biryani', 'Hotel-001', 'branch-2', 'Fish Biryani', 'Biryani', 210.00, 'Fresh fish cooked with basmati rice and spices', 'Available', NULL),
('item-001-bangalore-chicken-65', 'Hotel-001', 'branch-2', 'Chicken 65', 'Starters', 160.00, 'Spicy deep-fried chicken chunks with curry leaves', 'Available', NULL),
('item-001-bangalore-raita', 'Hotel-001', 'branch-2', 'Raita', 'Sides', 45.00, 'Cool yogurt with cucumber and onions', 'Available', NULL)
ON CONFLICT (id) DO UPDATE SET
    hotel_id = EXCLUDED.hotel_id,
    branch_id = EXCLUDED.branch_id,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    price = EXCLUDED.price,
    description = EXCLUDED.description,
    availability = EXCLUDED.availability,
    image_url = EXCLUDED.image_url;

-- Menu Items for Hotel-001, Branch-3 (chennai)
INSERT INTO menu_items (id, hotel_id, branch_id, name, category, price, description, availability, image_url) VALUES
('item-001-chennai-chicken-biryani', 'Hotel-001', 'branch-3', 'Chicken Biryani', 'Biryani', 185.00, 'Fragrant basmati rice with tender chicken pieces, aromatic spices, and fried onions', 'Available', NULL),
('item-001-chennai-mutton-biryani', 'Hotel-001', 'branch-3', 'Mutton Biryani', 'Biryani', 225.00, 'Traditional mutton biryani with rich spices and basmati rice', 'Available', NULL),
('item-001-chennai-egg-biryani', 'Hotel-001', 'branch-3', 'Egg Biryani', 'Biryani', 125.00, 'Delicious biryani with boiled eggs and aromatic spices', 'Available', NULL),
('item-001-chennai-chicken-65', 'Hotel-001', 'branch-3', 'Chicken 65', 'Starters', 155.00, 'Spicy deep-fried chicken chunks with curry leaves', 'Available', NULL),
('item-001-chennai-raita', 'Hotel-001', 'branch-3', 'Raita', 'Sides', 42.00, 'Cool yogurt with cucumber and onions', 'Available', NULL)
ON CONFLICT (id) DO UPDATE SET
    hotel_id = EXCLUDED.hotel_id,
    branch_id = EXCLUDED.branch_id,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    price = EXCLUDED.price,
    description = EXCLUDED.description,
    availability = EXCLUDED.availability,
    image_url = EXCLUDED.image_url;

-- ============================================
-- HOTEL-002: Fast Food (kagan)
-- Branches: tondairpet, branch-2
-- ============================================

-- Menu Items for Hotel-002, Branch-1 (tondairpet)
INSERT INTO menu_items (id, hotel_id, branch_id, name, category, price, description, availability, image_url) VALUES
('item-002-tondairpet-dosa', 'Hotel-002', 'branch-1', 'Masala Dosa', 'Dosa', 80.00, 'Crispy dosa with spiced potato filling, served with sambar and chutney', 'Available', NULL),
('item-002-tondairpet-plain-dosa', 'Hotel-002', 'branch-1', 'Plain Dosa', 'Dosa', 50.00, 'Crispy golden dosa served with sambar and coconut chutney', 'Available', NULL),
('item-002-tondairpet-onion-dosa', 'Hotel-002', 'branch-1', 'Onion Dosa', 'Dosa', 70.00, 'Dosa topped with chopped onions and green chilies', 'Available', NULL),
('item-002-tondairpet-idli', 'Hotel-002', 'branch-1', 'Idli (2 pcs)', 'Breakfast', 40.00, 'Soft steamed rice cakes served with sambar and chutney', 'Available', NULL),
('item-002-tondairpet-vada', 'Hotel-002', 'branch-1', 'Vada (2 pcs)', 'Breakfast', 45.00, 'Crispy lentil donuts served with sambar and coconut chutney', 'Available', NULL),
('item-002-tondairpet-pongal', 'Hotel-002', 'branch-1', 'Ven Pongal', 'Breakfast', 60.00, 'Spiced rice and lentil porridge with ghee, served with sambar', 'Available', NULL),
('item-002-tondairpet-upma', 'Hotel-002', 'branch-1', 'Upma', 'Breakfast', 50.00, 'Semolina cooked with vegetables and spices', 'Available', NULL),
('item-002-tondairpet-poori', 'Hotel-002', 'branch-1', 'Poori (2 pcs)', 'Breakfast', 55.00, 'Deep-fried puffed bread served with potato curry', 'Available', NULL),
('item-002-tondairpet-sambar', 'Hotel-002', 'branch-1', 'Sambar', 'Sides', 30.00, 'South Indian lentil stew with vegetables', 'Available', NULL),
('item-002-tondairpet-chutney', 'Hotel-002', 'branch-1', 'Coconut Chutney', 'Sides', 20.00, 'Fresh coconut chutney with green chilies', 'Available', NULL)
ON CONFLICT (id) DO UPDATE SET
    hotel_id = EXCLUDED.hotel_id,
    branch_id = EXCLUDED.branch_id,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    price = EXCLUDED.price,
    description = EXCLUDED.description,
    availability = EXCLUDED.availability,
    image_url = EXCLUDED.image_url;

-- Menu Items for Hotel-002, Branch-2
INSERT INTO menu_items (id, hotel_id, branch_id, name, category, price, description, availability, image_url) VALUES
('item-002-branch2-dosa', 'Hotel-002', 'branch-2', 'Masala Dosa', 'Dosa', 85.00, 'Crispy dosa with spiced potato filling, served with sambar and chutney', 'Available', NULL),
('item-002-branch2-plain-dosa', 'Hotel-002', 'branch-2', 'Plain Dosa', 'Dosa', 55.00, 'Crispy golden dosa served with sambar and coconut chutney', 'Available', NULL),
('item-002-branch2-idli', 'Hotel-002', 'branch-2', 'Idli (2 pcs)', 'Breakfast', 42.00, 'Soft steamed rice cakes served with sambar and chutney', 'Available', NULL),
('item-002-branch2-vada', 'Hotel-002', 'branch-2', 'Vada (2 pcs)', 'Breakfast', 48.00, 'Crispy lentil donuts served with sambar and coconut chutney', 'Available', NULL),
('item-002-branch2-pongal', 'Hotel-002', 'branch-2', 'Ven Pongal', 'Breakfast', 65.00, 'Spiced rice and lentil porridge with ghee, served with sambar', 'Available', NULL)
ON CONFLICT (id) DO UPDATE SET
    hotel_id = EXCLUDED.hotel_id,
    branch_id = EXCLUDED.branch_id,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    price = EXCLUDED.price,
    description = EXCLUDED.description,
    availability = EXCLUDED.availability,
    image_url = EXCLUDED.image_url;

-- ============================================
-- HOTEL-003: karthick
-- ============================================

-- Menu Items for Hotel-003 (generic South Indian items)
INSERT INTO menu_items (id, hotel_id, branch_id, name, category, price, description, availability, image_url) VALUES
('item-003-dosa', 'Hotel-003', 'branch-1', 'Masala Dosa', 'Dosa', 75.00, 'Crispy dosa with spiced potato filling', 'Available', NULL),
('item-003-idli', 'Hotel-003', 'branch-1', 'Idli (2 pcs)', 'Breakfast', 38.00, 'Soft steamed rice cakes', 'Available', NULL),
('item-003-vada', 'Hotel-003', 'branch-1', 'Vada (2 pcs)', 'Breakfast', 43.00, 'Crispy lentil donuts', 'Available', NULL)
ON CONFLICT (id) DO UPDATE SET
    hotel_id = EXCLUDED.hotel_id,
    branch_id = EXCLUDED.branch_id,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    price = EXCLUDED.price,
    description = EXCLUDED.description,
    availability = EXCLUDED.availability,
    image_url = EXCLUDED.image_url;

-- ============================================
-- SAMPLE TRANSACTIONS
-- ============================================

-- Transaction 1: Hotel-001, Branch-1 (madurai) - Dining
INSERT INTO transactions (id, hotel_id, branch_id, branch_name, date, date_time, order_type, total_base_amount, total_cgst_amount, total_sgst_amount, total_gst_amount, total, payment_mode, applied_gst_rate, show_tax_on_bill) VALUES
('txn-001-001', 'Hotel-001', 'branch-1', 'madurai', '2025-11-27', '2025-11-27 12:30:00', 'Dining', 360.00, 9.00, 9.00, 18.00, 378.00, 'Cash', 5.0, true)
ON CONFLICT (id) DO UPDATE SET
    hotel_id = EXCLUDED.hotel_id,
    branch_id = EXCLUDED.branch_id,
    branch_name = EXCLUDED.branch_name,
    date = EXCLUDED.date,
    date_time = EXCLUDED.date_time,
    order_type = EXCLUDED.order_type,
    total_base_amount = EXCLUDED.total_base_amount,
    total_cgst_amount = EXCLUDED.total_cgst_amount,
    total_sgst_amount = EXCLUDED.total_sgst_amount,
    total_gst_amount = EXCLUDED.total_gst_amount,
    total = EXCLUDED.total,
    payment_mode = EXCLUDED.payment_mode,
    applied_gst_rate = EXCLUDED.applied_gst_rate,
    show_tax_on_bill = EXCLUDED.show_tax_on_bill;

-- Delete existing transaction items first, then insert new ones
DELETE FROM transaction_items WHERE transaction_id = 'txn-001-001';

INSERT INTO transaction_items (transaction_id, hotel_id, branch_id, item_id, item_name, order_type, price, base_price, final_price, cgst_percentage, sgst_percentage, cgst_amount, sgst_amount, gst_value, price_includes_tax, quantity, subtotal) VALUES
('txn-001-001', 'Hotel-001', 'branch-1', 'item-001-madurai-chicken-biryani', 'Chicken Biryani', 'Dining', 180.00, 180.00, 189.00, 2.5, 2.5, 4.50, 4.50, 9.00, false, 2, 378.00);

-- Transaction 2: Hotel-001, Branch-2 (bangalore) - Takeaway
INSERT INTO transactions (id, hotel_id, branch_id, branch_name, date, date_time, order_type, total_base_amount, total_cgst_amount, total_sgst_amount, total_gst_amount, total, payment_mode, applied_gst_rate, show_tax_on_bill) VALUES
('txn-001-002', 'Hotel-001', 'branch-2', 'bangalore', '2025-11-27', '2025-11-27 13:15:00', 'Takeaway', 420.00, 10.50, 10.50, 21.00, 441.00, 'Card', 5.0, true)
ON CONFLICT (id) DO UPDATE SET
    hotel_id = EXCLUDED.hotel_id,
    branch_id = EXCLUDED.branch_id,
    branch_name = EXCLUDED.branch_name,
    date = EXCLUDED.date,
    date_time = EXCLUDED.date_time,
    order_type = EXCLUDED.order_type,
    total_base_amount = EXCLUDED.total_base_amount,
    total_cgst_amount = EXCLUDED.total_cgst_amount,
    total_sgst_amount = EXCLUDED.total_sgst_amount,
    total_gst_amount = EXCLUDED.total_gst_amount,
    total = EXCLUDED.total,
    payment_mode = EXCLUDED.payment_mode,
    applied_gst_rate = EXCLUDED.applied_gst_rate,
    show_tax_on_bill = EXCLUDED.show_tax_on_bill;

-- Delete existing transaction items first, then insert new ones
DELETE FROM transaction_items WHERE transaction_id = 'txn-001-002';

INSERT INTO transaction_items (transaction_id, hotel_id, branch_id, item_id, item_name, order_type, price, base_price, final_price, cgst_percentage, sgst_percentage, cgst_amount, sgst_amount, gst_value, price_includes_tax, quantity, subtotal) VALUES
('txn-001-002', 'Hotel-001', 'branch-2', 'item-001-bangalore-mutton-biryani', 'Mutton Biryani', 'Takeaway', 230.00, 230.00, 241.50, 2.5, 2.5, 5.75, 5.75, 11.50, false, 1, 241.50),
('txn-001-002', 'Hotel-001', 'branch-2', 'item-001-bangalore-chicken-65', 'Chicken 65', 'Takeaway', 160.00, 160.00, 168.00, 2.5, 2.5, 4.00, 4.00, 8.00, false, 1, 168.00),
('txn-001-002', 'Hotel-001', 'branch-2', 'item-001-bangalore-raita', 'Raita', 'Takeaway', 45.00, 45.00, 47.25, 2.5, 2.5, 1.13, 1.13, 2.25, false, 1, 47.25);

-- Transaction 3: Hotel-002, Branch-1 (tondairpet) - Dining
INSERT INTO transactions (id, hotel_id, branch_id, branch_name, date, date_time, order_type, total_base_amount, total_cgst_amount, total_sgst_amount, total_gst_amount, total, payment_mode, applied_gst_rate, show_tax_on_bill) VALUES
('txn-002-001', 'Hotel-002', 'branch-1', 'tondairpet', '2025-11-27', '2025-11-27 08:30:00', 'Dining', 200.00, 5.00, 5.00, 10.00, 210.00, 'Cash', 5.0, true)
ON CONFLICT (id) DO UPDATE SET
    hotel_id = EXCLUDED.hotel_id,
    branch_id = EXCLUDED.branch_id,
    branch_name = EXCLUDED.branch_name,
    date = EXCLUDED.date,
    date_time = EXCLUDED.date_time,
    order_type = EXCLUDED.order_type,
    total_base_amount = EXCLUDED.total_base_amount,
    total_cgst_amount = EXCLUDED.total_cgst_amount,
    total_sgst_amount = EXCLUDED.total_sgst_amount,
    total_gst_amount = EXCLUDED.total_gst_amount,
    total = EXCLUDED.total,
    payment_mode = EXCLUDED.payment_mode,
    applied_gst_rate = EXCLUDED.applied_gst_rate,
    show_tax_on_bill = EXCLUDED.show_tax_on_bill;

-- Delete existing transaction items first, then insert new ones
DELETE FROM transaction_items WHERE transaction_id = 'txn-002-001';

INSERT INTO transaction_items (transaction_id, hotel_id, branch_id, item_id, item_name, order_type, price, base_price, final_price, cgst_percentage, sgst_percentage, cgst_amount, sgst_amount, gst_value, price_includes_tax, quantity, subtotal) VALUES
('txn-002-001', 'Hotel-002', 'branch-1', 'item-002-tondairpet-dosa', 'Masala Dosa', 'Dining', 80.00, 80.00, 84.00, 2.5, 2.5, 2.00, 2.00, 4.00, false, 2, 168.00),
('txn-002-001', 'Hotel-002', 'branch-1', 'item-002-tondairpet-idli', 'Idli (2 pcs)', 'Dining', 40.00, 40.00, 42.00, 2.5, 2.5, 1.00, 1.00, 2.00, false, 1, 42.00);

-- Transaction 4: Hotel-002, Branch-2 - Online Order
INSERT INTO transactions (id, hotel_id, branch_id, branch_name, date, date_time, order_type, total_base_amount, total_cgst_amount, total_sgst_amount, total_gst_amount, total, payment_mode, applied_gst_rate, show_tax_on_bill) VALUES
('txn-002-002', 'Hotel-002', 'branch-2', 'branch-2', '2025-11-27', '2025-11-27 19:00:00', 'Online Order', 170.00, 4.25, 4.25, 8.50, 178.50, 'Online', 5.0, true)
ON CONFLICT (id) DO UPDATE SET
    hotel_id = EXCLUDED.hotel_id,
    branch_id = EXCLUDED.branch_id,
    branch_name = EXCLUDED.branch_name,
    date = EXCLUDED.date,
    date_time = EXCLUDED.date_time,
    order_type = EXCLUDED.order_type,
    total_base_amount = EXCLUDED.total_base_amount,
    total_cgst_amount = EXCLUDED.total_cgst_amount,
    total_sgst_amount = EXCLUDED.total_sgst_amount,
    total_gst_amount = EXCLUDED.total_gst_amount,
    total = EXCLUDED.total,
    payment_mode = EXCLUDED.payment_mode,
    applied_gst_rate = EXCLUDED.applied_gst_rate,
    show_tax_on_bill = EXCLUDED.show_tax_on_bill;

-- Delete existing transaction items first, then insert new ones
DELETE FROM transaction_items WHERE transaction_id = 'txn-002-002';

INSERT INTO transaction_items (transaction_id, hotel_id, branch_id, item_id, item_name, order_type, price, base_price, final_price, cgst_percentage, sgst_percentage, cgst_amount, sgst_amount, gst_value, price_includes_tax, quantity, subtotal) VALUES
('txn-002-002', 'Hotel-002', 'branch-2', 'item-002-branch2-dosa', 'Masala Dosa', 'Online Order', 85.00, 85.00, 89.25, 2.5, 2.5, 2.13, 2.13, 4.25, false, 2, 178.50);

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check menu items by hotel
SELECT 
    h.name AS hotel_name,
    b.name AS branch_name,
    COUNT(mi.id) AS menu_item_count
FROM hotels h
JOIN branches b ON h.id = b.hotel_id
LEFT JOIN menu_items mi ON b.hotel_id = mi.hotel_id AND b.id = mi.branch_id
GROUP BY h.id, h.name, b.id, b.name
ORDER BY h.name, b.name;

-- Check transactions by hotel
SELECT 
    h.name AS hotel_name,
    b.name AS branch_name,
    COUNT(t.id) AS transaction_count,
    COALESCE(SUM(t.total), 0) AS total_revenue
FROM hotels h
JOIN branches b ON h.id = b.hotel_id
LEFT JOIN transactions t ON b.hotel_id = t.hotel_id AND b.id = t.branch_id
GROUP BY h.id, h.name, b.id, b.name
ORDER BY h.name, b.name;

