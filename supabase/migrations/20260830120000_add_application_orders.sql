create table if not exists public.application_orders (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null unique,
  plan_id text not null,
  customer_name text not null,
  email text not null,
  phone text not null,
  delivery jsonb not null,
  customization jsonb,
  product_amount integer not null check (product_amount > 0),
  shipping_amount integer check (shipping_amount >= 0),
  total_amount integer not null check (total_amount > 0),
  currency text not null default 'eur',
  status text not null default 'pending_payment',
  payment_status text not null default 'unpaid',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  last_stripe_event_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.application_orders enable row level security;

revoke all on public.application_orders from anon, authenticated;
grant all on public.application_orders to service_role;

create index if not exists application_orders_status_idx on public.application_orders (status);
create index if not exists application_orders_created_at_idx on public.application_orders (created_at desc);

create or replace function public.set_application_orders_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists application_orders_updated_at on public.application_orders;
create trigger application_orders_updated_at
before update on public.application_orders
for each row execute function public.set_application_orders_updated_at();
