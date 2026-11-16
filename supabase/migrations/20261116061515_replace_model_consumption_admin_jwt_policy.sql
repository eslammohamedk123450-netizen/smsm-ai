-- Keep model-consumption reads tied to the canonical database-backed admin registry.
-- Do not trust a client JWT role claim as the sole admin authorization check.
drop policy if exists "Admins can view consumption" on public.model_consumption_logs;

create policy "Admins can view consumption"
on public.model_consumption_logs
for select
to authenticated
using ((select public.suly_is_admin()));
