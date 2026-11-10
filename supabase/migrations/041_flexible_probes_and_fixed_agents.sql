-- Flexible model probes + fixed agent roles + provider editing.
-- 1) Probe cadence becomes configurable: healthy enabled models are probed on
--    one interval (default 8h = 3 checks/day) while restricted or manually
--    disabled models are re-probed on a shorter interval (default 120 min)
--    until they recover.
-- 2) agent_registry gains the fixed orchestration roles thinker and
--    coordinator; the four fixed roles are seeded once.
-- 3) Admins can edit a provider's name, URL, description and API key.

begin;

-- 1) Flexible probe intervals.
alter table public.ai_router_settings
  add column if not exists probe_interval_minutes integer not null default 480,
  add column if not exists restricted_probe_interval_minutes integer not null default 120;

-- 2) Fixed agent roles: thinker and coordinator join planner, worker, reviewer.
alter table public.agent_registry drop constraint if exists agent_registry_role_check;

alter table public.agent_registry add constraint agent_registry_role_check
  check (role in ('planner', 'thinker', 'worker', 'reviewer', 'coordinator'));

insert into public.agent_registry (name, role, system_prompt, model_fallback_chain, is_active)
select 'العقل المخطط', 'planner',
  'أنت العقل المخطط في منظومة Suly. تقسم المهمة إلى خطوات تنفيذية واضحة ومقتضبة، وتحدد الأولويات والمخرجات المطلوبة من كل خطوة دون إطالة.',
  '[]'::jsonb, true
where not exists (select 1 from public.agent_registry where role = 'planner');

insert into public.agent_registry (name, role, system_prompt, model_fallback_chain, is_active)
select 'العقل المفكر', 'thinker',
  'أنت العقل المفكر في منظومة Suly. تفكر في الطلب قبل أي رد: هل هو دردشة أم مهمة، بسيطة أم مركبة، وكم مصدرًا يحتاج، ثم تختار أفضل مسار للتنفيذ بأقل مجهود ممكن.',
  '[]'::jsonb, true
where not exists (select 1 from public.agent_registry where role = 'thinker');

insert into public.agent_registry (name, role, system_prompt, model_fallback_chain, is_active)
select 'المراجع', 'reviewer',
  'أنت المراجع في منظومة Suly. تراجع نتائج العمل وتصحح الأخطاء وترتب الإجابة النهائية بدقة ووضوح قبل تسليمها.',
  '[]'::jsonb, true
where not exists (select 1 from public.agent_registry where role = 'reviewer');

insert into public.agent_registry (name, role, system_prompt, model_fallback_chain, is_active)
select 'المنسق', 'coordinator',
  'أنت المنسق في منظومة Suly. تجمع مخرجات العمال، تحل التعارضات بينها، وتصيغ نتيجة واحدة متماسكة ومكتملة للمستخدم.',
  '[]'::jsonb, true
where not exists (select 1 from public.agent_registry where role = 'coordinator');

-- 3) Editable provider records (name, URL, description, optional key rotation).
create or replace function public.suly_admin_update_provider(
  p_user_id uuid,
  p_provider_id integer,
  p_name text,
  p_base_url text,
  p_description text,
  p_api_key text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'vault'
as $function$
declare
  v_vault_id uuid;
begin
  if p_user_id is null or auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_user_id is null or not exists (
    select 1
    from public.suly_admins a
    join public.suly_profiles pr on pr.id = a.user_id
    where a.user_id = p_user_id and pr.is_banned = false
  ) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_provider_id is null
    or p_name is null or char_length(btrim(p_name)) not between 1 and 120
    or p_base_url is null or p_base_url !~* '^https://[^[:space:]]+$'
    or char_length(coalesce(p_description, '')) > 2000
    or (p_api_key is not null and (char_length(p_api_key) = 0 or char_length(p_api_key) > 16384)) then
    raise exception 'Invalid provider fields' using errcode = '22023';
  end if;

  -- The new name must stay unique across providers.
  if exists (
    select 1 from public.ai_providers
    where name = btrim(p_name) and id <> p_provider_id
  ) then
    raise exception 'Provider name already used' using errcode = '23505';
  end if;

  select api_key_vault_id into v_vault_id
  from public.ai_providers
  where id = p_provider_id
  for update;

  if v_vault_id is null then
    raise exception 'Provider not found' using errcode = 'P0002';
  end if;

  if p_api_key is not null then
    perform vault.update_secret(v_vault_id, btrim(p_api_key), null, null, null);
  end if;

  update public.ai_providers
  set name = btrim(p_name),
      base_url = rtrim(btrim(p_base_url), '/'),
      description = nullif(btrim(p_description), ''),
      updated_at = now()
  where id = p_provider_id;

  return jsonb_build_object('success', true, 'provider_id', p_provider_id);
end;
$function$;

revoke all on function public.suly_admin_update_provider(uuid, integer, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.suly_admin_update_provider(uuid, integer, text, text, text, text)
  to authenticated, service_role;

commit;
