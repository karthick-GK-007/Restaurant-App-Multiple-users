BEGIN;

-- Ensure pgcrypto is available for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS hotel_admins (
    hotel_id TEXT PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    password_hint TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default passwords for existing hotels (update hashes idempotently)
INSERT INTO hotel_admins (hotel_id, password_hash, password_hint)
VALUES
    ('Hotel-001', crypt('suganya@123', gen_salt('bf')), 'Suganya default'),
    ('Hotel-002', crypt('kagan@123', gen_salt('bf')), 'Kagan default'),
    ('Hotel-003', crypt('karthick@123', gen_salt('bf')), 'Karthick default'),
    ('hotel-004', crypt('maha@123', gen_salt('bf')), 'Maha default')
ON CONFLICT (hotel_id) DO UPDATE
SET
    password_hash = EXCLUDED.password_hash,
    password_hint = EXCLUDED.password_hint,
    updated_at = NOW();

-- RPC helper to verify hotel-level admin password without exposing hashes
CREATE OR REPLACE FUNCTION verify_hotel_admin_password(
    p_hotel_identifier TEXT,
    p_password TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    LIMIT 1;

    IF stored_hash IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN crypt(p_password, stored_hash) = stored_hash;
END;
$$;

REVOKE ALL ON FUNCTION verify_hotel_admin_password(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_hotel_admin_password(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_hotel_admin_password(TEXT, TEXT) TO authenticated;

COMMIT;

