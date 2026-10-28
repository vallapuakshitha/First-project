-- Hostel Room Allocation and Maintainance Request Portal
-- Run this file once in the Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name varchar(80) not null check (char_length(trim(name)) >= 2),
  email varchar(254) not null unique,
  student_id varchar(30) not null unique,
  password_hash text not null,
  role text not null default 'resident' check (role in ('resident','admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_number varchar(20) not null,
  block varchar(30) not null,
  floor integer not null default 0 check (floor between 0 and 100),
  capacity integer not null check (capacity between 1 and 12),
  room_type text not null default 'Shared' check (room_type in ('Shared','Single','Accessible')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (block, room_number)
);

create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  room_id uuid not null references public.rooms(id) on delete restrict,
  status text not null default 'active' check (status in ('active','ended')),
  allocated_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  check ((status = 'active' and ended_at is null) or (status = 'ended' and ended_at is not null))
);

create unique index if not exists one_active_allocation_per_resident
  on public.allocations(user_id) where status = 'active';
create index if not exists allocations_room_status_idx on public.allocations(room_id, status);

create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  category text not null check (category in ('Electrical','Plumbing','Furniture','Cleaning','Internet','Other')),
  description varchar(1000) not null check (char_length(trim(description)) between 8 and 1000),
  priority text not null default 'normal' check (priority in ('normal','high','urgent')),
  status text not null default 'pending' check (status in ('pending','in_progress','resolved','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists maintenance_user_created_idx on public.maintenance_requests(user_id, created_at desc);
create index if not exists maintenance_status_created_idx on public.maintenance_requests(status, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users for each row execute function public.set_updated_at();
drop trigger if exists maintenance_set_updated_at on public.maintenance_requests;
create trigger maintenance_set_updated_at before update on public.maintenance_requests for each row execute function public.set_updated_at();

-- Atomically allocate a bed: lock the room row, then check current occupancy.
create or replace function public.allocate_hostel_room(p_user_id uuid, p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_is_active boolean;
  v_count integer;
  v_allocation_id uuid;
  v_role text;
begin
  select role into v_role from public.users where id = p_user_id and is_active = true;
  if v_role is distinct from 'resident' then
    raise exception 'Selected account is not an active resident';
  end if;

  perform 1 from public.rooms where id = p_room_id for update;
  select capacity, is_active into v_capacity, v_is_active from public.rooms where id = p_room_id;
  if not found or v_is_active is not true then
    raise exception 'Room is missing or inactive';
  end if;

  if exists(select 1 from public.allocations where user_id = p_user_id and status = 'active') then
    raise exception 'Resident already has an active allocation';
  end if;

  select count(*) into v_count from public.allocations where room_id = p_room_id and status = 'active';
  if v_count >= v_capacity then
    raise exception 'Room has no available beds';
  end if;

  insert into public.allocations(user_id, room_id, created_by)
  values (p_user_id, p_room_id, null)
  returning id into v_allocation_id;
  return v_allocation_id;
end;
$$;

-- This app uses the server-only Supabase service key and enforces permissions in Express.
-- RLS is enabled as defence-in-depth; do not expose the service key to browser code.
alter table public.users enable row level security;
alter table public.rooms enable row level security;
alter table public.allocations enable row level security;
alter table public.maintenance_requests enable row level security;

-- No public/anon policies are created. Browser clients cannot read/write these tables directly.
-- Keep SUPABASE_SERVICE_ROLE_KEY private and run all database access through the authenticated backend.
