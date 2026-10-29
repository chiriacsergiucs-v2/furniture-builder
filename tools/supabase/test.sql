-- Server rules of ADR-128, ADR-130 and ADR-132, checked on a plain PostgreSQL with tools/supabase/stub-auth.sql.
-- Run: bash tools/supabase/test-sql.sh  (needs PostgreSQL 15+; not part of CI). Any failed check raises.
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
                              ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

create or replace function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('test.uid', coalesce(u, ''), false);
$$;
create or replace function pg_temp.expect_error(q text, code text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'expected error % from: %', code, q;
exception when others then
  if sqlstate <> code then raise exception 'expected % got % (%) from: %', code, sqlstate, sqlerrm, q; end if;
end $$;

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
-- 1. Save, then update with the right revision; a stale revision is a conflict (ADR-129).
create temp table t_ids (k text, id uuid);
grant all on t_ids to authenticated;
insert into t_ids select 'r1', (public.save_record(null, 'design', 'Chest', '{"a":1}', 3, null)).id;
do $$ declare r public.records; begin
  select * into r from public.save_record((select id from t_ids where k = 'r1'), 'design', 'Chest 2', '{"a":2}', 3, 1);
  if r.revision <> 2 or r.name <> 'Chest 2' then raise exception 'update failed: %', r; end if;
end $$;
select pg_temp.expect_error(format('select public.save_record(%L, ''design'', ''x'', ''{}'', 3, 1)', (select id from t_ids where k = 'r1')), '40001');

-- 2. Another user sees nothing of A's and cannot change it.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select count(*) from public.records) <> 0 then raise exception 'B sees A''s records'; end if;
end $$;
select pg_temp.expect_error(format('select public.save_record(%L, ''design'', ''x'', ''{}'', 3, 2)', (select id from t_ids where k = 'r1')), '40001');
update public.records set name = 'hacked'; -- RLS: touches nothing
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select name from public.records) <> 'Chest 2' then raise exception 'B changed A''s record'; end if;
end $$;

-- 3. Caps: one item over 2 MB is refused (G-223).
select pg_temp.expect_error($q$select public.save_record(null, 'design', 'big', jsonb_build_object('x', repeat('a', 2200000)), 3, null)$q$, '54000');

-- 4. Shares: created only for one's own record, opened by anyone with only name, kind and body (ADR-132).
select public.create_share((select id from t_ids where k = 'r1'), 'AAAAAAAAAAAAAAAAAAAAAA');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format('select public.create_share(%L, ''BBBBBBBBBBBBBBBBBBBBBB'')', (select id from t_ids where k = 'r1')), 'P0002');
select pg_temp.expect_error($q$insert into public.shares (id, record_id) values ('CCCCCCCCCCCCCCCCCCCCCC', gen_random_uuid())$q$, '42501');
reset role;
set role anon;
select pg_temp.as_user(null);
do $$ declare n int; begin
  select count(*) into n from public.open_share('AAAAAAAAAAAAAAAAAAAAAA') where name = 'Chest 2' and body = '{"a":2}';
  if n <> 1 then raise exception 'anon could not open the share'; end if;
  if (select count(*) from public.open_share('nope-nope-nope-nope-nope')) <> 0 then raise exception 'unknown id opened'; end if;
end $$;
select pg_temp.expect_error('select * from public.records', '42501');
select pg_temp.expect_error('select * from public.shares', '42501');
reset role;
set role authenticated;

-- 5. The share shows the latest saved version (G-238); stopped by its owner only (G-237).
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.save_record((select id from t_ids where k = 'r1'), 'design', 'Chest 3', '{"a":3}', 3, 2);
do $$ begin
  if (select body from public.open_share('AAAAAAAAAAAAAAAAAAAAAA')) <> '{"a":3}' then raise exception 'not the latest version'; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.stop_share('AAAAAAAAAAAAAAAAAAAAAA');
do $$ begin
  if (select count(*) from public.open_share('AAAAAAAAAAAAAAAAAAAAAA')) <> 1 then raise exception 'B stopped A''s link'; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.stop_share('AAAAAAAAAAAAAAAAAAAAAA');
do $$ begin
  if (select count(*) from public.open_share('AAAAAAAAAAAAAAAAAAAAAA')) <> 0 then raise exception 'stopped link still opens'; end if;
end $$;

-- 6. Trash: a trashed record no longer opens by link; purge removes only 7-day-old trash (G-228).
insert into t_ids select 'r2', (public.save_record(null, 'template', 'T', '{}', 1, null)).id;
select public.create_share((select id from t_ids where k = 'r2'), 'DDDDDDDDDDDDDDDDDDDDDD');
select public.trash_record((select id from t_ids where k = 'r2'), true);
do $$ begin
  if (select count(*) from public.open_share('DDDDDDDDDDDDDDDDDDDDDD')) <> 0 then raise exception 'trashed item opens'; end if;
  if public.purge_trash() <> 0 then raise exception 'purged fresh trash'; end if;
end $$;
update public.records set deleted_at = now() - interval '8 days' where id = (select id from t_ids where k = 'r2');
do $$ begin
  if public.purge_trash() <> 1 then raise exception 'old trash not purged'; end if;
end $$;

-- 7. Delete my account removes the sign-in, every record and share at once (ADR-130, G-232).
select public.delete_my_account();
reset role;
do $$ begin
  if exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000a') then raise exception 'user kept'; end if;
  if exists (select 1 from public.records where owner = '00000000-0000-0000-0000-00000000000a') then raise exception 'records kept'; end if;
  if exists (select 1 from public.shares where owner = '00000000-0000-0000-0000-00000000000a') then raise exception 'shares kept'; end if;
  if not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000b') then raise exception 'other user deleted'; end if;
end $$;
select 'ALL SERVER CHECKS PASSED' as result;
