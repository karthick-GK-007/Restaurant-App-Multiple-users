-- Updated Supabase Database Schema for Restaurant POS System
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Branches Table
CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    qr_code_url TEXT
);

-- Menu Items Table (with branch name for tracking)
CREATE TABLE IF NOT EXISTS menu_items (
    id BIGINT PRIMARY KEY,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    branch_name TEXT NOT NULL, -- Added for tracking
    name TEXT NOT NULL,
    category TEXT,
    price DECIMAL(10, 2),
    has_sizes BOOLEAN DEFAULT FALSE,
    sizes JSONB, -- Stores sizes as JSON: {"quarter": {"price": 200}, "half": {"price": 350}}
    image TEXT,
    availability TEXT DEFAULT 'Available', -- 'Available' or 'Unavailable'
    pricing_mode TEXT DEFAULT 'inclusive', -- inclusive / exclusive
    pricing_metadata JSONB, -- stores base/final/cgst/sgst breakdown per order type & size
    dining_cgst_percentage DECIMAL(5, 2) DEFAULT 0,
    dining_sgst_percentage DECIMAL(5, 2) DEFAULT 0,
    takeaway_cgst_percentage DECIMAL(5, 2) DEFAULT 0,
    takeaway_sgst_percentage DECIMAL(5, 2) DEFAULT 0,
    onlineorder_cgst_percentage DECIMAL(5, 2) DEFAULT 0,
    onlineorder_sgst_percentage DECIMAL(5, 2) DEFAULT 0,
    show_tax_on_bill BOOLEAN DEFAULT TRUE
);

-- Transactions Table (with incremental ID)
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY, -- Changed to TEXT for formatted IDs like "0001"
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE SET NULL,
    branch_name TEXT,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    date_time TEXT NOT NULL, -- Format: DD/MM/YYYY, HH:MM AM/PM
    order_type TEXT NOT NULL DEFAULT 'Dining',
    total_base_amount DECIMAL(10, 2),
    total_cgst_amount DECIMAL(10, 2),
    total_sgst_amount DECIMAL(10, 2),
    total_gst_amount DECIMAL(10, 2),
    total DECIMAL(10, 2) NOT NULL,
    payment_mode TEXT DEFAULT 'Cash', -- 'Cash', 'UPI', 'Card', etc.
    applied_gst_rate DECIMAL(5, 2),
    show_tax_on_bill BOOLEAN DEFAULT TRUE,
    qr_code_url TEXT
);

-- Transaction Items Table (separate table for items)
CREATE TABLE IF NOT EXISTS transaction_items (
    id BIGSERIAL PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    item_id BIGINT,
    item_name TEXT NOT NULL,
    order_type TEXT NOT NULL DEFAULT 'Dining',
    price DECIMAL(10, 2) NOT NULL,
    base_price DECIMAL(10, 2),
    final_price DECIMAL(10, 2),
    cgst_percentage DECIMAL(5, 2),
    sgst_percentage DECIMAL(5, 2),
    cgst_amount DECIMAL(10, 2),
    sgst_amount DECIMAL(10, 2),
    gst_value DECIMAL(10, 2),
    price_includes_tax BOOLEAN DEFAULT TRUE,
    quantity INTEGER NOT NULL DEFAULT 1,
    size TEXT, -- 'quarter', 'half', 'full', 'small', 'medium', 'large', or NULL
    subtotal DECIMAL(10, 2) NOT NULL -- price * quantity
);

-- Config Table (for restaurant settings)
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Insert default config values
INSERT INTO config (key, value) VALUES 
    ('restaurant_title', 'Restaurant Menu'),
    ('admin_password', 'admin123'),
    ('gst_dining_cgst_percentage', '2.5'),
    ('gst_dining_sgst_percentage', '2.5'),
    ('gst_takeaway_cgst_percentage', '2.5'),
    ('gst_takeaway_sgst_percentage', '2.5'),
    ('gst_onlineorder_cgst_percentage', '2.5'),
    ('gst_onlineorder_sgst_percentage', '2.5'),
    ('gst_show_tax_on_bill', 'true'),
    ('theme_primary', '#C6A667'),
    ('theme_primary_dark', '#A4843D'),
    ('theme_secondary', '#1F1F1F'),
    ('theme_accent', '#FFB347'),
    ('theme_background', '#F8F5F0'),
    ('theme_surface', '#FFFFFF'),
    ('theme_text_primary', '#1A1A1A'),
    ('theme_text_muted', '#6B6B6B'),
    ('theme_success', '#2ECC71'),
    ('theme_danger', '#E74C3C')
ON CONFLICT (key) DO NOTHING;

-- Create sequence for transaction IDs (resets when all transactions deleted)
CREATE SEQUENCE IF NOT EXISTS transaction_id_seq START 1;

-- Function to get next transaction ID (formatted as 0001, 0002, etc.)
CREATE OR REPLACE FUNCTION get_next_transaction_id()
RETURNS TEXT AS $$
DECLARE
    next_id INTEGER;
    formatted_id TEXT;
BEGIN
    -- Get the next sequence value
    next_id := nextval('transaction_id_seq');
    
    -- Format as 4-digit zero-padded string
    formatted_id := LPAD(next_id::TEXT, 4, '0');
    
    RETURN formatted_id;
END;
$$ LANGUAGE plpgsql;

-- Function to reset transaction ID sequence (call when all transactions deleted)
CREATE OR REPLACE FUNCTION reset_transaction_id_sequence()
RETURNS VOID AS $$
BEGIN
    -- Reset sequence to start from 1
    ALTER SEQUENCE transaction_id_seq RESTART WITH 1;
END;
$$ LANGUAGE plpgsql;

-- Trigger to reset sequence when all transactions are deleted
CREATE OR REPLACE FUNCTION check_reset_transaction_sequence()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if no transactions remain
    IF (SELECT COUNT(*) FROM transactions) = 0 THEN
        PERFORM reset_transaction_id_sequence();
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires after DELETE
CREATE TRIGGER reset_transaction_id_after_delete
AFTER DELETE ON transactions
FOR EACH STATEMENT
EXECUTE FUNCTION check_reset_transaction_sequence();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_menu_items_branch_id ON menu_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_branch_name ON menu_items(branch_name);
CREATE INDEX IF NOT EXISTS idx_transactions_branch_id ON transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_datetime ON transactions(date_time);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_item_id ON transaction_items(item_id);

-- Enable Row Level Security (RLS)
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (you can restrict these later for security)
-- For development, we'll allow all operations. In production, create proper policies.

-- Branches policies
CREATE POLICY "Allow all operations on branches" ON branches
    FOR ALL USING (true) WITH CHECK (true);

-- Menu items policies
CREATE POLICY "Allow all operations on menu_items" ON menu_items
    FOR ALL USING (true) WITH CHECK (true);

-- Transactions policies
CREATE POLICY "Allow all operations on transactions" ON transactions
    FOR ALL USING (true) WITH CHECK (true);

-- Transaction items policies
CREATE POLICY "Allow all operations on transaction_items" ON transaction_items
    FOR ALL USING (true) WITH CHECK (true);

-- Config policies
CREATE POLICY "Allow all operations on config" ON config
    FOR ALL USING (true) WITH CHECK (true);

-- Function to automatically update branch_name in menu_items when branch name changes
CREATE OR REPLACE FUNCTION update_menu_items_branch_name()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all menu items with the new branch name
    UPDATE menu_items
    SET branch_name = NEW.name
    WHERE branch_id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update branch_name in menu_items when branch name is updated
CREATE TRIGGER update_menu_items_on_branch_update
AFTER UPDATE OF name ON branches
FOR EACH ROW
EXECUTE FUNCTION update_menu_items_branch_name();


