-- KOJOH: cover art for the newer datasets. Run once in the Supabase SQL editor.
-- (Needs schema-art.sql to have been run before; it adds the art columns.)

update public.datasets set art_boy_url='assets/art/approvedonly-boy.webp',    art_girl_url='assets/art/approvedonly-girl.webp'    where slug='approved-only-nbfc-credit-risk';
update public.datasets set art_boy_url='assets/art/kirana-boy.webp',          art_girl_url='assets/art/kirana-girl.webp'          where slug='kirana-store-sales-free';
update public.datasets set art_boy_url='assets/art/funnel-boy.webp',          art_girl_url='assets/art/funnel-girl.webp'          where slug='the-funnel-that-leaked-free';
update public.datasets set art_boy_url='assets/art/quietquitters-boy.webp',   art_girl_url='assets/art/quietquitters-girl.webp'   where slug='the-quiet-quitters-ott-churn';
update public.datasets set art_boy_url='assets/art/salary-girl.webp',         art_girl_url='assets/art/salary-girl.webp'          where slug='where-did-my-salary-go-fy2526';
update public.datasets set art_boy_url='assets/art/slowboat-boy.webp',        art_girl_url='assets/art/slowboat-girl.webp'        where slug='slow-boat-from-ningbo-fy2526';
update public.datasets set art_boy_url='assets/art/spares-boy.webp',          art_girl_url='assets/art/spares-girl.webp'          where slug='spares-never-arrive-fy2526';
update public.datasets set art_boy_url='assets/art/stockout-boy.webp',        art_girl_url='assets/art/stockout-girl.webp'        where slug='stockout-saturdays-quick-commerce';
