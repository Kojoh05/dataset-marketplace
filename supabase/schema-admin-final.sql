-- ============================================================
-- KOJOH: the last SQL you need to run.
-- After this, everything (datasets, files, columns, tags, folders, prices and
-- license packs) is managed from the admin portal. Safe to run more than once.
-- ============================================================

-- 1. Admins can load and manage license packs from the admin portal.
drop policy if exists "Admins manage dataset_licenses" on public.dataset_licenses;
create policy "Admins manage dataset_licenses"
  on public.dataset_licenses for all
  using (public.is_admin()) with check (public.is_admin());

-- 2. A free-form settings column, so new options never need a schema change.
--    datasets.meta.overflow = 'clone' lets a dataset keep selling after its packs
--    run out (buyer 101+ gets a copy of an existing pack). Free datasets always do.
alter table public.datasets add column if not exists meta jsonb not null default '{}'::jsonb;
alter table public.folders  add column if not exists meta jsonb not null default '{}'::jsonb;

-- 3. Purchase: claims any free pack (standard or premium, so premium packs can
--    finally sell), and clones a pack when a dataset allows overflow.
create or replace function public.purchase_dataset(p_dataset_id uuid, p_tier text default 'standard')
returns public.dataset_licenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ds public.datasets;
  v_license public.dataset_licenses;
  v_src public.dataset_licenses;
  v_base int;
  v_clones int;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select * into v_ds from public.datasets where id = p_dataset_id;
  if not found then
    raise exception 'dataset not found';
  end if;

  -- Already own it: return the same license (safe to click twice).
  select * into v_license from public.dataset_licenses
    where dataset_id = p_dataset_id and claimed_by = v_user limit 1;
  if found then
    return v_license;
  end if;

  -- Claim the next unclaimed pack, any tier.
  select * into v_license from public.dataset_licenses
    where dataset_id = p_dataset_id and claimed_by is null
    order by created_at, license_code
    limit 1
    for update skip locked;

  if found then
    update public.dataset_licenses set claimed_by = v_user, claimed_at = now()
      where id = v_license.id returning * into v_license;
  elsif v_ds.is_free or coalesce(v_ds.meta->>'overflow', '') = 'clone' then
    -- Out of packs: copy one of the original packs, rotating through them.
    select count(*) into v_base from public.dataset_licenses
      where dataset_id = p_dataset_id and license_code not like '%-C%';
    if v_base = 0 then
      raise exception 'no license packs loaded for this dataset yet';
    end if;
    select count(*) into v_clones from public.dataset_licenses
      where dataset_id = p_dataset_id and license_code like '%-C%';
    select * into v_src from public.dataset_licenses
      where dataset_id = p_dataset_id and license_code not like '%-C%'
      order by license_code offset (v_clones % v_base) limit 1;
    insert into public.dataset_licenses (dataset_id, license_code, tier, task_pack, claimed_by, claimed_at)
      values (p_dataset_id, v_src.license_code || '-C' || lpad((v_clones + 1)::text, 5, '0'),
              v_src.tier, v_src.task_pack, v_user, now())
      returning * into v_license;
  else
    raise exception 'sold out: every license for this dataset has been claimed';
  end if;

  insert into public.purchases (user_id, dataset_id, price_paid, payment_ref)
    values (v_user, p_dataset_id, 0, 'beta-free-buynow')
    on conflict (user_id, dataset_id) do nothing;

  return v_license;
end;
$$;

revoke all on function public.purchase_dataset(uuid, text) from public;
grant execute on function public.purchase_dataset(uuid, text) to authenticated;
