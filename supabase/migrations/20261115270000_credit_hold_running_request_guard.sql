-- Do not expire a held reservation while its underlying request is still
-- executing. This covers long-running image jobs (heartbeat), active chat
-- request leases, and Brain tasks with a live context.
begin;

create or replace function public.reserve_credits(
  p_user_id uuid,
  p_task_id uuid,
  p_amount bigint,
  p_conversation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $reserve$
declare
  v_account public.suly_credit_accounts%rowtype;
  v_hold public.suly_credit_holds%rowtype;
  v_balance bigint;
  v_reserved bigint;
  v_negative_limit bigint := 5000;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null or p_task_id is null or p_amount is null
    or p_amount <= 0 or p_amount > 1000000000 then
    raise exception 'invalid reservation parameters' using errcode = '22023';
  end if;

  insert into public.suly_credit_accounts(user_id)
  values (p_user_id) on conflict (user_id) do nothing;
  select * into v_account
  from public.suly_credit_accounts where user_id = p_user_id for update;

  for v_hold in
    select h.*
    from public.suly_credit_holds h
    where h.user_id = p_user_id
      and h.status = 'held'
      and h.created_at < now() - interval '30 minutes'
      and not exists (
        select 1
        from public.suly_media_generation_jobs media
        where media.id = h.task_id
          and media.user_id = h.user_id
          and media.status = 'running'
          and media.updated_at >= now() - interval '10 minutes'
      )
      and not exists (
        select 1
        from public.suly_ai_requests request
        where request.request_id = h.task_id
          and request.user_id = h.user_id
          and request.status = 'running'
          and request.lease_expires_at > now()
      )
      and not exists (
        select 1
        from public.brain_usage_events usage
        join public.brain_task_contexts context on context.task_id = usage.task_id
        where usage.task_id = h.task_id
          and usage.user_id = h.user_id
          and usage.status = 'reserved'
          and context.status = 'running'
          and context.updated_at >= now() - interval '30 minutes'
      )
    order by h.created_at
    for update of h
  loop
    update public.suly_credit_accounts
      set balance = balance + v_hold.reserved_amount,
          reserved_balance = reserved_balance - v_hold.reserved_amount,
          updated_at = now()
      where user_id = p_user_id
      returning balance, reserved_balance into v_balance, v_reserved;

    update public.suly_credit_holds
      set status = 'expired', charged_amount = 0, actual_cost = 0, settled_at = now()
      where task_id = v_hold.task_id;

    insert into public.suly_credit_transactions(
      user_id, hold_id, event_type, amount, balance_delta, reserved_delta,
      balance_after, reserved_after, source, reason
    ) values (
      p_user_id, v_hold.task_id, 'expire', v_hold.reserved_amount,
      v_hold.reserved_amount, -v_hold.reserved_amount, v_balance, v_reserved,
      'credit_escrow', 'Released stale reservation after timeout'
    ) on conflict do nothing;
  end loop;

  select * into v_account
  from public.suly_credit_accounts where user_id = p_user_id;
  select * into v_hold
  from public.suly_credit_holds where task_id = p_task_id for update;
  if found then
    if v_hold.user_id = p_user_id and v_hold.status = 'held'
      and v_hold.reserved_amount = p_amount then
      return jsonb_build_object(
        'success', true, 'already_reserved', true, 'task_id', p_task_id,
        'reserved', p_amount, 'balance', v_account.balance,
        'reserved_balance', v_account.reserved_balance
      );
    end if;
    return jsonb_build_object('success', false, 'error', 'task_id_conflict');
  end if;

  select coalesce(negative_balance_limit, 5000) into v_negative_limit
  from public.suly_credit_pricing where id = 1;

  if v_account.balance - p_amount < -v_negative_limit then
    return jsonb_build_object(
      'success', false, 'error', 'insufficient_credits',
      'reason', 'negative_balance_limit_exceeded',
      'balance', v_account.balance, 'required', p_amount,
      'negative_balance_limit', v_negative_limit
    );
  end if;

  update public.suly_credit_accounts
    set balance = balance - p_amount,
        reserved_balance = reserved_balance + p_amount,
        updated_at = now()
    where user_id = p_user_id
    returning balance, reserved_balance into v_balance, v_reserved;

  insert into public.suly_credit_holds(task_id, user_id, conversation_id, reserved_amount)
  values (p_task_id, p_user_id, p_conversation_id, p_amount);

  insert into public.suly_credit_transactions(
    user_id, hold_id, event_type, amount, balance_delta, reserved_delta,
    balance_after, reserved_after, source, reason
  ) values (
    p_user_id, p_task_id, 'reserve', p_amount, -p_amount, p_amount,
    v_balance, v_reserved, 'ai_request', 'Credits reserved before model execution'
  );

  return jsonb_build_object(
    'success', true, 'task_id', p_task_id, 'reserved', p_amount,
    'balance', v_balance, 'reserved_balance', v_reserved,
    'negative_balance_limit', v_negative_limit
  );
end;
$reserve$;

revoke all on function public.reserve_credits(uuid, uuid, bigint, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_credits(uuid, uuid, bigint, uuid)
  to service_role;

commit;
