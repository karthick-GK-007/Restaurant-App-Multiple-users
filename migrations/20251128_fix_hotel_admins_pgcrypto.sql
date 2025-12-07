BEGIN;

-- Ensure pgcrypto functions live in the shared extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Recreate the verifier function with a search_path that includes extensions
CREATE OR REPLACE FUNCTION verify_hotel_admin_password(
    p_hotel_identifier TEXT,
    p_password TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    stored_hash TEXT;
BEGIN
    IF p_hotel_identifier IS NULL OR p_hotel_identifier = '' THEN
        RETURN FALSE;
    END IF;
    IF p_password IS NULL OR p_password = '' THEN
        RETURN FALSE;
    END IF;

    SELECT ha.password_hash
    INTO stored_hash
    FROM hotel_admins ha
    JOIN hotels h ON h.id = ha.hotel_id
    WHERE lower(ha.hotel_id) = lower(p_hotel_identifier)
       OR lower(COALESCE(h.slug, '')) = lower(p_hotel_identifier)
       OR lower(COALESCE(h.name, '')) = lower(p_hotel_identifier)
       OR lower(REPLACE(COALESCE(h.name, ''), ' ', '-')) = lower(p_hotel_identifier)
    LIMIT 1;

    IF stored_hash IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN extensions.crypt(p_password, stored_hash) = stored_hash;
END;
$$;

REVOKE ALL ON FUNCTION verify_hotel_admin_password(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_hotel_admin_password(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_hotel_admin_password(TEXT, TEXT) TO authenticated;

COMMIT;

