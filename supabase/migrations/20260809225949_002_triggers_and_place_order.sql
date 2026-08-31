-- Triggers that keep customer rollups + the consent audit trail correct, and
-- place_order(): the single transactional entry point used by the website.

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Customer order rollups.
-- Recomputed from public.orders rather than incremented, so the counters stay
-- correct even if an order is later deleted or reassigned.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_customer_order_stats()
returns trigger
language plpgsql
set search_path = ''
as $$
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
           coalesce(sum(o.total_eur) filter (where o.status <> 'cancelled'), 0) as value_eur
    from public.orders o
    where o.customer_id = v_customer_id
  ) s
  where c.id = v_customer_id;

  return null;
end;
$$;

-- Fires on status changes too, so cancelled orders drop out of lifetime value.
create trigger orders_refresh_customer_stats
  after insert or delete or update of customer_id, status, quantity, unit_price_eur
  on public.orders
  for each row execute function public.refresh_customer_order_stats();

-- ---------------------------------------------------------------------------
-- Marketing consent audit trail.
-- ---------------------------------------------------------------------------
create or replace function public.log_marketing_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
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
$$;

create trigger customers_log_marketing_consent
  after insert or update of marketing_consent, marketing_unsubscribed_at
  on public.customers
  for each row execute function public.log_marketing_consent();

-- ---------------------------------------------------------------------------
-- place_order(): upsert the customer and insert the order in one transaction.
--
-- Consent rule: passing p_marketing_consent = true opts the customer in and
-- clears any previous unsubscribe. Passing false leaves an existing opt-in
-- alone -- someone who consented once and then left the box unticked on a later
-- order is NOT silently unsubscribed. Opting out is an explicit action
-- (set marketing_unsubscribed_at), never an omission.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
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
  p_user_agent text default null
)
returns table (order_id uuid, order_number bigint, customer_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
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
    marketing_consent_at_order, source, utm, user_agent
  )
  values (
    v_customer_id, p_product_id, p_product_name, coalesce(p_quantity, 1),
    p_unit_price_eur, p_unit_price_bgn,
    nullif(trim(p_print_name), ''),
    nullif(trim(p_customization), ''),
    nullif(trim(p_message), ''),
    v_name, v_phone, v_city,
    v_consent, coalesce(p_source, 'website'), p_utm, p_user_agent
  )
  returning public.orders.id, public.orders.order_number, public.orders.customer_id;
end;
$$;

comment on function public.place_order is
  'Transactional order entry: upserts the customer by email and inserts the order. Called server-side only.';

-- Server-side only. The browser never touches this.
revoke all on function public.place_order from public, anon, authenticated;
grant execute on function public.place_order to service_role;
