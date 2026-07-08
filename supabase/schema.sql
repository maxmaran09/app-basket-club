-- Esquema para el sistema de staff tecnico de basquet.
-- Se usa UNA sola tabla "eventos" (no "entrenamientos") porque el Calendario es el modulo
-- central del CLAUDE.md: un mismo registro puede ser entrenamiento, partido, libre, optativo
-- o especial, y todos comparten date/type/categoria/tira/title. Los campos especificos de
-- entrenamiento (bloques, fisico) y de partido (scouting, plan de juego) quedan nullable.
--
-- Los nombres de columna estan en camelCase (entre comillas) para que coincidan 1 a 1 con las
-- propiedades del objeto "event" en src/App.jsx: supabase-js devuelve filas como objetos JS con
-- esas mismas claves, sin necesitar una capa de mapeo camelCase <-> snake_case.
--
-- Pegar este script completo en Supabase > SQL Editor > New query > Run.

create extension if not exists pgcrypto;

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),

  -- Comunes a todo evento del calendario
  date date not null,
  type text not null check (type in ('entrenamiento','partido','libre','optativo','especial')),
  categoria text,
  tira text,
  title text not null,

  -- Entrenamiento: objetivo, asistencia y bloques de cancha
  "objetivoSemana" text,
  asistencia text,
  bloques jsonb not null default '[]'::jsonb,

  -- Entrenamiento: preparacion fisica
  "horarioBasquet" text,
  "horarioFisico" text,
  "cargaFisica" text check ("cargaFisica" in ('Baja','Media','Alta')),
  "lugarFisico" text check ("lugarFisico" in ('Cancha','Gimnasio de pesas','Mixto')),
  "enfoqueFisico" jsonb not null default '[]'::jsonb,
  "notasFisicas" text,

  -- Partido: header
  rival text,
  jornada text,
  condicion text check (condicion in ('LOCAL','VISITANTE')),
  horario text,
  citacion text,
  resultado text,

  -- Partido: scouting rival
  "videoColectivo" text,
  "scoutingColectivo" jsonb not null default '[]'::jsonb,
  "plantelRival" jsonb not null default '[]'::jsonb,

  -- Partido: plan de juego
  "planAtaque" text,
  "planDefensa" text,
  ataque jsonb not null default '{}'::jsonb,
  defensa jsonb not null default '{}'::jsonb
);

create index if not exists eventos_date_idx on public.eventos (date);
create index if not exists eventos_categoria_tira_idx on public.eventos (categoria, tira);

-- Mantiene "updatedAt" al dia en cada UPDATE.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists eventos_set_updated_at on public.eventos;
create trigger eventos_set_updated_at
before update on public.eventos
for each row execute function public.set_updated_at();

-- RLS: acceso abierto de lectura/escritura (MVP sin login, todo el staff edita por igual,
-- segun CLAUDE.md). Cuando se sume login (Fase 1), reemplazar "using (true)" por reglas
-- basadas en auth.uid().
alter table public.eventos enable row level security;

drop policy if exists "eventos_select_all" on public.eventos;
create policy "eventos_select_all" on public.eventos for select using (true);

drop policy if exists "eventos_insert_all" on public.eventos;
create policy "eventos_insert_all" on public.eventos for insert with check (true);

drop policy if exists "eventos_update_all" on public.eventos;
create policy "eventos_update_all" on public.eventos for update using (true);

drop policy if exists "eventos_delete_all" on public.eventos;
create policy "eventos_delete_all" on public.eventos for delete using (true);
