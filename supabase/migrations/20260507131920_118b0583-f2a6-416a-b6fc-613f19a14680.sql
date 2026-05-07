
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "view own profile" on public.profiles for select using (auth.uid() = id);
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id);

-- auto-create profile trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- chats
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New Chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.chats enable row level security;
create policy "own chats select" on public.chats for select using (auth.uid() = user_id);
create policy "own chats insert" on public.chats for insert with check (auth.uid() = user_id);
create policy "own chats update" on public.chats for update using (auth.uid() = user_id);
create policy "own chats delete" on public.chats for delete using (auth.uid() = user_id);

-- messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null default '',
  image_url text,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "own msgs select" on public.messages for select using (auth.uid() = user_id);
create policy "own msgs insert" on public.messages for insert with check (auth.uid() = user_id);
create policy "own msgs delete" on public.messages for delete using (auth.uid() = user_id);

create index on public.messages(chat_id, created_at);
create index on public.chats(user_id, updated_at desc);
