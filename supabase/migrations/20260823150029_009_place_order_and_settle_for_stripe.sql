begin;

-- Rebuilt with the renamed reference columns and the new shipping line.
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

-- Old signatures dropped explicitly: the parameter lists change, and leaving
-- the originals in place would make the overloads ambiguous to PostgREST.
drop function if exists public.place_order(
  text,text,text,text,text,text,numeric,numeric,integer,text,text,text,boolean,
  text,jsonb,text,text,text,public.payment_status,text,integer,text,text,text,
  text,text,text,text,text,text,text,boolean);

drop function if exists public.mark_order_paid(text,text,numeric,text,jsonb);

-- place_order: adds p_shipping_eur, renames p_mypos_order_id.
-- Body is otherwise the original, unchanged.
create function public.place_order(
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
    payment_provider, provider_order_id, payment_status,
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

-- mark_order_paid: identical logic, provider-neutral lookup. The amount check
-- now compares against total_eur, which includes shipping_eur.
create function public.mark_order_paid(
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
    payment_mismatch = false,
    status = case when o.status = 'new' then 'confirmed'::public.order_status
                  else o.status end
  where o.id = v_order.id;

  return query select 'paid'::text, v_order.id, v_order.order_number;
end;
$function$;

commit;