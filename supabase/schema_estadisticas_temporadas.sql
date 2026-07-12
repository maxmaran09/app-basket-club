-- Paso 3 de 3 (Estadisticas): partidos_stats pasa a estar atado a una Temporada (torneo puntual
-- de un equipo propio), igual que jugador_temporada (Paso 1) y equipos_rivales (Paso 2). Los
-- promedios de jugadores/equipos dejan de ser un acumulado de toda la vida y pasan a calcularse
-- por temporada.
--
-- partidos_stats ya tenia categoria_equipo/tira_equipo (agregadas en schema_matriz_scouting_stats.sql).
-- Con temporada_id, esas quedan redundantes -- mismo criterio que en jugador_temporada y
-- equipos_rivales: temporada_id pasa a ser la unica fuente de verdad, categoria_equipo/tira_equipo
-- quedan sin uso desde el frontend nuevo (no se borran todavia).
--
-- jugador_partido_stats y equipo_partido_stats NO necesitan su propia temporada_id: cuelgan de
-- partido_id (on delete cascade ya existente) y heredan la temporada del partido.
--
-- Requiere haber corrido supabase/schema_temporadas.sql y supabase/schema_stats.sql antes.
-- Pegar este script completo en Supabase > SQL Editor > New query > Run.

alter table public.partidos_stats add column if not exists temporada_id uuid references public.temporadas(id) on delete cascade;

create index if not exists partidos_stats_temporada_idx on public.partidos_stats (temporada_id);

-- ============================================================================
-- Vistas de promedios: ahora agrupan tambien por temporada (via join a partidos_stats), para
-- que "los ultimos partidos" de un jugador/equipo se puedan cortar por competencia en vez de
-- promediar toda su historia. Se recrean con drop+create porque cambia la lista de columnas
-- (agregan temporada_id) -- "create or replace view" no permite eso en Postgres.
-- ============================================================================

drop view if exists public.vista_promedios_jugador;
create view public.vista_promedios_jugador as
select
  max(jps.jugador_id::text)::uuid as jugador_id,
  max(jps.jugador_rival_id::text)::uuid as jugador_rival_id,
  max(jps.nombre_jugador) as nombre_jugador,
  jps.equipo,
  ps.temporada_id,
  count(*) as pj,
  round(avg(jps.minutos)::numeric, 1) as min_prom,
  round(avg(jps.pts)::numeric, 1) as pts_prom,
  round(avg(jps.t2a)::numeric, 1) as t2a_prom,
  round(avg(jps.t2i)::numeric, 1) as t2i_prom,
  round(avg(jps.t3a)::numeric, 1) as t3a_prom,
  round(avg(jps.t3i)::numeric, 1) as t3i_prom,
  round(avg(jps.t1a)::numeric, 1) as t1a_prom,
  round(avg(jps.t1i)::numeric, 1) as t1i_prom,
  round(avg(jps.rdef)::numeric, 1) as rdef_prom,
  round(avg(jps.rof)::numeric, 1) as rof_prom,
  round(avg(jps.rtot)::numeric, 1) as rtot_prom,
  round(avg(jps.ast)::numeric, 1) as ast_prom,
  round(avg(jps.rec)::numeric, 1) as rec_prom,
  round(avg(jps.per)::numeric, 1) as per_prom,
  round(avg(jps.val)::numeric, 1) as val_prom,
  round(avg(jps.play)::numeric, 2) as play_prom,
  round(avg(jps.pos)::numeric, 2) as pos_prom,
  round(avg(jps.pplay)::numeric, 3) as pplay_prom,
  round(avg(jps.ppos)::numeric, 3) as ppos_prom,
  round(avg(jps.tov_pct)::numeric, 3) as tov_pct_prom,
  round(avg(jps.efg_pct)::numeric, 3) as efg_pct_prom
from public.jugador_partido_stats jps
join public.partidos_stats ps on ps.id = jps.partido_id
group by coalesce(jps.jugador_id::text, 'r:' || jps.jugador_rival_id::text, 'n:' || lower(trim(jps.nombre_jugador))), jps.equipo, ps.temporada_id;

drop view if exists public.vista_totales_equipo_partido;
create view public.vista_totales_equipo_partido as
select jps.partido_id, jps.equipo, ps.temporada_id,
  sum(jps.pts) as pts,
  sum(jps.t2a) as t2a, sum(jps.t2i) as t2i,
  sum(jps.t3a) as t3a, sum(jps.t3i) as t3i,
  sum(jps.t1a) as t1a, sum(jps.t1i) as t1i,
  sum(jps.rdef) as rdef, sum(jps.rof) as rof, sum(jps.rtot) as rtot,
  sum(jps.ast) as ast, sum(jps.rec) as rec, sum(jps.per) as per,
  sum(jps.val) as val
from public.jugador_partido_stats jps
join public.partidos_stats ps on ps.id = jps.partido_id
group by jps.partido_id, jps.equipo, ps.temporada_id;

drop view if exists public.vista_promedios_equipo;
create view public.vista_promedios_equipo as
select
  max(eps.equipo_rival_id::text)::uuid as equipo_rival_id,
  max(eps.equipo) as equipo,
  ps.temporada_id,
  count(*) as pj,
  round(avg(eps.pts)::numeric, 1) as pts_prom,
  round(avg(eps.t2a)::numeric, 1) as t2a_prom,
  round(avg(eps.t2i)::numeric, 1) as t2i_prom,
  round(avg(eps.t3a)::numeric, 1) as t3a_prom,
  round(avg(eps.t3i)::numeric, 1) as t3i_prom,
  round(avg(eps.t1a)::numeric, 1) as t1a_prom,
  round(avg(eps.t1i)::numeric, 1) as t1i_prom,
  round(avg(eps.rdef)::numeric, 1) as rdef_prom,
  round(avg(eps.rof)::numeric, 1) as rof_prom,
  round(avg(eps.rtot)::numeric, 1) as rtot_prom,
  round(avg(eps.ast)::numeric, 1) as ast_prom,
  round(avg(eps.rec)::numeric, 1) as rec_prom,
  round(avg(eps.per)::numeric, 1) as per_prom,
  round(avg(eps.val)::numeric, 1) as val_prom,
  round(avg(eps.efg_pct)::numeric, 3) as efg_pct_prom
from public.equipo_partido_stats eps
join public.partidos_stats ps on ps.id = eps.partido_id
group by coalesce(eps.equipo_rival_id::text, 'n:' || lower(trim(eps.equipo))), ps.temporada_id;

drop view if exists public.vista_record_equipo;
create view public.vista_record_equipo as
select equipo, condicion, temporada_id,
  count(*) as jugados,
  count(*) filter (where resultado = 'W') as ganados,
  count(*) filter (where resultado = 'L') as perdidos
from (
  select equipo_local as equipo, 'LOCAL' as condicion, temporada_id,
    case when resultado_local > resultado_visitante then 'W' else 'L' end as resultado
  from public.partidos_stats
  where resultado_local is not null and resultado_visitante is not null
  union all
  select equipo_visitante as equipo, 'VISITANTE' as condicion, temporada_id,
    case when resultado_visitante > resultado_local then 'W' else 'L' end as resultado
  from public.partidos_stats
  where resultado_local is not null and resultado_visitante is not null
) t
group by equipo, condicion, temporada_id;

grant select on public.vista_promedios_jugador to anon, authenticated;
grant select on public.vista_totales_equipo_partido to anon, authenticated;
grant select on public.vista_promedios_equipo to anon, authenticated;
grant select on public.vista_record_equipo to anon, authenticated;

-- ============================================================================
-- BACKFILL (una sola vez): vincula cada partido ya cargado con categoria_equipo/tira_equipo a
-- la temporada activa de ese equipo -- reusando la que hayan creado los Pasos 1/2 para esa misma
-- categoria/tira, o creando una generica si todavia no existe ninguna. Los partidos sin
-- categoria_equipo/tira_equipo asignada quedan con temporada_id en null (mismo estado "sin
-- asignar" que ya se ve hoy en la pantalla de Estadisticas). Seguro de re-correr.
-- ============================================================================

insert into public.temporadas (nombre_competencia, anio, categoria, tira, activa)
select distinct 'Temporada', 2026, ps.categoria_equipo, ps.tira_equipo, true
from public.partidos_stats ps
where ps.categoria_equipo is not null and ps.tira_equipo is not null
  and not exists (
    select 1 from public.temporadas t where t.categoria = ps.categoria_equipo and t.tira = ps.tira_equipo and t.activa
  )
on conflict (nombre_competencia, anio, categoria, tira) do nothing;

update public.partidos_stats ps
set temporada_id = t.id
from public.temporadas t
where ps.temporada_id is null
  and ps.categoria_equipo is not null and ps.tira_equipo is not null
  and t.categoria = ps.categoria_equipo and t.tira = ps.tira_equipo and t.activa;

notify pgrst, 'reload schema';
