-- Run once in the Supabase SQL editor after you create the first team account (Authentication → Users →
-- Add user → Send invitation, or create it with a password). Replace the email with that account's email.
update public.profiles
set role = 'owner', is_active = true
where email = 'owner@example.com';

-- Check:
select email, role, is_active from public.profiles order by created_at;
