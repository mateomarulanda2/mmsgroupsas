-- MMS Group Fleet App — Supabase schema
-- Run this once in Supabase: Project -> SQL Editor -> New query -> paste -> Run

create table if not exists trucks (
  id text primary key,
  brand text default '',
  name text default '',
  plate text default ''
);

create table if not exists master_auth (
  id int primary key default 1,
  username text not null,
  password text not null
);

create table if not exists drivers (
  id text primary key,
  username text not null unique,
  password text not null,
  name text not null,
  truck_id text references trucks(id)
);

create table if not exists expenses (
  id text primary key,
  truck_id text not null references trucks(id),
  category text not null,
  amount numeric not null,
  date date not null,
  origin text default '',
  destination text default '',
  note text default '',
  driver text default '',
  created_at bigint not null
);

create index if not exists expenses_truck_id_idx on expenses(truck_id);

-- Seed the two default trucks (safe to run even if they already exist)
insert into trucks (id, brand, name, plate) values
  ('camion1', '', '', ''),
  ('camion2', '', '', '')
on conflict (id) do nothing;

-- Row Level Security
-- This app does its own username/password login inside the frontend (not
-- Supabase Auth), so we open these tables to the public "anon" key and rely
-- on the app's login screen to control who gets in. The anon key is safe to
-- ship in the frontend bundle, but note that anyone with technical skill and
-- your anon key could in principle query these tables directly — this is an
-- appropriate setup for a small internal tool, not for sensitive data.

alter table trucks enable row level security;
alter table master_auth enable row level security;
alter table drivers enable row level security;
alter table expenses enable row level security;

create policy "public read trucks" on trucks for select using (true);
create policy "public write trucks" on trucks for insert with check (true);
create policy "public update trucks" on trucks for update using (true);

create policy "public read master_auth" on master_auth for select using (true);
create policy "public write master_auth" on master_auth for insert with check (true);
create policy "public update master_auth" on master_auth for update using (true);

create policy "public read drivers" on drivers for select using (true);
create policy "public write drivers" on drivers for insert with check (true);
create policy "public update drivers" on drivers for update using (true);
create policy "public delete drivers" on drivers for delete using (true);

create policy "public read expenses" on expenses for select using (true);
create policy "public write expenses" on expenses for insert with check (true);
create policy "public delete expenses" on expenses for delete using (true);
