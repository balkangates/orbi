-- =====================================================================
-- ORBI CITY BATUMI — Supabase Production Migration
-- Bu dosya src/db/schema.ts (Drizzle ORM) ile BİREBİR uyumludur.
-- Tablo/kolon adları kalıcı referanstır — değiştirmeyin.
-- Supabase SQL Editor'de tek seferde çalıştırın.
-- =====================================================================

-- ---------------------------------------------------------------------
-- TEMİZLİK (varsa eski/minimal tabloları kaldır — DİKKAT: veri siler)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS public.apartment_amenities CASCADE;
DROP TABLE IF EXISTS public.apartment_images CASCADE;
DROP TABLE IF EXISTS public.apartment_types CASCADE;
DROP TABLE IF EXISTS public.amenities CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.reservations CASCADE;
DROP TABLE IF EXISTS public.pricing_rules CASCADE;
DROP TABLE IF EXISTS public.coupons CASCADE;
DROP TABLE IF EXISTS public.apartments CASCADE;
DROP TABLE IF EXISTS public.blocks CASCADE;
DROP TABLE IF EXISTS public.facilities CASCADE;
DROP TABLE IF EXISTS public.genius_levels CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ---------------------------------------------------------------------
-- USERS  (Auth + Genius loyalty)
-- ---------------------------------------------------------------------
CREATE TABLE public.users (
  id                  SERIAL PRIMARY KEY,
  email               TEXT NOT NULL,
  password_hash       TEXT NOT NULL,
  full_name           TEXT NOT NULL DEFAULT '',
  phone               TEXT NOT NULL DEFAULT '',
  role                TEXT NOT NULL DEFAULT 'guest',          -- guest | admin
  genius_level        INTEGER NOT NULL DEFAULT 0,
  total_reservations  INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_idx ON public.users(email);

-- ---------------------------------------------------------------------
-- SESSIONS  (cookie auth)
-- ---------------------------------------------------------------------
CREATE TABLE public.sessions (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON public.sessions(user_id);

-- ---------------------------------------------------------------------
-- BLOCKS  (A, B, C)
-- ---------------------------------------------------------------------
CREATE TABLE public.blocks (
  id           SERIAL PRIMARY KEY,
  code         TEXT NOT NULL,                -- A | B | C
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  floors       INTEGER NOT NULL DEFAULT 40
);
CREATE UNIQUE INDEX blocks_code_idx ON public.blocks(code);

-- ---------------------------------------------------------------------
-- APARTMENT TYPES
-- ---------------------------------------------------------------------
CREATE TABLE public.apartment_types (
  id          SERIAL PRIMARY KEY,
  code        TEXT NOT NULL,                 -- studio | 1+1 | 2+1 | 3+1 | penthouse | loft | duplex
  name        TEXT NOT NULL,
  bedrooms    INTEGER NOT NULL DEFAULT 0,
  bathrooms   INTEGER NOT NULL DEFAULT 1,
  max_guests  INTEGER NOT NULL DEFAULT 2,
  size_sqm    INTEGER NOT NULL DEFAULT 35
);
CREATE UNIQUE INDEX apartment_types_code_idx ON public.apartment_types(code);

-- ---------------------------------------------------------------------
-- AMENITIES  (per-apartment)
-- ---------------------------------------------------------------------
CREATE TABLE public.amenities (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  icon      TEXT NOT NULL DEFAULT '✨',
  category  TEXT NOT NULL DEFAULT 'general'
);

-- ---------------------------------------------------------------------
-- FACILITIES  (shared, admin-managed)
-- ---------------------------------------------------------------------
CREATE TABLE public.facilities (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  icon         TEXT NOT NULL DEFAULT '🏨',
  hours        TEXT NOT NULL DEFAULT '24/7',
  active       BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------
-- APARTMENTS
-- ---------------------------------------------------------------------
CREATE TABLE public.apartments (
  id            SERIAL PRIMARY KEY,
  code          TEXT NOT NULL,                -- e.g. A-1203
  name          TEXT NOT NULL,
  block_id      INTEGER NOT NULL REFERENCES public.blocks(id),
  type_id       INTEGER NOT NULL REFERENCES public.apartment_types(id),
  floor         INTEGER NOT NULL DEFAULT 1,
  description   TEXT NOT NULL DEFAULT '',
  rules         TEXT NOT NULL DEFAULT '',
  base_price    NUMERIC(10,2) NOT NULL DEFAULT 80,
  max_guests    INTEGER NOT NULL DEFAULT 2,
  bedrooms      INTEGER NOT NULL DEFAULT 0,
  bathrooms     INTEGER NOT NULL DEFAULT 1,
  size_sqm      INTEGER NOT NULL DEFAULT 35,
  sea_view      BOOLEAN NOT NULL DEFAULT false,
  cover_image   TEXT NOT NULL DEFAULT '',
  video_url     TEXT NOT NULL DEFAULT '',
  tour_360_url  TEXT NOT NULL DEFAULT '',
  rating        NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count  INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active',   -- active | inactive
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX apartments_code_idx ON public.apartments(code);
CREATE INDEX apartments_block_idx ON public.apartments(block_id);
CREATE INDEX apartments_type_idx ON public.apartments(type_id);

-- ---------------------------------------------------------------------
-- APARTMENT IMAGES
-- ---------------------------------------------------------------------
CREATE TABLE public.apartment_images (
  id            SERIAL PRIMARY KEY,
  apartment_id  INTEGER NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX apartment_images_apartment_idx ON public.apartment_images(apartment_id);

-- ---------------------------------------------------------------------
-- APARTMENT <-> AMENITIES  (join)
-- ---------------------------------------------------------------------
CREATE TABLE public.apartment_amenities (
  apartment_id  INTEGER NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  amenity_id    INTEGER NOT NULL REFERENCES public.amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (apartment_id, amenity_id)
);

-- ---------------------------------------------------------------------
-- PRICING RULES  (Dynamic pricing)
-- ---------------------------------------------------------------------
CREATE TABLE public.pricing_rules (
  id            SERIAL PRIMARY KEY,
  apartment_id  INTEGER REFERENCES public.apartments(id) ON DELETE CASCADE, -- null = global
  name          TEXT NOT NULL,
  rule_type     TEXT NOT NULL DEFAULT 'season',  -- season | weekend | lastminute | length
  start_date    DATE,
  end_date      DATE,
  multiplier    NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  priority      INTEGER NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX pricing_rules_apartment_idx ON public.pricing_rules(apartment_id);

-- ---------------------------------------------------------------------
-- COUPONS
-- ---------------------------------------------------------------------
CREATE TABLE public.coupons (
  id              SERIAL PRIMARY KEY,
  code            TEXT NOT NULL,
  discount_type   TEXT NOT NULL DEFAULT 'percent', -- percent | fixed
  discount_value  NUMERIC(10,2) NOT NULL DEFAULT 10,
  min_nights      INTEGER NOT NULL DEFAULT 1,
  valid_from      DATE,
  valid_to        DATE,
  max_uses        INTEGER NOT NULL DEFAULT 1000,
  used_count      INTEGER NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX coupons_code_idx ON public.coupons(code);

-- ---------------------------------------------------------------------
-- RESERVATIONS
-- ---------------------------------------------------------------------
CREATE TABLE public.reservations (
  id                SERIAL PRIMARY KEY,
  reference         TEXT NOT NULL,
  apartment_id      INTEGER NOT NULL REFERENCES public.apartments(id),
  user_id           INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  check_in          DATE NOT NULL,
  check_out         DATE NOT NULL,
  nights            INTEGER NOT NULL DEFAULT 1,
  guests            INTEGER NOT NULL DEFAULT 1,
  base_price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal          NUMERIC(10,2) NOT NULL DEFAULT 0,
  genius_discount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_discount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price       NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_id         INTEGER REFERENCES public.coupons(id) ON DELETE SET NULL,
  guest_name        TEXT NOT NULL DEFAULT '',
  guest_email       TEXT NOT NULL DEFAULT '',
  guest_phone       TEXT NOT NULL DEFAULT '',
  note              TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'confirmed',  -- pending | confirmed | cancelled | completed
  payment_status    TEXT NOT NULL DEFAULT 'paid',       -- paid | unpaid | refunded
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX reservations_reference_idx ON public.reservations(reference);
CREATE INDEX reservations_apartment_idx ON public.reservations(apartment_id);
CREATE INDEX reservations_user_idx ON public.reservations(user_id);
CREATE INDEX reservations_date_idx ON public.reservations(check_in, check_out);

-- ---------------------------------------------------------------------
-- REVIEWS
-- ---------------------------------------------------------------------
CREATE TABLE public.reviews (
  id              SERIAL PRIMARY KEY,
  apartment_id    INTEGER NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  user_id         INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  reservation_id  INTEGER REFERENCES public.reservations(id) ON DELETE SET NULL,
  author_name     TEXT NOT NULL DEFAULT 'Guest',
  rating          INTEGER NOT NULL DEFAULT 5,
  cleanliness     INTEGER NOT NULL DEFAULT 5,
  location        INTEGER NOT NULL DEFAULT 5,
  value           INTEGER NOT NULL DEFAULT 5,
  comment         TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reviews_apartment_idx ON public.reviews(apartment_id);

-- ---------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------
CREATE TABLE public.notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL DEFAULT '',
  type        TEXT NOT NULL DEFAULT 'info', -- info | success | warning | genius
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id);

-- ---------------------------------------------------------------------
-- GENIUS LEVELS  (loyalty configuration)
-- ---------------------------------------------------------------------
CREATE TABLE public.genius_levels (
  id                 SERIAL PRIMARY KEY,
  level              INTEGER NOT NULL,
  name               TEXT NOT NULL,
  min_reservations   INTEGER NOT NULL DEFAULT 0,
  discount_percent   INTEGER NOT NULL DEFAULT 0,
  perks              TEXT NOT NULL DEFAULT ''
);

-- =====================================================================
-- TRIGGER: Genius seviyesi otomatik hesaplama
-- Rezervasyon onaylandığında / iptal edildiğinde kullanıcının
-- total_reservations ve genius_level alanlarını otomatik günceller.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_recalculate_genius_level()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id INTEGER;
  v_count INTEGER;
  v_new_level INTEGER;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.reservations
  WHERE user_id = v_user_id AND status <> 'cancelled';

  v_new_level := CASE
    WHEN v_count >= 15 THEN 3
    WHEN v_count >= 5  THEN 2
    WHEN v_count >= 2  THEN 1
    ELSE 0
  END;

  UPDATE public.users
  SET total_reservations = v_count,
      genius_level = v_new_level
  WHERE id = v_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_genius_on_reservation ON public.reservations;
CREATE TRIGGER trg_genius_on_reservation
AFTER INSERT OR UPDATE OF status OR DELETE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.fn_recalculate_genius_level();

-- =====================================================================
-- TRIGGER: Apartman rating otomatik hesaplama (review eklenince)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_recalculate_apartment_rating()
RETURNS TRIGGER AS $$
DECLARE
  v_apartment_id INTEGER;
  v_avg NUMERIC;
  v_count INTEGER;
BEGIN
  v_apartment_id := COALESCE(NEW.apartment_id, OLD.apartment_id);

  SELECT COALESCE(AVG(rating), 0), COUNT(*) INTO v_avg, v_count
  FROM public.reviews
  WHERE apartment_id = v_apartment_id;

  UPDATE public.apartments
  SET rating = ROUND(v_avg, 2),
      review_count = v_count
  WHERE id = v_apartment_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_rating_on_review ON public.reviews;
CREATE TRIGGER trg_rating_on_review
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.fn_recalculate_apartment_rating();

-- =====================================================================
-- ROW LEVEL SECURITY
-- Uygulama Supabase Service Role Key ile (server-side) bağlanır,
-- bu yüzden RLS service_role için bypass edilir. Public/anon erişimi
-- yalnızca okunabilir tablolarda açık tutulur (defense-in-depth).
-- =====================================================================
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apartment_types     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amenities           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apartments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apartment_images    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apartment_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genius_levels       ENABLE ROW LEVEL SECURITY;

-- Public (anon) okuma — vitrin verileri
CREATE POLICY public_read_blocks           ON public.blocks            FOR SELECT USING (true);
CREATE POLICY public_read_apartment_types  ON public.apartment_types   FOR SELECT USING (true);
CREATE POLICY public_read_amenities        ON public.amenities         FOR SELECT USING (true);
CREATE POLICY public_read_facilities       ON public.facilities        FOR SELECT USING (active = true);
CREATE POLICY public_read_apartments       ON public.apartments        FOR SELECT USING (status = 'active');
CREATE POLICY public_read_apartment_images ON public.apartment_images  FOR SELECT USING (true);
CREATE POLICY public_read_apartment_amen   ON public.apartment_amenities FOR SELECT USING (true);
CREATE POLICY public_read_reviews          ON public.reviews           FOR SELECT USING (true);
CREATE POLICY public_read_genius_levels    ON public.genius_levels     FOR SELECT USING (true);

-- service_role her tabloda tam erişime sahiptir (varsayılan, RLS service_role'u bypass eder).
-- Uygulama sunucu tarafında SUPABASE_SERVICE_ROLE_KEY (veya doğrudan Postgres bağlantısı)
-- kullandığından, ek service_role policy'sine gerek yoktur.

-- =====================================================================
-- STORAGE BUCKET (apartman görselleri, video, 360 tur için)
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('apartment-media', 'apartment-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_apartment_media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'apartment-media');

CREATE POLICY "service_role_write_apartment_media"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'apartment-media');

-- =====================================================================
-- REALTIME (rezervasyon/bildirim canlı güncellemeler için)
-- =====================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.apartments;

-- =====================================================================
-- BİTTİ — Şimdi src/db/seed.ts çalıştırılarak örnek veri yüklenebilir
-- (npm run db:seed), DATABASE_URL Supabase connection string'i olmalı.
-- =====================================================================
