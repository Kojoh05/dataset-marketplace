-- ============================================================
-- KOJOH, public shelf stats for the notch ticker
-- Safe to run more than once.
--
-- dataset_licenses is private by design: a buyer may only read the
-- one row they claimed. The ticker needs two numbers that are not
-- private at all, how many licenses are left and when the dataset
-- was last bought, so this function returns those aggregates and
-- nothing that identifies a buyer.
-- ============================================================

create or replace function public.dataset_shelf()
returns table (
  dataset_id      uuid,
  licenses_total  int,
  licenses_left   int,
  last_claimed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    l.dataset_id,
    count(*)::int                                          as licenses_total,
    count(*) filter (where l.claimed_by is null)::int      as licenses_left,
    max(l.claimed_at)                                      as last_claimed_at
  from public.dataset_licenses l
  group by l.dataset_id;
$fn$;

revoke all on function public.dataset_shelf() from public;
grant execute on function public.dataset_shelf() to anon, authenticated;
