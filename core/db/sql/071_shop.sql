-- Shop: Bangla product landing pages with a cash-on-delivery order form (modules/shop, docs/shop.md).
--
--   shop_stores           one per store, keyed by the website created with it: analytics, heatmaps,
--                         replays and conversions on its pages are that website's. `slug` is the
--                         store's path on the shop host (seentics.shop/<slug>/…). Courier
--                         credentials are sealed like conversion destinations' (never returned).
--   shop_pages            one product page each. The gateway counts published ones for the plan's
--                         `shop_pages` limit, by `website_id` and `status`.
--   shop_orders           what buyers ordered. Prices are the page's at the time, worked out on the
--                         server. The buyer's IP, browser and ad ids are kept for the verified
--                         Purchase sent to the ad platforms, and the session for its replay. The
--                         gateway counts them per month for `shop_orders`, by `website_id` and
--                         `created_at`.
--   shop_blacklist        numbers a seller will not ship to. A seller's own, never shared.
--   shop_courier_checks   a courier's delivery record for a phone, cached a day per store.
--
-- SQL only, like conversion_events: the CHECKs below are the rules, and a table created from the
-- Drizzle schema first would have none of them.

CREATE TABLE IF NOT EXISTS shop_stores (
  website_id UUID PRIMARY KEY REFERENCES websites(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  slug VARCHAR(40) NOT NULL,
  name VARCHAR(80) NOT NULL,
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  facebook_url VARCHAR(300),
  logo_url VARCHAR(500),
  delivery_inside_dhaka INTEGER NOT NULL DEFAULT 60 CHECK (delivery_inside_dhaka BETWEEN 0 AND 5000),
  delivery_outside_dhaka INTEGER NOT NULL DEFAULT 120 CHECK (delivery_outside_dhaka BETWEEN 0 AND 5000),
  purchase_event_on VARCHAR(12) NOT NULL DEFAULT 'confirmed' CHECK (purchase_event_on IN ('placed', 'confirmed', 'delivered')),
  auto_block_high_risk BOOLEAN NOT NULL DEFAULT FALSE,
  steadfast_credentials TEXT,
  next_order_number INTEGER NOT NULL DEFAULT 1001,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_shop_stores_slug CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$')
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_shop_stores_slug ON shop_stores (slug);
CREATE INDEX IF NOT EXISTS ix_shop_stores_owner ON shop_stores (owner_id);

CREATE TABLE IF NOT EXISTS shop_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES shop_stores(website_id) ON DELETE CASCADE,
  slug VARCHAR(40) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  template VARCHAR(10) NOT NULL DEFAULT 'classic' CHECK (template IN ('classic', 'bold', 'minimal', 'offer')),
  accent CHAR(7) NOT NULL DEFAULT '#e11d48' CHECK (accent ~ '^#[0-9a-f]{6}$'),
  title VARCHAR(160) NOT NULL,
  product_name VARCHAR(120) NOT NULL,
  price INTEGER NOT NULL CHECK (price BETWEEN 1 AND 10000000),
  compare_price INTEGER CHECK (compare_price IS NULL OR compare_price BETWEEN 1 AND 10000000),
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT NOT NULL DEFAULT '',
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  faq JSONB NOT NULL DEFAULT '[]'::jsonb,
  options JSONB,
  max_quantity INTEGER NOT NULL DEFAULT 5 CHECK (max_quantity BETWEEN 1 AND 20),
  free_delivery BOOLEAN NOT NULL DEFAULT FALSE,
  thank_you_message VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  CONSTRAINT ck_shop_pages_slug CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$')
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_shop_pages_slug ON shop_pages (website_id, slug);

CREATE TABLE IF NOT EXISTS shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES shop_stores(website_id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  page_id UUID REFERENCES shop_pages(id) ON DELETE SET NULL,
  page_slug VARCHAR(40),
  product_name VARCHAR(120) NOT NULL,
  option VARCHAR(80),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  unit_price INTEGER NOT NULL,
  delivery_charge INTEGER NOT NULL,
  total INTEGER NOT NULL,
  customer_name VARCHAR(80) NOT NULL,
  phone VARCHAR(11) NOT NULL,
  address VARCHAR(300) NOT NULL,
  -- The address folded for matching (lib/risk.ts normalizeAddress): the duplicate-address check.
  address_key VARCHAR(300) NOT NULL DEFAULT '',
  area VARCHAR(14) NOT NULL CHECK (area IN ('inside_dhaka', 'outside_dhaka')),
  district VARCHAR(40),
  note VARCHAR(300),
  status VARCHAR(10) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled', 'fake')),
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  seller_note VARCHAR(1000),
  risk_level VARCHAR(5) NOT NULL DEFAULT 'safe' CHECK (risk_level IN ('safe', 'check', 'high')),
  risk_score INTEGER NOT NULL DEFAULT 0,
  risk_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  courier JSONB NOT NULL DEFAULT '{}'::jsonb,
  conversion_status VARCHAR(8) NOT NULL DEFAULT 'not_sent'
    CHECK (conversion_status IN ('not_sent', 'queued', 'sent', 'failed', 'skipped')),
  conversion_at TIMESTAMPTZ,
  page_url VARCHAR(2000),
  session_id VARCHAR(64),
  anonymous_id VARCHAR(64),
  client_ip VARCHAR(64),
  user_agent VARCHAR(500),
  ad JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_shop_orders_number ON shop_orders (website_id, number);
CREATE INDEX IF NOT EXISTS ix_shop_orders_created ON shop_orders (website_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_shop_orders_phone ON shop_orders (website_id, phone, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_shop_orders_address ON shop_orders (website_id, address_key, created_at DESC);

CREATE TABLE IF NOT EXISTS shop_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES shop_stores(website_id) ON DELETE CASCADE,
  phone VARCHAR(11) NOT NULL,
  reason VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_shop_blacklist_phone ON shop_blacklist (website_id, phone);

CREATE TABLE IF NOT EXISTS shop_courier_checks (
  website_id UUID NOT NULL REFERENCES shop_stores(website_id) ON DELETE CASCADE,
  phone VARCHAR(11) NOT NULL,
  courier VARCHAR(16) NOT NULL,
  result JSONB NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (website_id, phone, courier)
);
