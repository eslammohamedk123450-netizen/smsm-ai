begin;

-- Keep the public upgrade labels consistent across admin and mobile clients.
update public.subscription_plans
set name = case id
  when 2 then 'LITE'
  when 3 then 'PRO'
  when 4 then 'MAX'
  when 5 then 'ULTRA'
  else name
end,
updated_at = now()
where id in (2, 3, 4, 5);

-- Feature copy is user-authored content; do not impose varchar limits that
-- truncate Arabic or other localized copy in the admin panel.
alter table public.subscription_plan_features
  alter column title type text,
  alter column value type text;

alter table public.subscription_plan_features
  drop constraint if exists subscription_plan_features_title_check,
  drop constraint if exists subscription_plan_features_value_check;

alter table public.subscription_plan_features
  add constraint subscription_plan_features_title_check
    check (length(btrim(title)) between 1 and 300),
  add constraint subscription_plan_features_value_check
    check (length(btrim(value)) between 1 and 2000);

commit;
