-- Modulo de Gestion de Jugadores y Control de Asistencia.
-- Requiere haber corrido supabase/schema.sql antes (reusa la tabla "eventos" y la funcion
-- public.set_updated_at()). "entrenamiento_id" apunta a "eventos" porque, como en este proyecto
-- el Calendario es una sola tabla para todo tipo de evento, ahi es donde viven los entrenamientos.
--
-- A diferencia de eventos.sql (columnas camelCase), aca los nombres de columna quedan en
-- snake_case tal cual se pidieron (dorsal, nombre_apellido, categoria_origen, etc.), asi que
-- desde React se leen igual: jugador.nombre_apellido, jugador.categoria_origen, etc.
--
-- Pegar este script completo en Supabase > SQL Editor > New query > Run.

create table if not exists public.jugadores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  dorsal integer,
  nombre_apellido text not null,
  posicion text check (posicion in ('Base','Escolta','Alero','Ala-Pivot','Pivot')),
  altura numeric(3,2),
  peso integer,
  fecha_nacimiento date,
  categoria_origen text,
  tira text,
  notas_comentarios text,

  -- Array JSONB vacio por defecto: ademas de testeos de los preparadores fisicos, la app
  -- registra aca cada actualizacion de altura/peso con su fecha (ej:
  -- [{"fecha":"2026-08-01","altura":1.95,"peso":80}, {"fecha":"2026-08-01","test":"salto","valor":42}])
  -- sin que haga falta tocar el esquema de la tabla.
  evaluaciones_pfs jsonb not null default '[]'::jsonb,

  -- Un jugador puede jugar ademas en otras categorias/tiras del club (ej: uno de Liga Proximo
  -- que tambien juega en Mayores). categoria_origen/tira es su equipo natural/principal; esto
  -- es la lista de equipos extra: [{"categoria":"Mayores","tira":"Blanca"}, ...]
  equipos_adicionales jsonb not null default '[]'::jsonb
);

-- Por si esta tabla ya existia de una corrida anterior: estas lineas son seguras de correr
-- siempre (no hacen nada si ya estan aplicadas).
alter table public.jugadores add column if not exists fecha_nacimiento date;
alter table public.jugadores drop column if exists edad;
alter table public.jugadores add column if not exists equipos_adicionales jsonb not null default '[]'::jsonb;

create index if not exists jugadores_categoria_tira_idx on public.jugadores (categoria_origen, tira);

drop trigger if exists jugadores_set_updated_at on public.jugadores;
create trigger jugadores_set_updated_at
before update on public.jugadores
for each row execute function public.set_updated_at_snake();

alter table public.jugadores enable row level security;

drop policy if exists "jugadores_select_all" on public.jugadores;
create policy "jugadores_select_all" on public.jugadores for select using (true);
drop policy if exists "jugadores_insert_all" on public.jugadores;
create policy "jugadores_insert_all" on public.jugadores for insert with check (true);
drop policy if exists "jugadores_update_all" on public.jugadores;
create policy "jugadores_update_all" on public.jugadores for update using (true);
drop policy if exists "jugadores_delete_all" on public.jugadores;
create policy "jugadores_delete_all" on public.jugadores for delete using (true);


create table if not exists public.asistencias (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  entrenamiento_id uuid not null references public.eventos(id) on delete cascade,
  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  estado text not null check (estado in ('Presente','Ausente','Tarde','Lesionado')),

  -- Control de carga fisica RPE (escala 1-10, semaforo deportivo en la app).
  rpe_valor integer check (rpe_valor between 1 and 10),
  rpe_nota text,

  -- Evita duplicar filas: guardar asistencia dos veces para el mismo jugador/entrenamiento
  -- actualiza el registro existente (se usa con upsert + onConflict desde la app).
  unique (entrenamiento_id, jugador_id)
);

-- Por si esta tabla ya existia de una corrida anterior (sin las columnas de RPE): seguro de
-- correr siempre.
alter table public.asistencias add column if not exists rpe_valor integer check (rpe_valor between 1 and 10);
alter table public.asistencias add column if not exists rpe_nota text;

create index if not exists asistencias_entrenamiento_idx on public.asistencias (entrenamiento_id);
create index if not exists asistencias_jugador_idx on public.asistencias (jugador_id);

drop trigger if exists asistencias_set_updated_at on public.asistencias;
create trigger asistencias_set_updated_at
before update on public.asistencias
for each row execute function public.set_updated_at_snake();

alter table public.asistencias enable row level security;

drop policy if exists "asistencias_select_all" on public.asistencias;
create policy "asistencias_select_all" on public.asistencias for select using (true);
drop policy if exists "asistencias_insert_all" on public.asistencias;
create policy "asistencias_insert_all" on public.asistencias for insert with check (true);
drop policy if exists "asistencias_update_all" on public.asistencias;
create policy "asistencias_update_all" on public.asistencias for update using (true);
drop policy if exists "asistencias_delete_all" on public.asistencias;
create policy "asistencias_delete_all" on public.asistencias for delete using (true);
