-- Reset Hotel Admin Passwords
-- This script allows you to reset passwords for hotel admins
-- Run this in your Supabase SQL Editor

BEGIN;

-- Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Function to reset a hotel admin password
-- Usage: SELECT reset_hotel_admin_password('Hotel-001', 'newpassword123', 'Optional hint');

CREATE OR REPLACE FUNCTION reset_hotel_admin_password(
    p_hotel_identifier TEXT,
    p_new_password TEXT,
    p_password_hint TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_hotel_id TEXT;
    v_password_hash TEXT;
BEGIN
    -- Find the hotel by ID, slug, or name
    SELECT h.id INTO v_hotel_id
    FROM hotels h
    WHERE lower(h.id) = lower(p_hotel_identifier)
       OR lower(COALESCE(h.slug, '')) = lower(p_hotel_identifier)
       OR lower(COALESCE(h.name, '')) = lower(p_hotel_identifier)
       OR lower(REPLACE(COALESCE(h.name, ''), ' ', '-')) = lower(p_hotel_identifier)
    LIMIT 1;

    IF v_hotel_id IS NULL THEN
        RETURN 'ERROR: Hotel not found. Please check the hotel identifier.';
    END IF;

    -- Generate password hash
    v_password_hash := extensions.crypt(p_new_password, extensions.gen_salt('bf'));

    -- Insert or update the password
    INSERT INTO hotel_admins (hotel_id, password_hash, password_hint, updated_at)
    VALUES (v_hotel_id, v_password_hash, p_password_hint, NOW())
    ON CONFLICT (hotel_id) DO UPDATE
    SET
        password_hash = EXCLUDED.password_hash,
        password_hint = COALESCE(EXCLUDED.password_hint, hotel_admins.password_hint),
        updated_at = NOW();

    RETURN 'SUCCESS: Password reset for hotel ' || v_hotel_id || '. New password: ' || p_new_password;
END;
$$;

-- Grant execute permission
REVOKE ALL ON FUNCTION reset_hotel_admin_password(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reset_hotel_admin_password(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================
-- RESET PASSWORDS FOR ALL HOTELS (Examples)
-- ============================================
-- Uncomment and modify the lines below to reset passwords

-- Reset password for Hotel-001 (Suganya)
-- SELECT reset_hotel_admin_password('Hotel-001', 'suganya@123', 'Suganya default password');

-- Reset password for Hotel-002 (Kagan)
-- SELECT reset_hotel_admin_password('Hotel-002', 'kagan@123', 'Kagan default password');

-- Reset password for Hotel-003 (Karthick)
-- SELECT reset_hotel_admin_password('Hotel-003', 'karthick@123', 'Karthick default password');

-- Reset password for hotel-004 (Maha)
-- SELECT reset_hotel_admin_password('hotel-004', 'maha@123', 'Maha default password');

-- Reset password for Hotel-101 (if exists)
-- SELECT reset_hotel_admin_password('Hotel-101', 'newpassword123', 'Custom hint');

-- Reset password for Hotel-102 (if exists)
-- SELECT reset_hotel_admin_password('Hotel-102', 'newpassword123', 'Custom hint');

-- ============================================
-- VIEW CURRENT HOTELS AND THEIR PASSWORDS (Hints only, not actual passwords)
-- ============================================
-- Run this query to see all hotels and their password hints:
-- SELECT 
--     h.id as hotel_id,
--     h.name as hotel_name,
--     h.slug as hotel_slug,
--     ha.password_hint,
--     ha.updated_at as password_last_updated
-- FROM hotels h
-- LEFT JOIN hotel_admins ha ON h.id = ha.hotel_id
-- ORDER BY h.id;

COMMIT;

