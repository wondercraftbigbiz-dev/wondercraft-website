-- place_order and mark_order_paid move money and settle payments; only trusted
-- server code (using the service role) should ever call them. Revoke the
-- broad EXECUTE grants left over from earlier scaffolding so a client holding
-- only the public anon key cannot call mark_order_paid directly with a
-- guessed/leaked provider_order_id.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('place_order', 'mark_order_paid')
  loop
    execute format('revoke execute on function %s from anon, authenticated, public', r.sig);
  end loop;
end
$$;
