-- 005_clear_mismatch_on_settle
--
-- Fixes a flaw in 004: mark_order_paid set payment_mismatch = true on a bad
-- notification but never cleared it, so an order that later settled at the
-- correct amount stayed flagged forever and would keep showing up in an
-- operator's "needs review" list.
--
-- payment_mismatch now means "there is an UNRESOLVED discrepancy". A correct
-- settlement resolves it; the admin_notes entries remain as the audit trail.

create or replace function public.mark_order_paid(
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
    -- The order settled at the expected amount, so any earlier discrepancy is
    -- resolved. admin_notes keeps the history.
    payment_mismatch = false,
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
