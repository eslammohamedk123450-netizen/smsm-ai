-- Remove redundant permissive policies and standardize legacy credit admin checks.
-- PostgreSQL combines permissive policies with OR; false "deny" policies do not override another allow policy.
begin;

drop policy if exists agent_registry_admin_read on public.agent_registry;
drop policy if exists agent_tool_registry_admin_read on public.agent_tool_registry;
drop policy if exists ai_route_model_assignments_admin_read on public.ai_route_model_assignments;
drop policy if exists brain_tiers_admin_read on public.brain_tiers;
drop policy if exists brain_capabilities_admin_read on public.capabilities;
drop policy if exists brain_model_capabilities_admin_read on public.model_capabilities;
drop policy if exists brain_models_admin_read on public.models;
drop policy if exists brain_plans_admin_read on public.plans;
drop policy if exists suly_media_generation_models_admin_read on public.suly_media_generation_models;
drop policy if exists suly_media_generation_prices_admin_read on public.suly_media_generation_prices;
drop policy if exists suly_model_profile_models_admin_read on public.suly_model_profile_models;

-- Replace a legacy JWT-role check with the same database-backed admin predicate used elsewhere.
drop policy if exists suly_deny_client_access on public.credit_transactions;
drop policy if exists "Admins can view transactions" on public.credit_transactions;
create policy credit_transactions_admin_read
  on public.credit_transactions
  for select to authenticated
  using (public.suly_is_admin());

-- These false policies are not deny-overrides: permissive policies are ORed.
-- Remove them while retaining the explicit active-plan/public-ad-settings reads and admin writes.
drop policy if exists suly_deny_client_access on public.subscription_plans;
drop policy if exists suly_deny_client_access on public.system_settings;

commit;
