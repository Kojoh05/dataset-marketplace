-- KOJOH: gender-aware character art.
-- Run once in the Supabase SQL editor BEFORE deploying the site update.

alter table public.datasets
  add column if not exists art_boy_url  text,
  add column if not exists art_girl_url text;

alter table public.profiles
  add column if not exists art_pref text check (art_pref in ('boy','girl'));

-- Tata dealership dataset: artwork shipped in the site repo (assets/art/).
update public.datasets
   set art_boy_url  = 'assets/art/tata-boy.webp',
       art_girl_url = 'assets/art/tata-girl.webp'
 where slug = 'tata-delhi-sales-fy2526';

-- Diwali Discount Trap
update public.datasets
   set art_boy_url  = 'assets/art/diwali-boy.webp',
       art_girl_url = 'assets/art/diwali-girl.webp'
 where slug = 'diwali-discount-trap-fy2526';

-- Late Again: Last-Mile Delivery
update public.datasets
   set art_boy_url  = 'assets/art/lateagain-boy.webp',
       art_girl_url = 'assets/art/lateagain-girl.webp'
 where slug = 'late-again-last-mile-fy2526';
