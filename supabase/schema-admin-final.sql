-- ============================================================
-- KOJOH: the last SQL you need to run.
-- After this, datasets, files, columns, tags, folders, prices, license packs
-- and the payments switch are all managed from the admin portal.
-- Safe to run more than once.
-- ============================================================

-- 1. Admins can load and manage license packs from the admin portal.
drop policy if exists "Admins manage dataset_licenses" on public.dataset_licenses;
create policy "Admins manage dataset_licenses"
  on public.dataset_licenses for all
  using (public.is_admin()) with check (public.is_admin());

-- 2. Free-form settings, so new options never need a schema change.
--    datasets.meta.overflow = 'clone' keeps a dataset selling after its packs run out.
alter table public.datasets add column if not exists meta jsonb not null default '{}'::jsonb;
alter table public.folders  add column if not exists meta jsonb not null default '{}'::jsonb;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "Anyone reads settings" on public.app_settings;
create policy "Anyone reads settings" on public.app_settings for select using (true);
drop policy if exists "Admins manage settings" on public.app_settings;
create policy "Admins manage settings" on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());
-- payments.mode: 'beta_free' (everything unlocks at ₹0) or 'live' (paid datasets go through Razorpay)
insert into public.app_settings (key, value) values ('payments', '{"mode": "beta_free"}'::jsonb)
  on conflict (key) do nothing;

-- 3. Razorpay payments log (written only by the payment functions).
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  amount_paise integer not null,
  currency text not null default 'INR',
  razorpay_order_id text unique,
  razorpay_payment_id text,
  status text not null default 'created',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table public.payments enable row level security;
drop policy if exists "Users read own payments" on public.payments;
create policy "Users read own payments" on public.payments for select using (auth.uid() = user_id);
drop policy if exists "Admins read payments" on public.payments;
create policy "Admins read payments" on public.payments for select using (public.is_admin());

-- 4. One place that hands out a license. Claims any free pack (standard or
--    premium), clones a pack when the dataset allows overflow, records the purchase.
create or replace function public.grant_license(p_user uuid, p_dataset uuid, p_price numeric, p_ref text)
returns public.dataset_licenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ds public.datasets;
  v_license public.dataset_licenses;
  v_src public.dataset_licenses;
  v_base int;
  v_clones int;
begin
  select * into v_ds from public.datasets where id = p_dataset;
  if not found then
    raise exception 'dataset not found';
  end if;

  select * into v_license from public.dataset_licenses
    where dataset_id = p_dataset and claimed_by = p_user limit 1;
  if found then
    return v_license;
  end if;

  select * into v_license from public.dataset_licenses
    where dataset_id = p_dataset and claimed_by is null
    order by created_at, license_code
    limit 1
    for update skip locked;

  if found then
    update public.dataset_licenses set claimed_by = p_user, claimed_at = now()
      where id = v_license.id returning * into v_license;
  elsif v_ds.is_free or coalesce(v_ds.meta->>'overflow', '') = 'clone' then
    select count(*) into v_base from public.dataset_licenses
      where dataset_id = p_dataset and license_code not like '%-C%';
    if v_base = 0 then
      raise exception 'no license packs loaded for this dataset yet';
    end if;
    select count(*) into v_clones from public.dataset_licenses
      where dataset_id = p_dataset and license_code like '%-C%';
    select * into v_src from public.dataset_licenses
      where dataset_id = p_dataset and license_code not like '%-C%'
      order by license_code offset (v_clones % v_base) limit 1;
    insert into public.dataset_licenses (dataset_id, license_code, tier, task_pack, claimed_by, claimed_at)
      values (p_dataset, v_src.license_code || '-C' || lpad((v_clones + 1)::text, 5, '0'),
              v_src.tier, v_src.task_pack, p_user, now())
      returning * into v_license;
  else
    raise exception 'sold out: every license for this dataset has been claimed';
  end if;

  insert into public.purchases (user_id, dataset_id, price_paid, payment_ref)
    values (p_user, p_dataset, p_price, p_ref)
    on conflict (user_id, dataset_id) do nothing;

  return v_license;
end;
$$;
revoke all on function public.grant_license(uuid, uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.grant_license(uuid, uuid, numeric, text) to service_role;

-- 5. What the Unlock button calls for free datasets (and for everything while
--    payments.mode is 'beta_free'). Paid datasets in live mode must go through Razorpay.
create or replace function public.purchase_dataset(p_dataset_id uuid, p_tier text default 'standard')
returns public.dataset_licenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ds public.datasets;
  v_mode text;
  v_license public.dataset_licenses;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  select * into v_ds from public.datasets where id = p_dataset_id;
  if not found then
    raise exception 'dataset not found';
  end if;

  select * into v_license from public.dataset_licenses
    where dataset_id = p_dataset_id and claimed_by = v_user limit 1;
  if found then
    return v_license;
  end if;

  select coalesce(value->>'mode', 'beta_free') into v_mode from public.app_settings where key = 'payments';
  if coalesce(v_mode, 'beta_free') = 'live' and not v_ds.is_free and coalesce(v_ds.price, 0) > 0 then
    raise exception 'payment required';
  end if;

  return public.grant_license(v_user, p_dataset_id, 0, 'beta-free-buynow');
end;
$$;
revoke all on function public.purchase_dataset(uuid, text) from public;
grant execute on function public.purchase_dataset(uuid, text) to authenticated;
