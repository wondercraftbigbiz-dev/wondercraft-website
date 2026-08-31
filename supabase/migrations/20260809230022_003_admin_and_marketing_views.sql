-- Read surfaces for the Supabase dashboard. security_invoker = true so these
-- inherit the same lockdown as the underlying tables (no anon access).

-- ---------------------------------------------------------------------------
-- The marketing list. Export this to CSV for the email tool.
-- ---------------------------------------------------------------------------
create or replace view public.marketing_contacts
with (security_invoker = true) as
select
  c.id as customer_id,
  c.email,
  c.full_name,
  c.phone,
  c.city,
  c.orders_count,
  c.first_order_at,
  c.last_order_at,
  c.lifetime_value_eur,
  c.marketing_consent_at as consented_at,
  c.marketing_consent_source as consent_source,
  c.unsubscribe_token,
  c.created_at
from public.customers c
where c.marketing_consent
  and c.marketing_unsubscribed_at is null
order by c.last_order_at desc nulls last, c.created_at desc;

comment on view public.marketing_contacts is
  'Customers who opted in to marketing and have not unsubscribed. This is the email-campaign list.';

-- ---------------------------------------------------------------------------
-- Everything needed to fulfil an order, on one screen.
-- ---------------------------------------------------------------------------
create or replace view public.orders_admin
with (security_invoker = true) as
select
  o.order_number,
  o.created_at,
  o.status,
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
  o.id as order_id,
  o.customer_id
from public.orders o
join public.customers c on c.id = o.customer_id
order by o.created_at desc;

comment on view public.orders_admin is
  'All orders, newest first, joined to the customer. Day-to-day fulfilment view.';

-- ---------------------------------------------------------------------------
-- Who buys the most, and who is marketable.
-- ---------------------------------------------------------------------------
create or replace view public.customer_stats
with (security_invoker = true) as
select
  c.id as customer_id,
  c.full_name,
  c.email,
  c.phone,
  c.city,
  c.orders_count,
  c.lifetime_value_eur,
  c.first_order_at,
  c.last_order_at,
  c.marketing_consent
    and c.marketing_unsubscribed_at is null as is_marketable,
  c.marketing_consent,
  c.marketing_unsubscribed_at,
  c.created_at
from public.customers c
order by c.orders_count desc, c.lifetime_value_eur desc;

comment on view public.customer_stats is
  'Every customer with order counts and lifetime value. Sorted by repeat-purchase volume.';

revoke all on public.marketing_contacts from anon, authenticated;
revoke all on public.orders_admin from anon, authenticated;
revoke all on public.customer_stats from anon, authenticated;
