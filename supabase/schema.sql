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

-- ─────────────────────────────────────────────────────────────────────────
-- Fases 2-6: Competições, Jogos, Operacional, FAF Lab, Documentos.
-- Nenhuma partida ganha um id novo — `matches.id` é o mesmo gameRef
-- (texto derivado de competição+rodada+data+hora+clubes) já usado no
-- IndexedDB (ver src/modules/gameRef.ts), então FAFTV/Operação/Histórico/IMT
-- continuam se referenciando exatamente do mesmo jeito.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists competitions (
  id text primary key,
  series_id text,
  name text not null,
  season integer not null,
  category text,
  gender text,
  age_group text,
  logo text,
  background jsonb not null default '{"thumb":"","story":"","feed":""}'::jsonb,
  templates text[] not null default '{}',
  active boolean not null default true,
  status text,
  deleted_at timestamptz
);

create table if not exists matches (
  id text primary key,
  competition_id text references competitions(id),
  round text,
  date text,
  time text,
  -- No FK to clubs(id): knockout-stage fixtures imported from the official
  -- schedule can reference a TBD slot ("1º Colocado", "1º Gr. B ou E", ...)
  -- before the real qualified club is known — those are never registered as
  -- clubs (see src/modules/clubDisplay.ts), so the column must accept any text.
  home_club_id text,
  away_club_id text,
  stadium_id text references stadiums(id),
  city_id text references cities(id),
  home_goals integer,
  away_goals integer,
  tv text,
  phase text,
  ref text
);

-- Drops the FK from an existing database created before TBD knockout slots
-- were excluded from the clubs table — safe to re-run, no-op if already dropped.
alter table matches drop constraint if exists matches_home_club_id_fkey;
alter table matches drop constraint if exists matches_away_club_id_fkey;

create table if not exists operational_staff (
  id text primary key,
  name text not null,
  photo text,
  cpf text,
  phone text,
  address text,
  role text not null,
  area text not null,
  deleted_at timestamptz
);

create table if not exists match_faftv (
  id text primary key references matches(id),
  game_ref text not null,
  coordinator_staff_id text references operational_staff(id),
  commentator_staff_id text references operational_staff(id),
  broadcast_link text,
  checklist jsonb not null default '{}'::jsonb,
  status text not null,
  updated_at timestamptz not null default now()
);

create table if not exists match_operacao (
  id text primary key references matches(id),
  game_ref text not null,
  delegado_staff_id text references operational_staff(id),
  supervisor_staff_id text references operational_staff(id),
  fiscal_staff_id text references operational_staff(id),
  controle_acesso_staff_id text references operational_staff(id),
  checklist jsonb not null default '{}'::jsonb,
  status text not null,
  updated_at timestamptz not null default now()
);

create table if not exists match_operations_history (
  id uuid primary key,
  game_ref text not null references matches(id),
  module text not null,
  operator text not null,
  description text not null,
  timestamp timestamptz not null default now()
);

create table if not exists match_arbitragem (
  id text primary key references matches(id),
  game_ref text not null,
  arbitro_staff_id text references operational_staff(id),
  primeiro_assistente_staff_id text references operational_staff(id),
  segundo_assistente_staff_id text references operational_staff(id),
  quarto_arbitro_staff_id text references operational_staff(id),
  delegado_staff_id text references operational_staff(id),
  observador_staff_id text references operational_staff(id),
  status text not null,
  updated_at timestamptz not null default now()
);

create table if not exists player_competition_stats (
  id text primary key,
  competition_id text references competitions(id),
  cbf text,
  club_id text references clubs(id),
  apelido text,
  nome text,
  idade integer,
  vinculo text,
  jogos integer not null default 0,
  titular integer not null default 0,
  minutos integer not null default 0,
  gols integer not null default 0,
  cartoes_amarelos integer not null default 0,
  cartoes_vermelhos integer not null default 0,
  entrou integer not null default 0,
  saiu integer not null default 0,
  sub boolean,
  estrangeiro boolean
);

create table if not exists lab_notes (
  id text primary key,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists backgrounds (
  id text primary key,
  name text not null,
  data_uri text not null
);

create table if not exists imts (
  id text primary key,
  competition_id text references competitions(id),
  competition_name text not null,
  game_ref text not null,
  home_club_name text not null,
  away_club_name text not null,
  round text,
  number integer not null,
  season text not null,
  old_game jsonb not null,
  new_game jsonb not null,
  reason text,
  requester text,
  responsible text,
  created_at timestamptz not null,
  status text not null,
  html text not null
);

create table if not exists detailed_tables (
  id text primary key,
  competition_id text references competitions(id),
  competition_name text not null,
  season text not null,
  version integer not null,
  status text not null,
  created_at timestamptz not null,
  standings jsonb not null,
  rounds jsonb not null,
  html text not null
);

alter table competitions enable row level security;
alter table matches enable row level security;
alter table operational_staff enable row level security;
alter table match_faftv enable row level security;
alter table match_operacao enable row level security;
alter table match_operations_history enable row level security;
alter table match_arbitragem enable row level security;
alter table player_competition_stats enable row level security;
alter table lab_notes enable row level security;
alter table backgrounds enable row level security;
alter table imts enable row level security;
alter table detailed_tables enable row level security;

drop policy if exists "authenticated full access" on competitions;
create policy "authenticated full access" on competitions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on matches;
create policy "authenticated full access" on matches
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on operational_staff;
create policy "authenticated full access" on operational_staff
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on match_faftv;
create policy "authenticated full access" on match_faftv
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on match_operacao;
create policy "authenticated full access" on match_operacao
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on match_operations_history;
create policy "authenticated full access" on match_operations_history
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on match_arbitragem;
create policy "authenticated full access" on match_arbitragem
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on player_competition_stats;
create policy "authenticated full access" on player_competition_stats
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on lab_notes;
create policy "authenticated full access" on lab_notes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on backgrounds;
create policy "authenticated full access" on backgrounds
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on imts;
create policy "authenticated full access" on imts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on detailed_tables;
create policy "authenticated full access" on detailed_tables
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

grant select, insert, update, delete on public.competitions to authenticated;
grant select, insert, update, delete on public.matches to authenticated;
grant select, insert, update, delete on public.operational_staff to authenticated;
grant select, insert, update, delete on public.match_faftv to authenticated;
grant select, insert, update, delete on public.match_operacao to authenticated;
grant select, insert, update, delete on public.match_operations_history to authenticated;
grant select, insert, update, delete on public.match_arbitragem to authenticated;
grant select, insert, update, delete on public.player_competition_stats to authenticated;
grant select, insert, update, delete on public.lab_notes to authenticated;
grant select, insert, update, delete on public.backgrounds to authenticated;
grant select, insert, update, delete on public.imts to authenticated;
grant select, insert, update, delete on public.detailed_tables to authenticated;
