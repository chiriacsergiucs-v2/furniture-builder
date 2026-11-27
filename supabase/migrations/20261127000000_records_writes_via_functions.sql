-- Saved items are written only through save_record, trash_record and purge_trash (G-544, security health L-2).
-- 20261028000000_accounts.sql granted insert, update and delete on public.records to every signed-in user, so a
-- client could skip save_record's revision check (ADR-129). The shipped migration is not edited; this one narrows it.
-- Not applied anywhere yet: there is no live Supabase project (G-277). Tested by `bash tools/supabase/test-sql.sh`.

-- The three write functions now run as their owner, so they keep working without the table grant. Each one still
-- writes only the caller's rows: every statement filters on owner = auth.uid(), and an insert takes the caller as
-- owner by default. The size caps trigger (G-223) runs on every write as before.
alter function public.save_record(uuid, text, text, jsonb, int, int) security definer;
alter function public.trash_record(uuid, boolean) security definer;
alter function public.purge_trash() security definer;

-- Only signed-in users may call them (a function is executable by everyone by default).
revoke all on function public.save_record(uuid, text, text, jsonb, int, int) from public, anon;
revoke all on function public.trash_record(uuid, boolean) from public, anon;
revoke all on function public.purge_trash() from public, anon;
grant execute on function public.save_record(uuid, text, text, jsonb, int, int) to authenticated;
grant execute on function public.trash_record(uuid, boolean) to authenticated;
grant execute on function public.purge_trash() to authenticated;

-- Signed-in users keep reading their own rows (row-level security); direct writes are refused.
revoke insert, update, delete on public.records from authenticated;
