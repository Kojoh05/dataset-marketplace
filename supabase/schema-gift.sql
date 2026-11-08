-- KOJOH: gift a project from the admin (founding reviewers, contest prizes, support fixes).
-- Run once in the Supabase SQL editor after schema-admin-final.sql and schema-reviews.sql. Safe to run again.

-- 1. Admin-only: give a registered user a project at no charge (claims a licence pack, records a Rs 0 purchase).
create or replace function public.admin_gift_project(p_user uuid, p_dataset uuid)
returns public.dataset_licenses
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'no such user'; end if;
  return public.grant_license(p_user, p_dataset, 0, 'gift:' || auth.uid()::text);
end;
$$;
revoke all on function public.admin_gift_project(uuid, uuid) from public, anon;
grant execute on function public.admin_gift_project(uuid, uuid) to authenticated;

-- 2. Admin-only: the latest gifts, for the admin page.
create or replace function public.admin_recent_gifts(p_limit int default 50)
returns table (purchased_at timestamptz, user_id uuid, user_name text, user_email text, dataset_title text, reviewed boolean)
language sql stable security definer set search_path = public as $$
  select p.purchased_at, p.user_id,
         coalesce(nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), ''), pr.username),
         pr.email, d.title,
         exists (select 1 from public.reviews r where r.user_id = p.user_id and r.dataset_id = p.dataset_id)
  from public.purchases p
  join public.datasets d on d.id = p.dataset_id
  left join public.profiles pr on pr.id = p.user_id
  where p.payment_ref like 'gift:%' and public.is_admin()
  order by p.purchased_at desc limit p_limit;
$$;
revoke all on function public.admin_recent_gifts(int) from public, anon;
grant execute on function public.admin_recent_gifts(int) to authenticated;

-- 3. Reviews from people who got the project free say so on the page.
alter table public.reviews add column if not exists gifted boolean not null default false;
create or replace function public.kojoh_review_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare pr record; admin boolean := public.is_admin();
begin
  select first_name, last_name, username into pr from public.profiles where id = new.user_id;
  new.reviewer_name := coalesce(nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(left(pr.last_name, 1) || '.', '')), ''), pr.username, 'KOJOH learner');
  new.verified_owner := public.kojoh_owns_dataset(new.user_id, new.dataset_id);
  new.gifted := exists (select 1 from public.purchases where user_id = new.user_id and dataset_id = new.dataset_id and payment_ref like 'gift:%');
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.added_by_admin := admin and new.user_id <> auth.uid();
  end if;
  if not admin then
    if tg_op = 'INSERT' then
      new.status := 'visible'; new.featured := false; new.admin_reply := null;
    else
      new.status := old.status; new.featured := old.featured; new.admin_reply := old.admin_reply; new.added_by_admin := old.added_by_admin;
      new.user_id := old.user_id; new.dataset_id := old.dataset_id; new.created_at := old.created_at;
    end if;
  end if;
  return new;
end;
$$;
