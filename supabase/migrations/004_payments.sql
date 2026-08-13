-- 004_payments
--
-- Adds card-payment state to orders for the myPOS Checkout integration.
--
-- Design notes:
--   * The browser is never trusted with an amount. `place_order` records the
--     price we computed server-side, and `mark_order_paid` re-verifies the
--     amount myPOS reports against that stored total before settling.
--   * `mypos_order_id` is the idempotency key. myPOS retries its notification
--     until it receives "OK", so settling must be safe to run repeatedly.
--   * A browser landing on URL_OK is NOT proof of payment. Only the verified
--     server-to-server notification calls mark_order_paid.

create type public.payment_status as enum (
  'unpaid',    -- no payment attempted (the "contact me" enquiry path)
  'pending',   -- redirected to myPOS, outcome not yet known
  'paid',
  'failed',
  'cancelled',
  'refunded'
);

alter table public.orders
  add column payment_status public.payment_status not null default 'unpaid',
  add column payment_provider text,
  add column mypos_order_id text,
  add column mypos_trnref text,
  add column paid_amount_eur numeric,
  add column paid_currency text,
  add column paid_at timestamptz,
  add column payment_raw jsonb,
  add column payment_mismatch boolean not null default false;

comment on column public.orders.mypos_order_id is
  'Reference sent to myPOS as OrderID. Idempotency key for payment notifications.';
comment on column public.orders.payment_mismatch is
  'True when a payment notification reported an amount/currency that did not match total_eur. Needs manual review.';

-- Partial unique index: enquiry orders have no myPOS reference, and Postgres
-- would allow duplicate NULLs under a plain unique constraint anyway.
create unique index orders_mypos_order_id_key
  on public.orders (mypos_order_id)
  where mypos_order_id is not null;

create index orders_payment_status_idx
  on public.orders (payment_status, created_at desc);

-- ---------------------------------------------------------------------------
-- place_order: same behaviour as before, plus the payment columns.
--
-- This must be DROP + CREATE rather than CREATE OR REPLACE: changing the
-- argument list would register an overload instead of replacing the function,
-- leaving two place_order variants and making named-argument calls ambiguous.
-- ---------------------------------------------------------------------------
drop function if exists public.place_order(
  text, text, text, text, text, text, numeric, numeric, integer,
  text, text, text, boolean, text, jsonb, text
);

create function public.place_order(
  p_email text,
  p_full_name text,
  p_phone text,
  p_city text,
  p_product_id text,
  p_product_name text,
  p_unit_price_eur numeric,
  p_unit_price_bgn numeric,
  p_quantity integer default 1,
  p_print_name text default null,
  p_customization text default null,
  p_message text default null,
  p_marketing_consent boolean default false,
  p_source text default 'website',
  p_utm jsonb default null,
  p_user_agent text default null,
  p_payment_provider text default null,
  p_mypos_order_id text default null,
  p_payment_status public.payment_status default 'unpaid'
)
returns table(order_id uuid, order_number bigint, customer_id uuid)
language plpgsql
security definer
set search_path to ''
as $function$
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
    v_email, v_name, v_phone, v_city,
    v_consent,
    case when v_consent then now() end,
    case when v_consent then p_source end
  )
  on conflict (email) do update set
    full_name = excluded.full_name,
    phone     = excluded.phone,
    city      = coalesce(excluded.city, c.city),

    marketing_consent = c.marketing_consent or excluded.marketing_consent,
    marketing_consent_at = case
      when excluded.marketing_consent and not c.marketing_consent then now()
      else c.marketing_consent_at
    end,
    marketing_consent_source = case
      when excluded.marketing_consent and not c.marketing_consent
        then excluded.marketing_consent_source
      else c.marketing_consent_source
    end,
    -- A fresh opt-in revives a previously unsubscribed contact.
    marketing_unsubscribed_at = case
      when excluded.marketing_consent then null
      else c.marketing_unsubscribed_at
    end,
    updated_at = now()
  returning c.id into v_customer_id;

  return query
  insert into public.orders (
    customer_id, product_id, product_name, quantity,
    unit_price_eur, unit_price_bgn,
    print_name, customization, message,
    contact_name, contact_phone, contact_city,
    marketing_consent_at_order, source, utm, user_agent,
    payment_provider, mypos_order_id, payment_status
  )
  values (
    v_customer_id, p_product_id, p_product_name, coalesce(p_quantity, 1),
    p_unit_price_eur, p_unit_price_bgn,
    nullif(trim(p_print_name), ''),
    nullif(trim(p_customization), ''),
    nullif(trim(p_message), ''),
    v_name, v_phone, v_city,
    v_consent, coalesce(p_source, 'website'), p_utm, p_user_agent,
    p_payment_provider, nullif(trim(p_mypos_order_id), ''),
    coalesce(p_payment_status, 'unpaid')
  )
  returning public.orders.id, public.orders.order_number, public.orders.customer_id;
end;
$function$;

-- plpgsql functions are granted EXECUTE to PUBLIC by default. Payment-bearing
-- functions must only ever be reachable from server-side code.
revoke all on function public.place_order(
  text, text, text, text, text, text, numeric, numeric, integer,
  text, text, text, boolean, text, jsonb, text,
  text, text, public.payment_status
) from public, anon, authenticated;

grant execute on function public.place_order(
  text, text, text, text, text, text, numeric, numeric, integer,
  text, text, text, boolean, text, jsonb, text,
  text, text, public.payment_status
) to service_role;

-- ---------------------------------------------------------------------------
-- mark_order_paid: called only by the verified myPOS notification webhook.
--
-- Returns a single text `result` the caller switches on:
--   not_found       -- no order carries this myPOS reference
--   already_paid    -- idempotent no-op; myPOS is retrying
--   amount_mismatch -- flagged for manual review, NOT settled
--   paid            -- settled
-- ---------------------------------------------------------------------------
create function public.mark_order_paid(
  p_mypos_order_id text,
  p_trnref text,
  p_amount numeric,
  p_currency text,
  p_raw jsonb default null
)
returns table(result text, order_id uuid, order_number bigint)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order public.orders;
begin
  -- Lock the row: concurrent retries must not both settle it.
  select * into v_order
  from public.orders o
  where o.mypos_order_id = nullif(trim(p_mypos_order_id), '')
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::bigint;
    return;
  end if;

  if v_order.payment_status = 'paid' then
    return query select 'already_paid'::text, v_order.id, v_order.order_number;
    return;
  end if;

  -- Re-verify against the price we computed server-side at checkout. numeric
  -- equality ignores trailing zeros, so 30 = 30.00 as intended.
  if upper(coalesce(p_currency, '')) <> 'EUR'
     or p_amount is null
     or p_amount <> v_order.total_eur then
    update public.orders as o set
      payment_mismatch = true,
      payment_raw = coalesce(p_raw, o.payment_raw),
      mypos_trnref = coalesce(p_trnref, o.mypos_trnref),
      admin_notes = concat_ws(
        chr(10),
        o.admin_notes,
        format(
          'Payment mismatch at %s: notified %s %s, expected %s EUR.',
          now(), p_amount, coalesce(p_currency, 'NULL'), v_order.total_eur
        )
      )
    where o.id = v_order.id;

    return query select 'amount_mismatch'::text, v_order.id, v_order.order_number;
    return;
  end if;

  update public.orders as o set
    payment_status = 'paid',
    payment_provider = coalesce(o.payment_provider, 'mypos'),
    mypos_trnref = p_trnref,
    paid_amount_eur = p_amount,
    paid_currency = upper(p_currency),
    paid_at = now(),
    payment_raw = coalesce(p_raw, o.payment_raw),
    -- Advance the fulfilment status, but never walk it backwards if an
    -- operator has already moved the order on.
    status = case
      when o.status = 'new' then 'confirmed'::public.order_status
      else o.status
    end
  where o.id = v_order.id;

  return query select 'paid'::text, v_order.id, v_order.order_number;
end;
$function$;

revoke all on function public.mark_order_paid(text, text, numeric, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.mark_order_paid(text, text, numeric, text, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- refresh_customer_order_stats: only count orders that really happened.
--
-- Before payments existed, "not cancelled" was a fine proxy for "real". Now
-- that a customer can be redirected to myPOS and simply close the tab, an
-- order can sit at payment_status='pending' forever — counting those would
-- inflate orders_count and lifetime_value_eur with abandoned checkouts.
--
-- An order counts when it is either paid, or an enquiry order ('unpaid', the
-- phone/contact path) that an operator has manually moved past 'new'.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_customer_order_stats()
returns trigger
language plpgsql
set search_path to ''
as $function$
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
        or (
          o.payment_status = 'unpaid'
          and o.status in ('confirmed', 'shipped', 'delivered')
        )
      )
  ) s
  where c.id = v_customer_id;

  return null;
end;
$function$;

-- ---------------------------------------------------------------------------
-- orders_admin: same columns as before, plus payment state.
--
-- DROP + CREATE, not CREATE OR REPLACE: replacing a view may only append
-- columns, and the payment columns belong next to `status` to be readable.
-- ---------------------------------------------------------------------------
drop view if exists public.orders_admin;

create view public.orders_admin as
select
  o.order_number,
  o.created_at,
  o.status,
  o.payment_status,
  o.payment_provider,
  o.paid_at,
  o.paid_amount_eur,
  o.payment_mismatch,
  o.contact_name,
  o.contact_phone,
  c.email,
  o.contact_city,
  o.product_name,
  o.product_id,
  o.quantity,
  o.total_eur,
  o.total_bgn,
  o.print_name,
  o.customization,
  o.message,
  o.marketing_consent_at_order,
  c.orders_count as customer_orders_count,
  case when c.orders_count > 1 then true else false end as is_repeat_customer,
  o.admin_notes,
  o.source,
  o.utm,
  o.mypos_order_id,
  o.mypos_trnref,
  o.id as order_id,
  o.customer_id
from public.orders o
join public.customers c on c.id = o.customer_id
order by o.created_at desc;
