alter table public.ai_router_settings
  add column if not exists max_parallel_free_models integer not null default 10
  check (max_parallel_free_models between 1 and 50);
