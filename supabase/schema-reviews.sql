-- KOJOH: project reviews. Run once in the Supabase SQL editor (safe to run again).
-- Rules enforced here, not just in the app:
--   * one review per account per project
--   * only people who own the project (a claimed license or a purchase) can review it
--   * the name shown is always taken from the reviewer's profile, never typed in
--   * admins can hide, feature, reply, and add a review for a registered user (marked added_by_admin)

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 20 and 1200),
  reviewer_name text not null default '',
  verified_owner boolean not null default false,
  added_by_admin boolean not null default false,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  featured boolean not null default false,
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dataset_id, user_id)
);
create index if not exists reviews_dataset_idx on public.reviews (dataset_id, status);

create or replace function public.kojoh_owns_dataset(p_user uuid, p_dataset uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dataset_licenses where claimed_by = p_user and dataset_id = p_dataset)
      or exists (select 1 from public.purchases where user_id = p_user and dataset_id = p_dataset);
$$;

-- Name and ownership are always set by the database. Plain users cannot touch the moderation columns.
create or replace function public.kojoh_review_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare pr record; admin boolean := public.is_admin();
begin
  select first_name, last_name, username into pr from public.profiles where id = new.user_id;
  new.reviewer_name := coalesce(nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(left(pr.last_name, 1) || '.', '')), ''), pr.username, 'KOJOH learner');
  new.verified_owner := public.kojoh_owns_dataset(new.user_id, new.dataset_id);
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
drop trigger if exists kojoh_review_guard on public.reviews;
create trigger kojoh_review_guard before insert or update on public.reviews
  for each row execute function public.kojoh_review_guard();

alter table public.reviews enable row level security;
drop policy if exists "Anyone reads visible reviews" on public.reviews;
create policy "Anyone reads visible reviews" on public.reviews for select using (status = 'visible' or auth.uid() = user_id or public.is_admin());
drop policy if exists "Owners write one review" on public.reviews;
create policy "Owners write one review" on public.reviews for insert
  with check (auth.uid() = user_id and public.kojoh_owns_dataset(auth.uid(), dataset_id));
drop policy if exists "Reviewers edit their review" on public.reviews;
create policy "Reviewers edit their review" on public.reviews for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Reviewers delete their review" on public.reviews;
create policy "Reviewers delete their review" on public.reviews for delete using (auth.uid() = user_id);
drop policy if exists "Admins manage reviews" on public.reviews;
create policy "Admins manage reviews" on public.reviews for all using (public.is_admin())
  with check (public.is_admin() and exists (select 1 from public.profiles p where p.id = user_id));

-- Average and count per project (visible reviews only), readable by everyone.
create or replace view public.dataset_review_stats as
  select dataset_id, round(avg(rating)::numeric, 1) as avg_rating, count(*)::int as review_count,
         count(*) filter (where rating = 5)::int as r5, count(*) filter (where rating = 4)::int as r4,
         count(*) filter (where rating = 3)::int as r3, count(*) filter (where rating = 2)::int as r2,
         count(*) filter (where rating = 1)::int as r1
  from public.reviews where status = 'visible' group by dataset_id;
grant select on public.dataset_review_stats to anon, authenticated;
