-- Members may edit their shop's profile, but not account-level settings
-- (currency, timezone), which Sellify sets.
revoke update on public.shops from authenticated;
grant update (name, email, phone, address, notification_email) on public.shops to authenticated;
