-- A stable handle for one payment attempt, independent of the provider.
--
-- The order row is written BEFORE Stripe is called, so that a Stripe failure
-- leaves an unpaid orphan row rather than a charge with no record. That means
-- the row exists for a moment with no PaymentIntent id yet. attempt_id is what
-- identifies it in that window, and what makes a duplicate submit find the
-- existing row instead of inserting a second one.
--
-- Kept separate from provider_order_id rather than reusing it: once the intent
-- id is attached, provider_order_id is the webhook's lookup key, and overloading
-- one column with two meanings across a row's lifetime is how a settlement ends
-- up matching the wrong order.

alter table public.orders
  add column if not exists attempt_id text;

comment on column public.orders.attempt_id is
  'Client-minted id for one payment attempt. Idempotency key for intent creation.';

create unique index if not exists orders_attempt_id_key
  on public.orders (attempt_id)
  where attempt_id is not null;

-- place_order gains the parameter. Body is otherwise unchanged from 009.
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