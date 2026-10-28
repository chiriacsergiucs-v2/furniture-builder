-- Furniture Builder accounts, saved items and share links (ADR-127, ADR-128, ADR-130, ADR-131, ADR-132).
-- Apply once to the Supabase project (EU region, G-218): Dashboard › SQL editor, or `supabase db push`.
-- Every rule is enforced here, on the server; the app ships only the public (anon) key (ADR-131).

-- One row per saved item: the same JSON the app exports (ADR-011, ADR-128). Never generated geometry.
create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('design', 'template', 'image')),
  name text not null default '' check (char_length(name) <= 200),
  body jsonb not null,
  body_schema int not null check (body_schema between 1 and 100),
  revision int not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now(),
  -- Account Trash (G-228): set on delete, purged after 7 days.
  deleted_at timestamptz,
  size int generated always as (octet_length(body::text)) stored
);
create index if not exists records_owner on public.records (owner, updated_at desc);

alter table public.records enable row level security;
drop policy if exists "owner reads" on public.records;
create policy "owner reads" on public.records for select using (owner = auth.uid());
-- Writes: save_record checks the revision; the policies below keep every write to the caller's own rows.

-- Caps on every write, however it arrives (G-223): one item at most 2 MB; one account at most 25 MB of item bodies,
-- so the 500 MB free database holds about 20 full accounts.
create or replace function public.records_caps() returns trigger
language plpgsql set search_path = public as $$
declare total bigint;
begin
  if octet_length(new.body::text) > 2 * 1024 * 1024 then
    raise exception 'item too large' using errcode = '54000';
  end if;
  select coalesce(sum(size), 0) into total from public.records where owner = new.owner and id <> new.id;
  if total + octet_length(new.body::text) > 25 * 1024 * 1024 then
    raise exception 'account full' using errcode = '53100';
  end if;
  return new;
end $$;
drop trigger if exists records_caps on public.records;
create trigger records_caps before insert or update of body on public.records
  for each row execute function public.records_caps();

-- Saves with a revision check: an update must name the revision it started from (ADR-129).
create or replace function public.save_record(
  p_id uuid,
  p_kind text,
  p_name text,
  p_body jsonb,
  p_schema int,
  p_base int
) returns public.records
language plpgsql security invoker set search_path = public as $$
declare
  r public.records;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_id is null then
    insert into public.records (kind, name, body, body_schema) values (p_kind, p_name, p_body, p_schema)
      returning * into r;
    return r;
  end if;
  update public.records
    set name = p_name, body = p_body, body_schema = p_schema, revision = revision + 1, updated_at = now(),
        deleted_at = null
    where id = p_id and owner = auth.uid() and revision = p_base
    returning * into r;
  if r.id is null then
    -- Another device saved first (ADR-129): the caller keeps both.
    raise exception 'conflict' using errcode = '40001';
  end if;
  return r;
end $$;

create or replace function public.trash_record(p_id uuid, p_trash boolean) returns void
language sql security invoker set search_path = public as $$
  update public.records set deleted_at = case when p_trash then now() else null end, updated_at = now()
    where id = p_id and owner = auth.uid();
$$;

-- Items in the Trash for 7 days or more are removed (G-228); the app calls this on each sync.
create or replace function public.purge_trash() returns int
language sql security invoker set search_path = public as $$
  with gone as (
    delete from public.records
      where owner = auth.uid() and deleted_at is not null and deleted_at < now() - interval '7 days'
      returning 1
  ) select count(*)::int from gone;
$$;

-- Row-level security lets these functions write only the caller's rows.
drop policy if exists "owner inserts" on public.records;
create policy "owner inserts" on public.records for insert with check (owner = auth.uid());
drop policy if exists "owner updates" on public.records;
create policy "owner updates" on public.records for update using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "owner deletes" on public.records;
create policy "owner deletes" on public.records for delete using (owner = auth.uid());
revoke all on public.records from anon;
grant select, insert, update, delete on public.records to authenticated;
grant execute on function public.save_record, public.trash_record, public.purge_trash to authenticated;

-- Share links (ADR-132): an unguessable id (at least 128 random bits, 22+ characters) names one record. Anyone with the
-- link can open it (G-236); no expiry; the owner can stop it (G-237); it shows the latest saved version (G-238).
create table if not exists public.shares (
  id text primary key check (char_length(id) >= 22 and id ~ '^[A-Za-z0-9_-]+$'),
  record_id uuid not null references public.records (id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  stopped_at timestamptz
);
create index if not exists shares_owner on public.shares (owner, created_at desc);
alter table public.shares enable row level security;
drop policy if exists "owner reads shares" on public.shares;
create policy "owner reads shares" on public.shares for select using (owner = auth.uid());
-- No direct writes: a share is made and stopped only by the functions below, which check the record's owner.
revoke all on public.shares from anon, authenticated;
grant select on public.shares to authenticated;

-- Creating links: at most 30 per account per hour (G-235). The record must be the caller's and not in the Trash.
create or replace function public.create_share(p_record uuid, p_id text) returns public.shares
language plpgsql security definer set search_path = public as $$
declare s public.shares;
begin
  if (select count(*) from public.shares where owner = auth.uid() and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too many links' using errcode = '53400';
  end if;
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not exists (select 1 from public.records where id = p_record and owner = auth.uid() and deleted_at is null) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.shares (id, record_id, owner) values (p_id, p_record, auth.uid()) returning * into s;
  return s;
end $$;
revoke all on function public.create_share from public;
grant execute on function public.create_share to authenticated;

-- Stop sharing (G-237): only the owner's own link.
create or replace function public.stop_share(p_id text) returns void
language sql security definer set search_path = public as $$
  update public.shares set stopped_at = now() where id = p_id and owner = auth.uid() and stopped_at is null;
$$;
revoke all on function public.stop_share from public;
grant execute on function public.stop_share to authenticated;

-- Opening a link: only the name, kind and body, never the owner or any account field (ADR-132). At most 120 opens per
-- link per hour (G-235), counted here.
create table if not exists public.share_opens (
  share_id text not null references public.shares (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists share_opens_at on public.share_opens (share_id, at);
alter table public.share_opens enable row level security;

create or replace function public.open_share(p_id text)
returns table (name text, kind text, body jsonb, body_schema int, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.share_opens o where o.share_id = p_id and o.at > now() - interval '1 hour') >= 120 then
    raise exception 'too many opens' using errcode = '53400';
  end if;
  return query
    select r.name, r.kind, r.body, r.body_schema, r.updated_at
    from public.shares s join public.records r on r.id = s.record_id
    where s.id = p_id and s.stopped_at is null and r.deleted_at is null;
  if found then
    insert into public.share_opens (share_id) values (p_id);
    delete from public.share_opens where at < now() - interval '1 day';
  end if;
end $$;
revoke all on function public.open_share from public;
grant execute on function public.open_share to anon, authenticated;

-- Delete my account (ADR-130, G-232): removes the sign-in and, by cascade, every record and share at once.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account from public;
grant execute on function public.delete_my_account to authenticated;
