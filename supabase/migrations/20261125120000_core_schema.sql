-- =====================================================================
-- Bia Store Importados — esquema principal
-- Dinheiro sempre em centavos (integer/bigint). Timestamps em UTC (timestamptz).
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Função imutável para busca sem acentos
create or replace function public.immutable_unaccent(text)
returns text language sql immutable parallel safe strict
set search_path = public, extensions
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------------
-- Configurações da loja (linha única, id = 1)
-- ---------------------------------------------------------------------
create table public.store_settings (
  id smallint primary key default 1 check (id = 1),
  store_name text not null default 'Bia Store Importados',
  legal_name text,                    -- pendente: razão social
  document_id text,                   -- pendente: CPF/CNPJ
  contact_email text,                 -- pendente
  whatsapp_e164 text not null default '5517992066575',
  instagram_handle text not null default 'biastore_importados',
  public_address_line text,           -- só preencher após autorização de divulgação
  public_address_city text,
  public_address_state text,
  public_address_cep text,
  address_publication_authorized boolean not null default false,
  business_hours text,                -- pendente
  logo_path text,                     -- logo original enviada pela proprietária (Storage)
  hero_image_path text,               -- foto real de produtos para o destaque da home
  hero_image_alt text,
  about_text text,                    -- texto curto "Sobre" (sem alegações não comprovadas)
  origin_cep text not null default '15054160',
  preparation_business_days integer not null default 3 check (preparation_business_days between 0 and 30),
  -- Encomendas: unidade NULA = ainda não confirmada pela proprietária -> checkout de encomenda bloqueado
  preorder_default_lead_time_value integer not null default 20 check (preorder_default_lead_time_value between 1 and 120),
  preorder_default_lead_time_unit text check (preorder_default_lead_time_unit in ('calendar_days','business_days')),
  mixed_cart_single_shipment boolean not null default true,
  split_shipments_enabled boolean not null default false,
  free_shipping_enabled boolean not null default false,
  pickup_enabled boolean not null default false,
  pickup_instructions text,
  reservation_minutes integer not null default 60 check (reservation_minutes between 15 and 1440),
  low_stock_threshold integer not null default 2,
  payment_pix_enabled boolean not null default true,
  payment_credit_card_enabled boolean not null default true,
  max_installments integer not null default 12 check (max_installments between 1 and 12),
  assured_installments integer not null default 0 check (assured_installments between 0 and 12),
  checkout_enabled boolean not null default false,   -- só liberar após checklist de lançamento
  analytics_retention_days integer not null default 395,
  updated_at timestamptz not null default now()
);
create trigger trg_store_settings_updated before update on public.store_settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Perfis, papéis e endereços
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text,
  cep text not null check (cep ~ '^[0-9]{8}$'),
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  city text not null,
  state text not null check (state ~ '^[A-Z]{2}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses(user_id);
create trigger trg_addresses_updated before update on public.addresses
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete restrict,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  description text,
  image_path text,
  seo_title text,
  seo_description text,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index categories_parent_idx on public.categories(parent_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  brand_id uuid references public.brands(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  subcategory_id uuid references public.categories(id) on delete restrict,
  gender text not null default 'not_applicable'
    check (gender in ('female','male','kids','unisex','not_applicable')),
  price_cents integer check (price_cents is null or price_cents >= 100),
  promo_price_cents integer check (promo_price_cents is null or promo_price_cents >= 100),
  volume_ml numeric(7,1) check (volume_ml is null or volume_ml > 0),
  is_decant boolean not null default false,
  description text,
  top_notes text[] not null default '{}',
  heart_notes text[] not null default '{}',
  base_notes text[] not null default '{}',
  accords text[] not null default '{}',
  olfactory_family text,
  olfactory_description text,
  product_type text,                   -- ex.: sérum, máscara capilar (skincare/cabelos)
  contents text,
  how_to_use text,
  composition text,
  warnings text,
  benefits text,
  sku text unique,
  status text not null default 'draft' check (status in ('draft','active','sold_out','archived')),
  fulfillment_mode text not null default 'ready_stock'
    check (fulfillment_mode in ('ready_stock','accepts_preorder','unavailable')),
  preorder_enabled boolean generated always as (fulfillment_mode = 'accepts_preorder') stored,
  preorder_max_quantity integer check (preorder_max_quantity is null or preorder_max_quantity > 0),
  preorder_lead_time_value integer check (preorder_lead_time_value is null or preorder_lead_time_value between 1 and 120),
  preorder_lead_time_unit text check (preorder_lead_time_unit in ('calendar_days','business_days')),
  preorder_internal_notes text,        -- interno, nunca exibir
  supplier_name text,                  -- interno
  stock_on_hand integer not null default 0 check (stock_on_hand >= 0),
  stock_reserved integer not null default 0 check (stock_reserved >= 0),
  preorder_reserved integer not null default 0 check (preorder_reserved >= 0),
  preorder_committed integer not null default 0 check (preorder_committed >= 0),
  weight_g integer check (weight_g is null or weight_g > 0),
  width_cm numeric(6,1) check (width_cm is null or width_cm > 0),
  height_cm numeric(6,1) check (height_cm is null or height_cm > 0),
  length_cm numeric(6,1) check (length_cm is null or length_cm > 0),
  highlights text[] not null default '{}'
    check (highlights <@ array['new','bestseller','recommended','promo']::text[]),
  is_bundle boolean not null default false,
  bundle_max_quantity integer check (bundle_max_quantity is null or bundle_max_quantity >= 0),
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (
    lower(public.immutable_unaccent(coalesce(name,'') || ' ' || coalesce(sku,'') || ' ' || coalesce(olfactory_family,'') || ' ' || coalesce(product_type,'') || ' ' || coalesce(description,'')))
  ) stored,
  constraint stock_reserved_le_on_hand check (stock_reserved <= stock_on_hand),
  constraint promo_lt_price check (promo_price_cents is null or price_cents is null or promo_price_cents < price_cents),
  constraint preorder_capacity check (preorder_max_quantity is null or preorder_reserved + preorder_committed <= preorder_max_quantity),
  constraint active_requires_price check (status not in ('active','sold_out') or price_cents is not null)
);
create index products_category_idx on public.products(category_id);
create index products_subcategory_idx on public.products(subcategory_id);
create index products_brand_idx on public.products(brand_id);
create index products_status_idx on public.products(status);
create index products_price_idx on public.products(coalesce(promo_price_cents, price_cents));
create index products_search_trgm on public.products using gin (search_text extensions.gin_trgm_ops);
create index products_highlights_idx on public.products using gin (highlights);
create trigger trg_products_updated before update on public.products
for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  kind text not null default 'image' check (kind in ('image','video')),
  storage_path text not null,          -- caminho no bucket "products" ou URL externa https
  alt_text text not null,
  width integer, height integer,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images(product_id, position);

create table public.bundle_items (
  bundle_product_id uuid not null references public.products(id) on delete cascade,
  component_product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  primary key (bundle_product_id, component_product_id),
  check (bundle_product_id <> component_product_id)
);
create index bundle_items_component_idx on public.bundle_items(component_product_id);

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products(id) on delete restrict,
  kind text not null check (kind in ('initial','adjustment','receipt','sale','sale_cancelled','return','preorder_allocation','loss')),
  quantity integer not null,           -- positivo entra, negativo sai do físico
  order_id uuid,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index inventory_movements_product_idx on public.inventory_movements(product_id, created_at desc);

-- ---------------------------------------------------------------------
-- Carrinho e favoritos
-- ---------------------------------------------------------------------
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  abandoned_notified_at timestamptz
);
create table public.cart_items (
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 20),
  added_at timestamptz not null default now(),
  primary key (cart_id, product_id)
);
create index cart_items_product_idx on public.cart_items(product_id);

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index favorites_product_idx on public.favorites(product_id);

-- ---------------------------------------------------------------------
-- Frete
-- ---------------------------------------------------------------------
create table public.local_delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cep_ranges jsonb not null default '[]'::jsonb,    -- [{"from":"15000000","to":"15099999"}]
  fee_cents integer not null check (fee_cents >= 0),
  lead_time_text text not null,                    -- ex.: "1 a 2 dias úteis após a preparação"
  active boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.shipping_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  destination_cep text not null check (destination_cep ~ '^[0-9]{8}$'),
  cart_fingerprint text not null,       -- hash dos itens/quantidades no momento da cotação
  package jsonb not null,               -- peso/dimensões calculados
  options jsonb not null,               -- [{code, provider, service, label, price_cents, days_min, days_max}]
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours'
);
create index shipping_quotes_user_idx on public.shipping_quotes(user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Promoções
-- ---------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  description text,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value integer not null check (discount_value > 0),  -- percent: 1..100; fixed: centavos
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  min_subtotal_cents integer check (min_subtotal_cents is null or min_subtotal_cents >= 0),
  product_ids uuid[] not null default '{}',
  category_ids uuid[] not null default '{}',
  bundles_only boolean not null default false,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value between 1 and 100)
);

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('BIA-' || nextval('public.order_number_seq')::text),
  order_nsu text not null unique default replace(gen_random_uuid()::text, '-', ''),
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'awaiting_payment' check (status in (
    'awaiting_payment','paid','preparing','awaiting_procurement','procurement_received',
    'ready_to_ship','shipped','delivered','cancelled','refunded','payment_failed')),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  coupon_id uuid references public.coupons(id),
  coupon_code text,
  customer_snapshot jsonb not null,     -- {name,email,phone}
  shipping_address jsonb,               -- snapshot do endereço
  shipping_option jsonb not null,       -- snapshot da cotação escolhida
  has_preorder boolean not null default false,
  preorder_terms_text text,             -- texto exibido e aceito
  preorder_terms_accepted_at timestamptz,
  dispatch_rule jsonb not null,         -- {kind:'ready'|'preorder', value, unit}
  dispatch_due_at timestamptz,          -- calculado no servidor após pagamento
  payment_link_url text,
  payment_expires_at timestamptz,
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  tracking_code text,
  attribution jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_cents = subtotal_cents - discount_cents + shipping_cents),
  check (not has_preorder or preorder_terms_accepted_at is not null)
);
create index orders_user_idx on public.orders(user_id, created_at desc);
create index orders_status_idx on public.orders(status, created_at desc);
create index orders_created_idx on public.orders(created_at desc);
create trigger trg_orders_updated before update on public.orders
for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  brand_name text,
  sku text,
  description_snapshot text,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  fulfillment text not null check (fulfillment in ('ready_stock','preorder')),
  lead_time_value integer,
  lead_time_unit text check (lead_time_unit in ('calendar_days','business_days')),
  is_bundle boolean not null default false,
  bundle_components jsonb,
  check (line_total_cents = unit_price_cents * quantity),
  check (fulfillment <> 'preorder' or (lead_time_value is not null and lead_time_unit is not null))
);
create index order_items_order_idx on public.order_items(order_id);
create index order_items_product_idx on public.order_items(product_id);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  visible_to_customer boolean not null default true,
  actor text not null default 'system',   -- system | admin:<uuid> | webhook
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history(order_id, created_at);

create table public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  kind text not null check (kind in ('stock','preorder')),
  status text not null default 'active' check (status in ('active','consumed','released')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index stock_reservations_active_idx on public.stock_reservations(status, expires_at);
create index stock_reservations_order_idx on public.stock_reservations(order_id);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending','confirmed','released')),
  created_at timestamptz not null default now()
);
create index coupon_redemptions_coupon_idx on public.coupon_redemptions(coupon_id, status);

-- ---------------------------------------------------------------------
-- Encomendas (procurement)
-- ---------------------------------------------------------------------
create table public.preorder_allocations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  quantity_received integer not null default 0 check (quantity_received >= 0),
  status text not null default 'awaiting_purchase' check (status in (
    'awaiting_purchase','purchased','awaiting_receipt','received','ready_to_ship','shipped','cancelled','refunded')),
  paid_at timestamptz not null,
  dispatch_due_at timestamptz not null,
  supplier_name text,
  internal_eta date,
  internal_notes text,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_received <= quantity)
);
create index preorder_allocations_product_idx on public.preorder_allocations(product_id, status, paid_at);
create index preorder_allocations_due_idx on public.preorder_allocations(status, dispatch_due_at);
create index preorder_allocations_order_idx on public.preorder_allocations(order_id);
create trigger trg_preorder_alloc_updated before update on public.preorder_allocations
for each row execute function public.set_updated_at();

create table public.procurement_updates (
  id bigint generated always as identity primary key,
  allocation_id uuid not null references public.preorder_allocations(id) on delete cascade,
  note text not null,
  notify_customer boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index procurement_updates_alloc_idx on public.procurement_updates(allocation_id);

-- ---------------------------------------------------------------------
-- Pagamentos
-- ---------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null default 'infinitepay',
  order_nsu text not null,
  invoice_slug text,
  transaction_nsu text,
  status text not null check (status in ('link_created','paid','settled','failed','canceled','refunded','review')),
  amount_cents integer,
  paid_amount_cents integer,
  installments integer,
  capture_method text,
  receipt_url text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index payments_transaction_uidx on public.payments(provider, transaction_nsu) where transaction_nsu is not null;
create index payments_order_idx on public.payments(order_id);
create trigger trg_payments_updated before update on public.payments
for each row execute function public.set_updated_at();

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'infinitepay',
  dedupe_key text not null,
  event_type text,
  order_nsu text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  result text,
  unique (provider, dedupe_key)
);

create table public.admin_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                  -- payment_mismatch, unknown_order, late_payment, preorder_overdue...
  order_id uuid references public.orders(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index admin_alerts_open_idx on public.admin_alerts(resolved_at, created_at desc);

-- ---------------------------------------------------------------------
-- Avaliações
-- ---------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 2000),
  author_display_name text not null,
  verified_purchase boolean not null default true,
  status text not null default 'pending' check (status in ('pending','approved','rejected','hidden')),
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, product_id, order_id)
);
create index reviews_product_idx on public.reviews(product_id, status);

-- ---------------------------------------------------------------------
-- E-mail, consentimento e supressão
-- ---------------------------------------------------------------------
create table public.email_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  user_id uuid references auth.users(id) on delete set null,
  status text not null check (status in ('subscribed','unsubscribed')),
  interests text[] not null default '{}',
  consent_text text,
  consent_version text,
  consent_source text,
  consented_at timestamptz,
  unsubscribed_at timestamptz,
  unsubscribe_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);
create table public.email_suppression_list (
  email text primary key check (email = lower(email)),
  reason text not null,
  created_at timestamptz not null default now()
);
create table public.email_log (
  id bigint generated always as identity primary key,
  dedupe_key text not null unique,     -- evita e-mail duplicado (ex.: order:<id>:paid)
  to_email text not null,
  template text not null,
  kind text not null check (kind in ('transactional','marketing')),
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Analytics próprio e atribuição
-- ---------------------------------------------------------------------
create table public.marketing_touchpoints (
  id bigint generated always as identity primary key,
  visitor_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  touch text not null check (touch in ('first','last')),
  channel text not null,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  referrer_host text,
  landing_path text,
  created_at timestamptz not null default now()
);
create index marketing_touchpoints_visitor_idx on public.marketing_touchpoints(visitor_id, touch);
create index marketing_touchpoints_created_idx on public.marketing_touchpoints(created_at);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in (
    'page_view','view_item','search','add_to_cart','remove_from_cart','begin_checkout',
    'purchase','sign_up','newsletter_signup','whatsapp_click','instagram_click')),
  visitor_id text,
  session_id text,
  user_id uuid references auth.users(id) on delete set null,
  path text,
  product_id uuid references public.products(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  value_cents integer,
  channel text,
  utm_source text, utm_medium text, utm_campaign text,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_created_idx on public.analytics_events(created_at);
create index analytics_events_name_idx on public.analytics_events(event_name, created_at);
create index analytics_events_product_idx on public.analytics_events(product_id, event_name);

-- ---------------------------------------------------------------------
-- Atendimento, feriados, auditoria, páginas
-- ---------------------------------------------------------------------
create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  subject text not null check (char_length(subject) <= 200),
  message text not null check (char_length(message) <= 4000),
  status text not null default 'open' check (status in ('open','answered','closed')),
  created_at timestamptz not null default now()
);
create index support_requests_user_idx on public.support_requests(user_id);

create table public.holidays (
  day date primary key,
  name text not null,
  scope text not null default 'national' check (scope in ('national','state','municipal'))
);

create table public.content_pages (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  body_markdown text not null,
  reviewed_by_owner boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
