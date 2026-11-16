-- Keep feature flag metadata writable only by trusted server/admin paths.
-- Authenticated clients retain active-flag reads but cannot mutate registry rows directly.
revoke insert, update, delete, truncate, references, trigger
on table public.suly_feature_flags
from public, anon, authenticated;
