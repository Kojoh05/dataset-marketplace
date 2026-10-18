-- KOJOH: let admins load and manage license packs from the admin portal.
-- Run once in the Supabase SQL editor. Buyers still only see the license they claimed.
drop policy if exists "Admins manage dataset_licenses" on public.dataset_licenses;
create policy "Admins manage dataset_licenses"
  on public.dataset_licenses for all
  using (public.is_admin()) with check (public.is_admin());
