-- Baseline schema for the wondercraft shop.
--
-- Dumped from project ppuxxxhflctkzahnvxje, which is the state migrations
-- 001-012 left behind. See README.md in this directory for why this is one file
-- rather than a numbered history.
--
-- Money is numeric in euro here, and integer eurocents everywhere in the
-- application (lib/money.ts). The conversion happens in exactly one place,
-- lib/order/repository.ts, and nowhere else.

begin;

-- --- Enums -------------------------------------------------------------------
-- text + CHECK was tempting, but these two are stable and an enum keeps the
-- admin views honest.
create type public.order_status as enum
  ('new', 'confirmed', 'shipped', 'delivered', 'cancelled');

create type public.payment_status as enum
  ('unpaid', 'pending', 'paid', 'failed', 'cancelled', 'refunded');

-- --- Customers ---------------------------------------------------------------
-- One row per person. Marketing-eligible contacts are marked via
-- marketing_consent, not stored separately.
create table public.customers (
  id                        uuid primary key default gen_random_uuid(),
  -- The customer's identity. place_order() upserts on this, so 'Ivan@X.BG' and
  -- 'ivan@x.bg' must not become two customers — hence the lower() check.
  email                     text not null unique
    check (email = lower(email) and email <> '' and position('@' in email) > 1),
  phone                     text not null,
  phone_normalized          text generated always as
    (regexp_replace(phone, '[^0-9+]', '', 'g')) stored,
  full_name                 text not null,
  city                      text,

  marketing_consent         boolean not null default false,
  marketing_consent_at      timestamptz,
  marketing_consent_source  text,
  marketing_unsubscribed_at timestamptz,
  unsubscribe_token         uuid not null default gen_random_uuid(),

  -- Trigger-maintained from public.orders. Do not update manually.
  orders_count              integer not null default 0,
  first_order_at            timestamptz,
  last_order_at             timestamptz,
  lifetime_value_eur        numeric not null default 0,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index customers_phone_normalized_idx on public.customers (phone_normalized);
create index customers_created_at_idx on public.customers (created_at desc);
create index customers_marketable_idx on public.customers (email)
  where marketing_consent and marketing_unsubscribed_at is null;

-- --- Orders ------------------------------------------------------------------
-- One row per order. Contact details and prices are snapshotted at order time,
-- so a later rename or price change does not rewrite history.
create table public.orders (
  id                         uuid primary key default gen_random_uuid(),
  -- The customer-facing reference, rendered "WC-<n>" by orderRefOf(). Generated
  -- here rather than in the app so there is one identifier, not two.
  order_number               bigint generated always as identity unique,
  customer_id                uuid not null references public.customers(id)
                               on delete restrict,

  product_id                 text not null,
  product_name               text not null,
  quantity                   integer not null default 1 check (quantity > 0),
  unit_price_eur             numeric not null check (unit_price_eur >= 0),
  unit_price_bgn             numeric not null check (unit_price_bgn >= 0),
  -- Econt delivery, quoted server-side at checkout. 0 when unavailable.
  shipping_eur               numeric not null default 0 check (shipping_eur >= 0),

  -- Product times quantity plus delivery. This is the amount charged, and what
  -- mark_order_paid() verifies a payment notification against.
  total_eur                  numeric generated always as
                               (unit_price_eur * quantity + shipping_eur) stored,
  -- Informational lev equivalent, converted ONCE from the euro total (see
  -- lib/money.ts). Never derived from unit_price_bgn, which would round twice.
  total_bgn                  numeric generated always as
                               (round((unit_price_eur * quantity + shipping_eur)
                                      * 1.95583, 2)) stored,

  print_name                 text,
  customization              text,
  message                    text,

  contact_name               text not null,
  contact_phone              text not null,
  -- Human-readable destination summary for the admin list. The structured truth
  -- is in the econt_* / street columns.
  contact_city               text,

  status                     public.order_status not null default 'new',
  admin_notes                text,

  -- --- Payment ---------------------------------------------------------------
  payment_status             public.payment_status not null default 'unpaid',
  payment_provider           text,
  -- Our reference at the payment provider. For Stripe this is the PaymentIntent
  -- id (pi_...). Idempotency key for payment notifications.
  provider_order_id          text,
  -- The provider's own transaction reference, echoed back on settlement.
  provider_txn_ref           text,
  -- Client-minted id for one payment attempt. The order row is written BEFORE
  -- Stripe is called, so it exists briefly with no intent id yet; this is what
  -- identifies it in that window and what makes a duplicate submit find the
  -- existing row instead of opening a second order.
  attempt_id                 text,
  paid_amount_eur            numeric,
  paid_currency              text,
  paid_at                    timestamptz,
  payment_raw                jsonb,
  -- True when a payment notification reported an amount/currency that did not
  -- match total_eur. Needs manual review.
  payment_mismatch           boolean not null default false,
  -- Total refunded so far. Equal to total_eur for a full refund, less for a
  -- partial one.
  refunded_eur               numeric not null default 0 check (refunded_eur >= 0),

  -- --- Destination -----------------------------------------------------------
  -- office = Econt office, aps = Econt automat (АПС), address = to the door.
  delivery_type              text
    check (delivery_type is null
           or delivery_type = any (array['office', 'aps', 'address'])),
  econt_city_id              integer,
  econt_city_name            text,
  econt_post_code            text,
  econt_office_code          text,
  econt_office_name          text,
  street                     text,
  street_num                 text,
  quarter                    text,
  floor                      text,
  apt                        text,
  delivery_note              text,
  -- True when Econt was unreachable at submit time, so the destination was
  -- accepted without being re-checked. These orders need a careful call.
  econt_unverified           boolean not null default false,

  -- Whether the customer ticked the marketing box on THIS order. The current
  -- state lives on customers; this is the per-order snapshot.
  marketing_consent_at_order boolean not null default false,
  source                     text not null default 'website',
  utm                        jsonb,
  user_agent                 text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index orders_customer_id_idx on public.orders (customer_id);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_payment_status_idx on public.orders (payment_status, created_at desc);
create index orders_econt_city_idx on public.orders (econt_city_id);

-- The webhook looks an order up by this and must never match two rows.
create unique index orders_provider_order_id_key on public.orders (provider_order_id)
  where provider_order_id is not null;
create unique index orders_attempt_id_key on public.orders (attempt_id)
  where attempt_id is not null;

-- --- Marketing consent -------------------------------------------------------
-- Append-only log of every opt-in/opt-out. GDPR evidence of when consent was
-- given, kept separately because the customers row only holds current state.
create table public.marketing_consent_events (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  consent      boolean not null,
  source       text,
  user_agent   text,
  occurred_at  timestamptz not null default now()
);

create index marketing_consent_events_customer_idx
  on public.marketing_consent_events (customer_id, occurred_at desc);

commit;

-- ============================================================================
-- Functions and triggers
-- ============================================================================

begin;

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path to '' as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- Keeps customers.orders_count / lifetime_value_eur in step with orders.
-- Counts an order once it is genuinely committed: paid, or moved along by an
-- operator. A pending card attempt is not yet a customer's lifetime value.
create or replace function public.refresh_customer_order_stats() returns trigger
language plpgsql set search_path to '' as $function$
declare
  v_customer_id uuid := coalesce(new.customer_id, old.customer_id);
begin
  update public.customers c
  set orders_count = s.cnt,
      first_order_at = s.first_at,
      last_order_at = s.last_at,
      lifetime_value_eur = s.value_eur,
      updated_at = now()
  from (
    select count(*) as cnt,
           min(o.created_at) as first_at,
           max(o.created_at) as last_at,
           coalesce(sum(o.total_eur), 0) as value_eur
    from public.orders o
    where o.customer_id = v_customer_id
      and o.status <> 'cancelled'
      and (
        o.payment_status = 'paid'
        or (o.payment_status = 'unpaid'
            and o.status in ('confirmed', 'shipped', 'delivered'))
      )
  ) s
  where c.id = v_customer_id;

  return null;
end;
$function$;

create trigger orders_refresh_customer_stats
  after insert or delete or update of customer_id, status, quantity, unit_price_eur
  on public.orders
  for each row execute function public.refresh_customer_order_stats();

-- Writes the append-only consent log. Fires on the state change rather than on
-- every update, so re-saving an unchanged customer does not add noise.
create or replace function public.log_marketing_consent() returns trigger
language plpgsql set search_path to '' as $function$
begin
  if tg_op = 'INSERT' then
    if new.marketing_consent then
      insert into public.marketing_consent_events (customer_id, consent, source)
      values (new.id, true, new.marketing_consent_source);
    end if;
    return null;
  end if;

  -- Opt-in (or re-opt-in after an unsubscribe).
  if new.marketing_consent and (
       not old.marketing_consent
       or (old.marketing_unsubscribed_at is not null
           and new.marketing_unsubscribed_at is null)
     ) then
    insert into public.marketing_consent_events (customer_id, consent, source)
    values (new.id, true, new.marketing_consent_source);

  -- Opt-out, however it is expressed.
  elsif (old.marketing_consent and not new.marketing_consent)
     or (old.marketing_unsubscribed_at is null
         and new.marketing_unsubscribed_at is not null) then
    insert into public.marketing_consent_events (customer_id, consent, source)
    values (new.id, false, new.marketing_consent_source);
  end if;

  return null;
end;
$function$;

create trigger customers_log_marketing_consent
  after insert or update of marketing_consent, marketing_unsubscribed_at
  on public.customers
  for each row execute function public.log_marketing_consent();

commit;

-- ============================================================================
-- place_order — the only way an order is created
-- ============================================================================
-- Upserts the customer and inserts the order atomically. Called by
-- lib/order/repository.ts with POSITIONAL arguments: changing this signature
-- without changing that file refuses every order.

begin;

create or replace function public.place_order(
  p_email text, p_full_name text, p_phone text, p_city text,
  p_product_id text, p_product_name text,
  p_unit_price_eur numeric, p_unit_price_bgn numeric,
  p_shipping_eur numeric default 0,
  p_quantity integer default 1,
  p_print_name text default null, p_customization text default null,
  p_message text default null,
  p_marketing_consent boolean default false,
  p_source text default 'website', p_utm jsonb default null,
  p_user_agent text default null,
  p_payment_provider text default null,
  p_provider_order_id text default null,
  p_attempt_id text default null,
  p_payment_status public.payment_status default 'unpaid',
  p_delivery_type text default null,
  p_econt_city_id integer default null, p_econt_city_name text default null,
  p_econt_post_code text default null, p_econt_office_code text default null,
  p_econt_office_name text default null,
  p_street text default null, p_street_num text default null,
  p_quarter text default null, p_floor text default null,
  p_apt text default null, p_delivery_note text default null,
  p_econt_unverified boolean default false
) returns table(order_id uuid, order_number bigint, customer_id uuid)
language plpgsql security definer set search_path to '' as $function$
declare
  v_email text := lower(trim(p_email));
  v_name text := nullif(trim(p_full_name), '');
  v_phone text := nullif(trim(p_phone), '');
  v_city text := nullif(trim(p_city), '');
  v_consent boolean := coalesce(p_marketing_consent, false);
  v_customer_id uuid;
begin
  if v_email is null or position('@' in v_email) < 2 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if v_name is null then
    raise exception 'missing_name' using errcode = '22023';
  end if;
  if v_phone is null then
    raise exception 'missing_phone' using errcode = '22023';
  end if;

  insert into public.customers as c (
    email, full_name, phone, city,
    marketing_consent, marketing_consent_at, marketing_consent_source
  )
  values (
    v_email, v_name, v_phone, v_city, v_consent,
    case when v_consent then now() end,
    case when v_consent then p_source end
  )
  on conflict (email) do update set
    full_name = excluded.full_name,
    phone     = excluded.phone,
    city      = coalesce(excluded.city, c.city),
    -- Consent is sticky: an order never silently revokes it, and never
    -- re-grants it either. Only an explicit opt-in flips it on.
    marketing_consent = c.marketing_consent or excluded.marketing_consent,
    marketing_consent_at = case
      when excluded.marketing_consent and not c.marketing_consent then now()
      else c.marketing_consent_at end,
    marketing_consent_source = case
      when excluded.marketing_consent and not c.marketing_consent
        then excluded.marketing_consent_source
      else c.marketing_consent_source end,
    marketing_unsubscribed_at = case
      when excluded.marketing_consent then null
      else c.marketing_unsubscribed_at end,
    updated_at = now()
  returning c.id into v_customer_id;

  return query
  insert into public.orders (
    customer_id, product_id, product_name, quantity,
    unit_price_eur, unit_price_bgn, shipping_eur,
    print_name, customization, message,
    contact_name, contact_phone, contact_city,
    marketing_consent_at_order, source, utm, user_agent,
    payment_provider, provider_order_id, attempt_id, payment_status,
    delivery_type, econt_city_id, econt_city_name, econt_post_code,
    econt_office_code, econt_office_name,
    street, street_num, quarter, floor, apt, delivery_note,
    econt_unverified
  )
  values (
    v_customer_id, p_product_id, p_product_name, coalesce(p_quantity, 1),
    p_unit_price_eur, p_unit_price_bgn, coalesce(p_shipping_eur, 0),
    nullif(trim(p_print_name), ''), nullif(trim(p_customization), ''),
    nullif(trim(p_message), ''),
    v_name, v_phone, v_city,
    v_consent, coalesce(p_source, 'website'), p_utm, p_user_agent,
    p_payment_provider, nullif(trim(p_provider_order_id), ''),
    nullif(trim(p_attempt_id), ''),
    coalesce(p_payment_status, 'unpaid'),
    p_delivery_type, p_econt_city_id,
    nullif(trim(p_econt_city_name), ''), nullif(trim(p_econt_post_code), ''),
    nullif(trim(p_econt_office_code), ''), nullif(trim(p_econt_office_name), ''),
    nullif(trim(p_street), ''), nullif(trim(p_street_num), ''),
    nullif(trim(p_quarter), ''), nullif(trim(p_floor), ''),
    nullif(trim(p_apt), ''), nullif(trim(p_delivery_note), ''),
    coalesce(p_econt_unverified, false)
  )
  returning public.orders.id, public.orders.order_number, public.orders.customer_id;
end;
$function$;

-- ============================================================================
-- mark_order_paid — the only way an order becomes paid
-- ============================================================================
-- Called from the Stripe webhook. Everything that makes settlement safe lives
-- here rather than in TypeScript: the row lock, the replay check, and the
-- amount verification.

create or replace function public.mark_order_paid(
  p_provider_order_id text, p_txn_ref text, p_amount numeric,
  p_currency text, p_raw jsonb default null
) returns table(result text, order_id uuid, order_number bigint)
language plpgsql security definer set search_path to '' as $function$
declare
  v_order public.orders;
begin
  -- Lock the row: concurrent retries must not both settle it.
  select * into v_order
  from public.orders o
  where o.provider_order_id = nullif(trim(p_provider_order_id), '')
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::bigint;
    return;
  end if;

  if v_order.payment_status = 'paid' then
    return query select 'already_paid'::text, v_order.id, v_order.order_number;
    return;
  end if;

  -- Re-verify against the price computed server-side at checkout. numeric
  -- equality ignores trailing zeros, so 30 = 30.00 as intended.
  if upper(coalesce(p_currency, '')) <> 'EUR'
     or p_amount is null
     or p_amount <> v_order.total_eur then
    update public.orders as o set
      payment_mismatch = true,
      payment_raw = coalesce(p_raw, o.payment_raw),
      provider_txn_ref = coalesce(p_txn_ref, o.provider_txn_ref),
      admin_notes = concat_ws(chr(10), o.admin_notes,
        format('Payment mismatch at %s: notified %s %s, expected %s EUR.',
               now(), p_amount, coalesce(p_currency, 'NULL'), v_order.total_eur))
    where o.id = v_order.id;
    return query select 'amount_mismatch'::text, v_order.id, v_order.order_number;
    return;
  end if;

  update public.orders as o set
    payment_status = 'paid',
    payment_provider = coalesce(o.payment_provider, 'stripe'),
    provider_txn_ref = p_txn_ref,
    paid_amount_eur = p_amount,
    paid_currency = upper(p_currency),
    paid_at = now(),
    payment_raw = coalesce(p_raw, o.payment_raw),
    -- Settled at the expected amount, so any earlier discrepancy is resolved.
    -- admin_notes keeps the history.
    payment_mismatch = false,
    -- Advance fulfilment, but never walk it backwards if an operator has
    -- already moved the order on.
    status = case when o.status = 'new' then 'confirmed'::public.order_status
                  else o.status end
  where o.id = v_order.id;

  return query select 'paid'::text, v_order.id, v_order.order_number;
end;
$function$;

commit;

-- ============================================================================
-- Views and row-level security
-- ============================================================================

begin;

-- The order list an operator works from.
create view public.orders_admin as
  select o.order_number, o.created_at, o.status,
         o.payment_status, o.payment_provider, o.paid_at, o.paid_amount_eur,
         o.payment_mismatch,
         o.contact_name, o.contact_phone, c.email, o.contact_city,
         o.delivery_type, o.econt_city_name, o.econt_post_code,
         o.econt_office_code, o.econt_office_name,
         o.street, o.street_num, o.quarter, o.floor, o.apt, o.delivery_note,
         o.econt_unverified,
         o.product_name, o.product_id, o.quantity,
         o.unit_price_eur, o.shipping_eur, o.total_eur, o.total_bgn,
         o.print_name, o.customization, o.message,
         o.marketing_consent_at_order,
         c.orders_count as customer_orders_count,
         case when c.orders_count > 1 then true else false end as is_repeat_customer,
         o.admin_notes, o.source, o.utm,
         o.provider_order_id, o.provider_txn_ref,
         o.id as order_id, o.customer_id
    from public.orders o
    join public.customers c on c.id = o.customer_id
   order by o.created_at desc;

-- Everyone who may currently be emailed. Consent AND no unsubscribe: an
-- unsubscribe wins over a historical opt-in.
create view public.marketing_contacts as
  select id as customer_id, email, full_name, phone, city,
         orders_count, first_order_at, last_order_at, lifetime_value_eur,
         marketing_consent_at as consented_at,
         marketing_consent_source as consent_source,
         unsubscribe_token, created_at
    from public.customers c
   where marketing_consent and marketing_unsubscribed_at is null
   order by last_order_at desc nulls last, created_at desc;

create view public.customer_stats as
  select id as customer_id, full_name, email, phone, city,
         orders_count, lifetime_value_eur, first_order_at, last_order_at,
         (marketing_consent and marketing_unsubscribed_at is null) as is_marketable,
         marketing_consent, marketing_unsubscribed_at, created_at
    from public.customers c
   order by orders_count desc, lifetime_value_eur desc;

-- --- Row-level security ------------------------------------------------------
-- Enabled with ZERO policies, which denies anon and authenticated entirely.
-- The service role bypasses RLS and is the only way in (lib/supabase/admin.ts).
-- Belt and braces, because the failure here is publishing every customer's
-- name, phone and address.
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.marketing_consent_events enable row level security;

revoke all on public.customers from anon, authenticated;
revoke all on public.orders from anon, authenticated;
revoke all on public.marketing_consent_events from anon, authenticated;

commit;
