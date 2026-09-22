-- ============================================================
-- KOJOH, challenge submissions + points + global leaderboard
-- Safe to run more than once. Run this whole file in one go,
-- in the same Supabase project the rest of the site uses.
--
-- What it does:
--   1. challenge_submissions table, one row per license, frozen
--      once inserted (no user update/delete policy at all)
--   2. RLS: a buyer can insert/read only their own row, and only
--      once every task is ticked and both links look real
--   3. Admins (public.is_admin(), already defined in the admin
--      portal's admin-schema.sql) can read and score every row
--   4. public.leaderboard(), a public read of total points per
--      user across every reviewed submission
-- ============================================================


-- ------------------------------------------------------------
-- 1. Table
-- ------------------------------------------------------------
create table if not exists public.challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null unique references public.dataset_licenses(id) on delete cascade,
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  license_code text not null,
  tasks_total int not null default 0,
  tasks_done int not null default 0,
  tasks_snapshot jsonb not null default '{}'::jsonb,
  github_url text not null,
  linkedin_url text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewed')),
  points int check (points is null or points >= 0),
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now()
);

create index if not exists challenge_submissions_user_idx on public.challenge_submissions (user_id);
create index if not exists challenge_submissions_status_idx on public.challenge_submissions (status, submitted_at desc);

alter table public.challenge_submissions enable row level security;


-- ------------------------------------------------------------
-- 2. A buyer submits once, for a license that is actually theirs,
--    only when every task is done and both links look real.
--    There is deliberately no update/delete policy for a plain
--    user, so a submitted row can never be edited from the app,
--    which is the freeze.
-- ------------------------------------------------------------
drop policy if exists "Users insert own submission" on public.challenge_submissions;
create policy "Users insert own submission"
  on public.challenge_submissions for insert
  with check (
    user_id = auth.uid()
    and tasks_total > 0
    and tasks_done = tasks_total
    and github_url ~* '^https://(www\.)?github\.com/'
    and linkedin_url ~* '^https://([a-z]{2,3}\.)?linkedin\.com/'
    and exists (
      select 1 from public.dataset_licenses dl
      where dl.id = challenge_submissions.license_id
        and dl.dataset_id = challenge_submissions.dataset_id
        and dl.claimed_by = auth.uid()
    )
  );

drop policy if exists "Users read own submission" on public.challenge_submissions;
create policy "Users read own submission"
  on public.challenge_submissions for select
  using (user_id = auth.uid());

drop policy if exists "Admins manage submissions" on public.challenge_submissions;
create policy "Admins manage submissions"
  on public.challenge_submissions for all
  using (public.is_admin())
  with check (public.is_admin());


-- ------------------------------------------------------------
-- 3. Global leaderboard, points only. No links, no email, no
--    dataset detail, just who scored what.
-- ------------------------------------------------------------
create or replace function public.leaderboard(p_limit int default 100)
returns table(
  rank bigint,
  user_id uuid,
  username text,
  total_points bigint,
  challenges_completed bigint,
  last_awarded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    row_number() over (order by sum(cs.points) desc, max(cs.reviewed_at) asc) as rank,
    p.id as user_id,
    p.username,
    sum(cs.points)::bigint as total_points,
    count(*)::bigint as challenges_completed,
    max(cs.reviewed_at) as last_awarded_at
  from public.challenge_submissions cs
  join public.profiles p on p.id = cs.user_id
  where cs.status = 'reviewed' and cs.points is not null
  group by p.id, p.username
  order by total_points desc, last_awarded_at asc
  limit greatest(p_limit, 1);
$fn$;

revoke all on function public.leaderboard(int) from public;
grant execute on function public.leaderboard(int) to anon, authenticated;
