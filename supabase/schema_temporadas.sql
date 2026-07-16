-- Paso 1 de 2 (Plantel propio): separa "identidad de persona" (jugadores) de "membresia de
-- equipo por temporada" (jugador_temporada), para poder dar de baja a un jugador de una
-- temporada sin perder su historial (evaluaciones_pfs, notas, etc.) y para poder consultar
-- el plantel tal como estaba en una temporada pasada sin mezclarlo con la activa.
--
-- IMPORTANTE: "temporada" no es un anio unico para todo el club -- cada combinacion
-- Categoria+Tira puede jugar un torneo distinto en el mismo anio calendario (ej: Mayores
-- Blanca juega "Liga Metropolitana 2026", Mayores Azul juega "Copa de Oro 2026"). Por eso
-- cada fila de "temporadas" es una competencia puntual de UN equipo (categoria+tira), no del
-- club entero -- mismo criterio ya usado en equipos_rivales (una ficha por equipo puntual).
--
-- Requiere haber corrido supabase/schema_plantel.sql antes (reusa "jugadores" y la funcion
-- set_updated_at_snake()). Requiere supabase/schema_auth.sql (reusa mi_rol()).
--
-- Migracion 100% aditiva: no borra ni pisa ninguna columna existente de "jugadores". Las
-- columnas categoria_origen/tira/dorsal/equipos_adicionales de "jugadores" quedan intactas
-- (sin uso desde el frontend nuevo) hasta un script de limpieza aparte, que se corre a mano
-- dias despues de confirmar en produccion que todo funciona con el modelo nuevo.
--
-- Pegar este script completo en Supabase > SQL Editor > New query > Run.

create table if not exists public.temporadas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  nombre_competencia text not null,   -- ej: "Liga Metropolitana", "Copa de Oro", "Interconferencias B"
  anio integer not null,              -- ej: 2026 (para poder ir a buscar partidos historicos por anio)
  categoria text not null,
  tira text not null,
  activa boolean not null default false,

  unique (nombre_competencia, anio, categoria, tira)
);

-- Un unico torneo activo por equipo (categoria+tira) a la vez -- no por club entero. Dos
-- equipos distintos pueden tener cada uno su propia temporada activa simultaneamente.
create unique index if not exists temporadas_una_activa_por_equipo_idx
  on public.temporadas (categoria, tira) where activa;

create index if not exists temporadas_categoria_tira_idx on public.temporadas (categoria, tira);

alter table public.temporadas enable row level security;

drop policy if exists "temporadas_select_staff" on public.temporadas;
create policy "temporadas_select_staff" on public.temporadas for select to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

drop policy if exists "temporadas_insert_staff_completo" on public.temporadas;
create policy "temporadas_insert_staff_completo" on public.temporadas for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "temporadas_update_staff_completo" on public.temporadas;
create policy "temporadas_update_staff_completo" on public.temporadas for update to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

-- Sin policy de delete a proposito: una temporada con historial cargado no deberia poder
-- borrarse desde la app (evita perder jugador_temporada en cascada por error).


create table if not exists public.jugador_temporada (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  temporada_id uuid not null references public.temporadas(id) on delete cascade,

  dorsal integer,
  estado text not null default 'activo' check (estado in ('activo', 'baja')),

  -- Mismo formato que tenia jugadores.equipos_adicionales: [{"categoria":"Mayores","tira":"Blanca"}, ...]
  -- para jugadores que ademas juegan en otro equipo durante esta misma temporada.
  equipos_adicionales jsonb not null default '[]'::jsonb,

  unique (jugador_id, temporada_id)
);

create index if not exists jugador_temporada_temporada_idx on public.jugador_temporada (temporada_id);
create index if not exists jugador_temporada_jugador_idx on public.jugador_temporada (jugador_id);

drop trigger if exists jugador_temporada_set_updated_at on public.jugador_temporada;
create trigger jugador_temporada_set_updated_at
before update on public.jugador_temporada
for each row execute function public.set_updated_at_snake();

alter table public.jugador_temporada enable row level security;

drop policy if exists "jugador_temporada_select_staff" on public.jugador_temporada;
create policy "jugador_temporada_select_staff" on public.jugador_temporada for select to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

-- Solo staff completo: PF no da de alta/baja ni cambia dorsal/categoria (coincide con lo ya
-- documentado en CLAUDE.md -- en Plantel, PF solo edita campos medicos/fisicos, que viven en
-- "jugadores" y no en esta tabla).
drop policy if exists "jugador_temporada_insert_staff_completo" on public.jugador_temporada;
create policy "jugador_temporada_insert_staff_completo" on public.jugador_temporada for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "jugador_temporada_update_staff_completo" on public.jugador_temporada;
create policy "jugador_temporada_update_staff_completo" on public.jugador_temporada for update to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "jugador_temporada_delete_staff_completo" on public.jugador_temporada;
create policy "jugador_temporada_delete_staff_completo" on public.jugador_temporada for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));


-- Vista "aplanada": misma forma que hoy tienen las filas de jugadores (categoria_origen, tira,
-- dorsal, equipos_adicionales como nombres de columna), para que jugadorEnEquipo() y todo lo
-- que hoy consume un objeto "jugador" (asistencia, RPE, planes individuales, lesionados de
-- Inicio) siga funcionando sin cambios -- solo cambia de donde se trae el array en App().
-- "id" es el id de la PERSONA (jugadores.id), no el de esta fila puntual, porque asistencias,
-- jugador_partido_stats, alias_jugador y los diccionarios de RPE ya usan jugadores.id como
-- clave estable entre temporadas.
create or replace view public.vista_plantel_temporada as
select
  j.id,
  jt.id as jugador_temporada_id,
  j.nombre_apellido,
  j.posicion,
  j.altura,
  j.peso,
  j.fecha_nacimiento,
  j.notas_comentarios,
  j.disponibilidad,
  j.lesion_detalle,
  j.lesion_desde,
  j.evaluaciones_pfs,
  jt.temporada_id,
  t.nombre_competencia,
  t.anio,
  t.activa as temporada_activa,
  t.categoria as categoria_origen,
  t.tira,
  jt.dorsal,
  jt.estado,
  jt.equipos_adicionales,
  j.posicion_secundaria,
  j.dni
from public.jugador_temporada jt
join public.jugadores j on j.id = jt.jugador_id
join public.temporadas t on t.id = jt.temporada_id;

grant select on public.vista_plantel_temporada to authenticated;


-- ============================================================================
-- BACKFILL (una sola vez): migra los jugadores ya cargados hoy a este modelo nuevo, sin
-- perder nada. Por cada combinacion distinta de categoria_origen/tira que ya exista entre los
-- jugadores actuales, crea una temporada activa generica ("Temporada", 2026) -- el dueño puede
-- renombrarla despues con el torneo real de cada equipo desde la app. Es seguro re-correr esta
-- seccion: "on conflict do nothing" evita duplicar si el script ya se corrio antes, y el "not
-- exists" de mas abajo evita chocar contra el indice de "una activa por equipo" una vez que ese
-- equipo ya tiene una temporada activa real (aunque haya sido renombrada desde la app).
-- ============================================================================

insert into public.temporadas (nombre_competencia, anio, categoria, tira, activa)
select distinct 'Temporada', 2026, j.categoria_origen, j.tira, true
from public.jugadores j
where j.categoria_origen is not null and j.tira is not null
  and not exists (
    select 1 from public.temporadas t2
    where t2.categoria = j.categoria_origen and t2.tira = j.tira and t2.activa
  )
on conflict (nombre_competencia, anio, categoria, tira) do nothing;

insert into public.jugador_temporada (jugador_id, temporada_id, dorsal, estado, equipos_adicionales)
select
  j.id,
  t.id,
  j.dorsal,
  'activo',
  coalesce(j.equipos_adicionales, '[]'::jsonb)
from public.jugadores j
join public.temporadas t
  on t.categoria = j.categoria_origen and t.tira = j.tira and t.nombre_competencia = 'Temporada' and t.anio = 2026
where j.categoria_origen is not null and j.tira is not null
on conflict (jugador_id, temporada_id) do nothing;

notify pgrst, 'reload schema';
