-- KOJOH: remove the two test-mode payments (1 Nov 2026) from earnings. Run once.
update public.purchases set price_paid = 0
 where payment_ref in ('pay_Tusre3HY0qIaaC', 'pay_TuujdY7UKAmgDp');
update public.payments set status = 'test'
 where razorpay_payment_id in ('pay_Tusre3HY0qIaaC', 'pay_TuujdY7UKAmgDp')
    or (status = 'created' and created_at < '2026-11-05');
