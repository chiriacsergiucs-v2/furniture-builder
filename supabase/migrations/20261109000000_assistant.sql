-- The assistant's daily request count per account (ADR-239). Read and written only by the `assistant` Edge
-- Function with the service role; no client role can see or change it. No chat or design is stored.
create table if not exists public.assistant_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  count int not null default 0 check (count >= 0),
  primary key (user_id, day)
);
alter table public.assistant_usage enable row level security;
revoke all on public.assistant_usage from anon, authenticated;

-- Take one request from today's allowance: returns the requests left after this one, or -1 when the cap is reached
-- (nothing is counted then).
create or replace function public.assistant_take(uid uuid, cap int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  used int;
begin
  insert into public.assistant_usage as u (user_id, day, count)
  values (uid, current_date, 1)
  on conflict (user_id, day) do update set count = u.count + 1 where u.count < cap
  returning u.count into used;
  if used is null then
    return -1;
  end if;
  return cap - used;
end;
$$;
revoke all on function public.assistant_take from public, anon, authenticated;
grant execute on function public.assistant_take to service_role;
