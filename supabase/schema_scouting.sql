-- Modulo de Scouting de Rivales, relacional (reemplaza los campos embebidos scoutingColectivo/
-- plantelRival/videoColectivo que vivian sueltos dentro de cada evento tipo "partido").
-- Requiere haber corrido supabase/schema.sql antes (reusa "eventos" y la funcion
-- public.set_updated_at()). Nombres de columna en snake_case, igual que jugadores/asistencias.
--
-- Pegar este script completo en Supabase > SQL Editor > New query > Run.

create table if not exists public.equipos_rivales (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  nombre_club text not null,
  logo_url text,
  notas_colectivas text,
  video_colectivo_url text,

  -- Para conectar en el futuro con el modulo de estadisticas automatizadas (CABB).
  id_estadistico_externo uuid
);

create index if not exists equipos_rivales_nombre_idx on public.equipos_rivales (nombre_club);

drop trigger if exists equipos_rivales_set_updated_at on public.equipos_rivales;
create trigger equipos_rivales_set_updated_at
before update on public.equipos_rivales
for each row execute function public.set_updated_at_snake();

alter table public.equipos_rivales enable row level security;
drop policy if exists "equipos_rivales_select_all" on public.equipos_rivales;
create policy "equipos_rivales_select_all" on public.equipos_rivales for select using (true);
drop policy if exists "equipos_rivales_insert_all" on public.equipos_rivales;
create policy "equipos_rivales_insert_all" on public.equipos_rivales for insert with check (true);
drop policy if exists "equipos_rivales_update_all" on public.equipos_rivales;
create policy "equipos_rivales_update_all" on public.equipos_rivales for update using (true);
drop policy if exists "equipos_rivales_delete_all" on public.equipos_rivales;
create policy "equipos_rivales_delete_all" on public.equipos_rivales for delete using (true);


create table if not exists public.jugadores_rivales (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  equipo_rival_id uuid not null references public.equipos_rivales(id) on delete cascade,
  dorsal integer,
  nombre_apellido text not null,
  posicion text check (posicion in ('Base','Escolta','Alero','Ala-Pivot','Pivot')),
  posicion_secundaria text check (posicion_secundaria in ('Base','Escolta','Alero','Ala-Pivot','Pivot')),
  categoria text,
  cualidades_ataque text,
  cualidades_defensa text,
  debilidades text,
  video_individual_url text,

  id_estadistico_externo uuid
);

-- Por si esta tabla ya existia de una corrida anterior: seguro de correr siempre.
alter table public.jugadores_rivales add column if not exists posicion_secundaria text check (posicion_secundaria in ('Base','Escolta','Alero','Ala-Pivot','Pivot'));

create index if not exists jugadores_rivales_equipo_idx on public.jugadores_rivales (equipo_rival_id);

drop trigger if exists jugadores_rivales_set_updated_at on public.jugadores_rivales;
create trigger jugadores_rivales_set_updated_at
before update on public.jugadores_rivales
for each row execute function public.set_updated_at_snake();

alter table public.jugadores_rivales enable row level security;
drop policy if exists "jugadores_rivales_select_all" on public.jugadores_rivales;
create policy "jugadores_rivales_select_all" on public.jugadores_rivales for select using (true);
drop policy if exists "jugadores_rivales_insert_all" on public.jugadores_rivales;
create policy "jugadores_rivales_insert_all" on public.jugadores_rivales for insert with check (true);
drop policy if exists "jugadores_rivales_update_all" on public.jugadores_rivales;
create policy "jugadores_rivales_update_all" on public.jugadores_rivales for update using (true);
drop policy if exists "jugadores_rivales_delete_all" on public.jugadores_rivales;
create policy "jugadores_rivales_delete_all" on public.jugadores_rivales for delete using (true);


-- eventos: columna relacional nueva para el rival. Se deja el viejo campo de texto "rival" tal
-- cual (no se borra, para no perder los partidos ya cargados); de ahora en mas la app completa
-- rival_id (y copia el nombre en "rival" solo como respaldo de lectura rapida).
alter table public.eventos add column if not exists rival_id uuid references public.equipos_rivales(id);
create index if not exists eventos_rival_id_idx on public.eventos (rival_id);
