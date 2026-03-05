-- Run in Supabase SQL editor
create table if not exists public.app_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_state enable row level security;
-- For personal no-login use, allow anon read/write (or turn off RLS in UI)
create policy if not exists "anon read" on public.app_state for select using (true);
create policy if not exists "anon write" on public.app_state for insert with check (true);
create policy if not exists "anon update" on public.app_state for update using (true) with check (true);
