-- Wondercraft website: customers, orders and marketing consent audit.
-- One row per human in `customers`; consenting contacts are marked, not separated,
-- and surfaced through the `marketing_contacts` view (migration 003).

create type public.order_status as enum (
  'new', 'confirmed', 'shipped', 'delivered', 'cancelled'
);

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),

  -- Identity key. Always stored lower-cased and trimmed by place_order(), so a
  -- plain unique constraint is enough to dedupe "Ivan@X.com" and "ivan@x.com".
  email text not null unique
    check (email = lower(email) and email <> '' and position('@' in email) > 1),

  phone text not null,
  phone_normalized text generated always as (
    regexp_replace(phone, '[^0-9+]', '', 'g')
  ) stored,
  full_name text not null,
  city text,

  -- Marketing consent. `marketing_consent` is the mark; an explicit opt-out
  -- stamps `marketing_unsubscribed_at` rather than flipping the flag, so we keep
  -- the record that they once said yes.
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  marketing_consent_source text,
  marketing_unsubscribed_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid(),

  -- Maintained by trigger from `orders`; never write these by hand.
  orders_count integer not null default 0,
  first_order_at timestamptz,
  last_order_at timestamptz,
  lifetime_value_eur numeric(10, 2) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customers is
  'One row per person. Marketing-eligible contacts are marked via marketing_consent, not stored separately.';
comment on column public.customers.orders_count is
  'Trigger-maintained from public.orders. Do not update manually.';

create index customers_phone_normalized_idx on public.customers (phone_normalized);
create index customers_created_at_idx on public.customers (created_at desc);
create index customers_marketable_idx on public.customers (email)
  where marketing_consent and marketing_unsubscribed_at is null;

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Human-friendly reference to quote on the phone. Starts at 1000 so the first
  -- order does not read as "#1".
  order_number bigint generated always as identity (start with 1000) unique,

  customer_id uuid not null references public.customers (id) on delete restrict,

  -- Product ids mirror lib/data/pricing.ts ('standard' | 'custom'), which stays
  -- the single source of truth for the catalogue. Name and prices are snapshotted
  -- here so historical orders survive any future price change.
  product_id text not null,
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_eur numeric(10, 2) not null check (unit_price_eur >= 0),
  unit_price_bgn numeric(10, 2) not null check (unit_price_bgn >= 0),
  total_eur numeric(10, 2) generated always as (unit_price_eur * quantity) stored,
  total_bgn numeric(10, 2) generated always as (unit_price_bgn * quantity) stored,

  print_name text,
  customization text,
  message text,

  -- Contact details as given at order time. Kept separate from customers.* so
  -- that updating a customer never rewrites the address an order shipped to.
  contact_name text not null,
  contact_phone text not null,
  contact_city text,

  status public.order_status not null default 'new',
  admin_notes text,

  marketing_consent_at_order boolean not null default false,

  source text not null default 'website',
  utm jsonb,
  user_agent text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.orders is
  'One row per order. Contact details and prices are snapshotted at order time.';

create index orders_customer_id_idx on public.orders (customer_id);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status);

-- ---------------------------------------------------------------------------
-- marketing_consent_events (append-only audit trail)
-- ---------------------------------------------------------------------------
create table public.marketing_consent_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  consent boolean not null,
  source text,
  user_agent text,
  occurred_at timestamptz not null default now()
);

comment on table public.marketing_consent_events is
  'Append-only log of every marketing opt-in/opt-out. GDPR evidence of when consent was given.';

create index marketing_consent_events_customer_idx
  on public.marketing_consent_events (customer_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Row level security: enabled with NO policies, so the browser-side publishable
-- key can neither read nor write customer data. All access goes through the
-- server using the service role key, which bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.marketing_consent_events enable row level security;

revoke all on public.customers from anon, authenticated;
revoke all on public.orders from anon, authenticated;
revoke all on public.marketing_consent_events from anon, authenticated;
