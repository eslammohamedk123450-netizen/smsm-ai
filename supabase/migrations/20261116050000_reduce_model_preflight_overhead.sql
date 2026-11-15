update public.ai_router_settings
set free_race_timeout_ms = 5000,
    paid_fallback_timeout_ms = 10000,
    max_parallel_free_models = 3,
    preflight_probe_enabled = false,
    updated_at = now()
where id = 1;
