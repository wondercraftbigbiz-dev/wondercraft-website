-- Failure counterpart to mark_order_paid.
--
-- mark_order_paid settles a successful payment. Nothing moved an order off
-- 'pending' when Stripe reported the opposite: a Checkout Session that expired
-- untouched, or a delayed payment method that came back declined. Those orders
-- sat as 'pending' forever and were indistinguishable from one still being paid.
--
-- Shaped deliberately like mark_order_paid: same lock, same 'not_found', and the
-- same refusal to touch an order that is already paid. Webhook delivery is
-- unordered, so a late 'expired' event for a session that was in fact paid must
-- never unsettle it.
--
-- orders.status (the fulfilment lifecycle) is left alone on purpose. A failed
-- payment is not automatically a cancelled order — someone may still ring the
-- customer. That call is a human's.
create or replace function public.mark_order_payment_failed(
  p_provider_order_id text,
  p_status public.payment_status,
  p_reason text default null,
  p_raw jsonb default null
)
returns table (result text, order_id uuid, order_number bigint)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order public.orders;
begin
  if p_status not in ('failed', 'cancelled') then
    raise exception 'mark_order_payment_failed: p_status must be failed or cancelled, got %', p_status;
  end if;

  -- Lock the row: a retry and a concurrent settle must not interleave.
  select * into v_order
  from public.orders o
  where o.provider_order_id = nullif(trim(p_provider_order_id), '')
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::bigint;
    return;
  end if;

  -- A paid order stays paid, whatever arrives afterwards.
  if v_order.payment_status = 'paid' then
    return query select 'already_paid'::text, v_order.id, v_order.order_number;
    return;
  end if;

  -- Idempotent: replaying the same event is a no-op that still reports success.
  if v_order.payment_status = p_status then
    return query select 'already_recorded'::text, v_order.id, v_order.order_number;
    return;
  end if;

  update public.orders as o set
    payment_status = p_status,
    payment_provider = coalesce(o.payment_provider, 'stripe'),
    payment_raw = coalesce(p_raw, o.payment_raw),
    admin_notes = concat_ws(chr(10), o.admin_notes,
      format('Payment %s at %s%s.', p_status, now(),
             case when p_reason is null or trim(p_reason) = ''
                  then '' else ': ' || p_reason end))
  where o.id = v_order.id;

  return query select p_status::text, v_order.id, v_order.order_number;
end;
$function$;

-- Same posture as migration 014: server-side service role only. A client
-- holding the anon key must not be able to fail someone else's order.
revoke execute on function public.mark_order_payment_failed(text, public.payment_status, text, jsonb)
  from anon, authenticated, public;
grant execute on function public.mark_order_payment_failed(text, public.payment_status, text, jsonb)
  to service_role;
