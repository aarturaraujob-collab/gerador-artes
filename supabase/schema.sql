-- FAF Lab / urano-faf — Fase 1 da migração para Supabase.
-- Domínio piloto: cidades, estádios, clubes + perfis de usuário.
-- Rode isto inteiro no SQL Editor do painel Supabase (https://supabase.com/dashboard/project/velguljjckaolxquzidr/sql/new).
-- Idempotente: pode rodar de novo sem quebrar nada já criado.

create table if not exists cities (
  id text primary key,
  name text not null,
  state text,
  deleted_at timestamptz
);

create table if not exists stadiums (
  id text primary key,
  name text not null,
  city_id text references cities(id),
  capacity integer,
  turf_type text,
  image text,
  deleted_at timestamptz
);

create table if not exists clubs (
  id text primary key,
  short_name text not null,
  full_name text not null,
  shield text,
  city_id text references cities(id),
  state text,
  primary_color text,
  secondary_color text,
  founded_year integer,
  deleted_at timestamptz
);

-- Um perfil por usuário autenticado — só pra ter nome de exibição
-- (contas em si são criadas manualmente em Authentication → Users).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table cities enable row level security;
alter table stadiums enable row level security;
alter table clubs enable row level security;
alter table profiles enable row level security;

drop policy if exists "authenticated full access" on cities;
create policy "authenticated full access" on cities
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on stadiums;
create policy "authenticated full access" on stadiums
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on clubs;
create policy "authenticated full access" on clubs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles for select using (auth.uid() = id);

drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles for update using (auth.uid() = id);

-- "Automatically expose new tables" está desligado de propósito (mais seguro
-- por padrão) — isso significa que os roles do PostgREST não têm nenhum
-- privilégio de tabela até serem concedidos explicitamente aqui. RLS sozinho
-- não basta: sem o GRANT, toda query dá "permission denied" mesmo com
-- política liberando o acesso.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.cities to authenticated;
grant select, insert, update, delete on public.stadiums to authenticated;
grant select, insert, update, delete on public.clubs to authenticated;
grant select, update on public.profiles to authenticated;
