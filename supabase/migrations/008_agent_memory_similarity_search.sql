-- Add a threshold/count-based memory search API for authenticated users.
-- The existing (user_id, query_embedding) overload is retained for service-side calls.
begin;

create or replace function public.get_relevant_memories(
  query_embedding public.vector,
  match_threshold double precision default 0.7,
  match_count integer default 5
)
returns table (
  id uuid,
  content text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public, auth
as $$
  select
    am.id,
    am.content,
    (1 - (am.embedding <=> query_embedding))::double precision as similarity
  from public.agent_memories as am
  where am.user_id = auth.uid()
    and am.embedding is not null
    and 1 - (am.embedding <=> query_embedding) > coalesce(match_threshold, 0.7)
  order by am.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 5), 1), 50);
$$;

revoke all on function public.get_relevant_memories(public.vector, double precision, integer) from public, anon;
grant execute on function public.get_relevant_memories(public.vector, double precision, integer) to authenticated;

commit;
