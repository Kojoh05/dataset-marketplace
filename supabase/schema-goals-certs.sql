-- KOJOH: learner goal + certificates for reviewed portfolio projects.
-- Run once in the Supabase SQL editor (safe to run again).
-- Needs schema-practice-levels.sql and schema-submissions.sql to have run first.

-- 1. Learner goal, picked at sign-up or in Settings. Drives recommendations.
alter table public.profiles
  add column if not exists goal text check (goal in ('student', 'job_seeker', 'switcher'));

-- 2. Project certificates live in the same table as Practice certificates:
--    role = dataset slug, role_title = dataset title, level = 'project'.
--    One is issued automatically when an admin reviews a submission and awards points.
create or replace function public.kojoh_issue_project_certificate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ds record;
  pr record;
  nm text;
begin
  if new.status <> 'reviewed' or coalesce(new.points, 0) <= 0 then
    return new;
  end if;
  select slug, title into ds from public.datasets where id = new.dataset_id;
  if ds.slug is null then return new; end if;
  select first_name, last_name, username into pr from public.profiles where id = new.user_id;
  nm := nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), '');
  insert into public.practice_certificates (code, user_id, name, role, role_title, level, status, skipped, score, issued_at)
  values ('KJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
          new.user_id, coalesce(nm, pr.username, 'KOJOH learner'),
          ds.slug, regexp_replace(ds.title, '\s*\(Free\)\s*$', ''), 'project', 'issued', false, null, now())
  on conflict (user_id, role, level) do nothing;
  return new;
end;
$$;

drop trigger if exists kojoh_project_certificate on public.challenge_submissions;
create trigger kojoh_project_certificate
  after insert or update of status, points on public.challenge_submissions
  for each row execute function public.kojoh_issue_project_certificate();

-- Certificates for submissions you already reviewed before this file was run.
insert into public.practice_certificates (code, user_id, name, role, role_title, level, status, skipped, score, issued_at)
select 'KJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
       s.user_id,
       coalesce(nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), p.username, 'KOJOH learner'),
       d.slug, regexp_replace(d.title, '\s*\(Free\)\s*$', ''), 'project', 'issued', false, null, coalesce(s.reviewed_at, now())
from public.challenge_submissions s
join public.datasets d on d.id = s.dataset_id
left join public.profiles p on p.id = s.user_id
where s.status = 'reviewed' and coalesce(s.points, 0) > 0
on conflict (user_id, role, level) do nothing;
