-- Paso 2 de 2 (Scouting): equipos_rivales pasa a estar atado a una Temporada (torneo puntual de
-- un equipo propio), igual que jugador_temporada en el Paso 1 -- un club rival se scoutea de
-- nuevo cada competencia (plantel y enfoque tactico cambian ano a ano), asi que la ficha de
-- scouting no puede ser un acumulado global.
--
-- equipos_rivales ya tenia columnas categoria/tira (agregadas en schema_matriz_scouting_stats.sql
-- la semana pasada). Con temporada_id, esas columnas quedan redundantes -- mismo criterio que ya
-- se aplico en jugador_temporada (Paso 1): temporada_id pasa a ser la unica fuente de verdad, y
-- una vista deriva categoria/tira via join para que el resto de la app (Estadisticas, que ya lee
-- equipo.categoria/equipo.tira para el selector "Vincular equipo") siga funcionando sin cambios.
-- Las columnas categoria/tira crudas de equipos_rivales quedan sin uso desde el frontend nuevo,
-- listas para un script de limpieza aparte mas adelante (mismo criterio que con jugadores).
--
-- jugadores_rivales NO necesita su propia temporada_id: cuelga de equipo_rival_id y hereda la
-- temporada del equipo (su columna "categoria" existente es otra cosa, no se toca).
--
-- Requiere haber corrido supabase/schema_temporadas.sql y supabase/schema_matriz_scouting_stats.sql
-- antes. Pegar este script completo en Supabase > SQL Editor > New query > Run.

alter table public.equipos_rivales add column if not exists temporada_id uuid references public.temporadas(id) on delete cascade;

create index if not exists equipos_rivales_temporada_idx on public.equipos_rivales (temporada_id);

-- Vista "aplanada": misma forma que hoy tienen las filas de equipos_rivales (categoria/tira como
-- nombre de columna, derivados de la temporada), para que ScoutingHubView/EquipoRivalFicha y
-- Estadisticas (que ya filtra equiposRivales por .categoria/.tira) sigan funcionando igual.
create or replace view public.vista_equipos_rivales_temporada as
select
  er.id,
  er.nombre_club,
  er.logo_url,
  er.notas_colectivas,
  er.video_colectivo_url,
  er.id_estadistico_externo,
  er.temporada_id,
  t.nombre_competencia,
  t.anio,
  t.activa as temporada_activa,
  t.categoria,
  t.tira
from public.equipos_rivales er
left join public.temporadas t on t.id = er.temporada_id;

grant select on public.vista_equipos_rivales_temporada to authenticated;

-- ============================================================================
-- BACKFILL (una sola vez): vincula cada equipo rival ya cargado con categoria/tira a la
-- temporada activa de ese equipo -- reusando la temporada que ya haya creado el Paso 1 (Plantel)
-- para esa misma categoria/tira, o creando una nueva generica si todavia no existe ninguna. Los
-- equipos rivales sin categoria/tira asignada (los que hoy se ven en "Ver sin asignar" del
-- Scouting Hub) quedan con temporada_id en null, sin cambios -- se asignan a mano desde la app.
-- Seguro de re-correr: "on conflict do nothing" evita duplicar si ya se corrio antes.
-- ============================================================================

insert into public.temporadas (nombre_competencia, anio, categoria, tira, activa)
select distinct 'Temporada', 2026, er.categoria, er.tira, true
from public.equipos_rivales er
where er.categoria is not null and er.tira is not null
  and not exists (
    select 1 from public.temporadas t where t.categoria = er.categoria and t.tira = er.tira and t.activa
  )
on conflict (nombre_competencia, anio, categoria, tira) do nothing;

update public.equipos_rivales er
set temporada_id = t.id
from public.temporadas t
where er.temporada_id is null
  and er.categoria is not null and er.tira is not null
  and t.categoria = er.categoria and t.tira = er.tira and t.activa;

notify pgrst, 'reload schema';
