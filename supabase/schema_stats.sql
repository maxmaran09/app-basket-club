-- Modulo de Estadisticas: carga de PDFs de la CABB, guardado de box scores por partido/jugador
-- y vistas de promedios/record. Requiere haber corrido supabase/schema.sql y schema_plantel.sql
-- antes (reusa "eventos", "jugadores", "jugadores_rivales" y la funcion set_updated_at()).
--
-- Pegar este script completo en Supabase > SQL Editor > New query > Run.

create table if not exists public.partidos_stats (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  fecha date not null,
  torneo text,
  categoria text,
  equipo_local text not null,
  equipo_visitante text not null,
  resultado_local integer,
  resultado_visitante integer,

  -- Si este partido ya esta cargado como evento tipo "partido" en el calendario propio.
  evento_id uuid references public.eventos(id) on delete set null,

  unique (fecha, equipo_local, equipo_visitante)
);

drop trigger if exists partidos_stats_set_updated_at on public.partidos_stats;
create trigger partidos_stats_set_updated_at
before update on public.partidos_stats
for each row execute function public.set_updated_at();

alter table public.partidos_stats enable row level security;
drop policy if exists "partidos_stats_select_all" on public.partidos_stats;
create policy "partidos_stats_select_all" on public.partidos_stats for select using (true);
drop policy if exists "partidos_stats_insert_all" on public.partidos_stats;
create policy "partidos_stats_insert_all" on public.partidos_stats for insert with check (true);
drop policy if exists "partidos_stats_update_all" on public.partidos_stats;
create policy "partidos_stats_update_all" on public.partidos_stats for update using (true);
drop policy if exists "partidos_stats_delete_all" on public.partidos_stats;
create policy "partidos_stats_delete_all" on public.partidos_stats for delete using (true);


create table if not exists public.jugador_partido_stats (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  partido_id uuid not null references public.partidos_stats(id) on delete cascade,

  -- Vinculo opcional a un jugador propio o rival ya cargado. Si todavia no existe en ninguna
  -- tabla, se guarda igual con el nombre suelto (se puede vincular despues a mano).
  jugador_id uuid references public.jugadores(id) on delete set null,
  jugador_rival_id uuid references public.jugadores_rivales(id) on delete set null,
  nombre_jugador text not null,
  equipo text not null,
  dorsal integer,

  minutos numeric(5,2),
  pts integer,
  t2a integer, t2i integer,
  t3a integer, t3i integer,
  t1a integer, t1i integer,
  rdef integer, rof integer, rtot integer,
  ast integer, rec integer, per integer,
  tc integer, tr integer,
  fc integer, fr integer,
  val integer,
  plusminus integer,

  -- Metricas avanzadas calculadas al procesar el PDF (formulas verificadas contra el script
  -- Power Query del usuario): PLAY = T2I+T3I+0.44*T1I+PER, POS = PLAY-ROF,
  -- PPLAY = PTS/PLAY, PPOS = PTS/POS, TOV% = PER/PLAY, eFG% = (T2A+1.5*T3A)/(T2I+T3I).
  play numeric(6,2),
  pos numeric(6,2),
  pplay numeric(6,3),
  ppos numeric(6,3),
  tov_pct numeric(6,3),
  efg_pct numeric(6,3),

  unique (partido_id, nombre_jugador, equipo)
);

create index if not exists jugador_partido_stats_partido_idx on public.jugador_partido_stats (partido_id);
create index if not exists jugador_partido_stats_jugador_idx on public.jugador_partido_stats (jugador_id);
create index if not exists jugador_partido_stats_jugador_rival_idx on public.jugador_partido_stats (jugador_rival_id);

drop trigger if exists jugador_partido_stats_set_updated_at on public.jugador_partido_stats;
create trigger jugador_partido_stats_set_updated_at
before update on public.jugador_partido_stats
for each row execute function public.set_updated_at();

alter table public.jugador_partido_stats enable row level security;
drop policy if exists "jugador_partido_stats_select_all" on public.jugador_partido_stats;
create policy "jugador_partido_stats_select_all" on public.jugador_partido_stats for select using (true);
drop policy if exists "jugador_partido_stats_insert_all" on public.jugador_partido_stats;
create policy "jugador_partido_stats_insert_all" on public.jugador_partido_stats for insert with check (true);
drop policy if exists "jugador_partido_stats_update_all" on public.jugador_partido_stats;
create policy "jugador_partido_stats_update_all" on public.jugador_partido_stats for update using (true);
drop policy if exists "jugador_partido_stats_delete_all" on public.jugador_partido_stats;
create policy "jugador_partido_stats_delete_all" on public.jugador_partido_stats for delete using (true);


-- Promedios por jugador (agrupa por jugador_id / jugador_rival_id / nombre, lo que este mas
-- especifico primero, para que el mismo jugador sume partidos aunque el nombre varie un poco).
create or replace view public.vista_promedios_jugador as
select
  max(jugador_id::text)::uuid as jugador_id,
  max(jugador_rival_id::text)::uuid as jugador_rival_id,
  max(nombre_jugador) as nombre_jugador,
  equipo,
  count(*) as pj,
  round(avg(minutos)::numeric, 1) as min_prom,
  round(avg(pts)::numeric, 1) as pts_prom,
  round(avg(t2a)::numeric, 1) as t2a_prom,
  round(avg(t2i)::numeric, 1) as t2i_prom,
  round(avg(t3a)::numeric, 1) as t3a_prom,
  round(avg(t3i)::numeric, 1) as t3i_prom,
  round(avg(t1a)::numeric, 1) as t1a_prom,
  round(avg(t1i)::numeric, 1) as t1i_prom,
  round(avg(rdef)::numeric, 1) as rdef_prom,
  round(avg(rof)::numeric, 1) as rof_prom,
  round(avg(rtot)::numeric, 1) as rtot_prom,
  round(avg(ast)::numeric, 1) as ast_prom,
  round(avg(rec)::numeric, 1) as rec_prom,
  round(avg(per)::numeric, 1) as per_prom,
  round(avg(val)::numeric, 1) as val_prom,
  round(avg(play)::numeric, 2) as play_prom,
  round(avg(pos)::numeric, 2) as pos_prom,
  round(avg(pplay)::numeric, 3) as pplay_prom,
  round(avg(ppos)::numeric, 3) as ppos_prom,
  round(avg(tov_pct)::numeric, 3) as tov_pct_prom,
  round(avg(efg_pct)::numeric, 3) as efg_pct_prom
from public.jugador_partido_stats
group by coalesce(jugador_id::text, 'r:' || jugador_rival_id::text, 'n:' || lower(trim(nombre_jugador))), equipo;

-- Totales de equipo por partido (suma de sus jugadores en ese partido puntual).
create or replace view public.vista_totales_equipo_partido as
select partido_id, equipo,
  sum(pts) as pts,
  sum(t2a) as t2a, sum(t2i) as t2i,
  sum(t3a) as t3a, sum(t3i) as t3i,
  sum(t1a) as t1a, sum(t1i) as t1i,
  sum(rdef) as rdef, sum(rof) as rof, sum(rtot) as rtot,
  sum(ast) as ast, sum(rec) as rec, sum(per) as per,
  sum(val) as val
from public.jugador_partido_stats
group by partido_id, equipo;

-- Promedios de equipo (a partir de los totales por partido, no de sumar jugadores sueltos).
create or replace view public.vista_promedios_equipo as
select equipo,
  count(*) as pj,
  round(avg(pts)::numeric, 1) as pts_prom,
  round(avg(t2a)::numeric, 1) as t2a_prom,
  round(avg(t2i)::numeric, 1) as t2i_prom,
  round(avg(t3a)::numeric, 1) as t3a_prom,
  round(avg(t3i)::numeric, 1) as t3i_prom,
  round(avg(t1a)::numeric, 1) as t1a_prom,
  round(avg(t1i)::numeric, 1) as t1i_prom,
  round(avg(rdef)::numeric, 1) as rdef_prom,
  round(avg(rof)::numeric, 1) as rof_prom,
  round(avg(rtot)::numeric, 1) as rtot_prom,
  round(avg(ast)::numeric, 1) as ast_prom,
  round(avg(rec)::numeric, 1) as rec_prom,
  round(avg(per)::numeric, 1) as per_prom,
  round(avg(val)::numeric, 1) as val_prom,
  round((sum(t2a) + 0.5 * sum(t3a))::numeric / nullif(sum(t2i) + sum(t3i), 0), 3) as efg_pct_prom
from public.vista_totales_equipo_partido
group by equipo;

-- Record de partidos ganados/perdidos por equipo, separado por local/visitante.
create or replace view public.vista_record_equipo as
select equipo, condicion,
  count(*) as jugados,
  count(*) filter (where resultado = 'W') as ganados,
  count(*) filter (where resultado = 'L') as perdidos
from (
  select equipo_local as equipo, 'LOCAL' as condicion,
    case when resultado_local > resultado_visitante then 'W' else 'L' end as resultado
  from public.partidos_stats
  where resultado_local is not null and resultado_visitante is not null
  union all
  select equipo_visitante as equipo, 'VISITANTE' as condicion,
    case when resultado_visitante > resultado_local then 'W' else 'L' end as resultado
  from public.partidos_stats
  where resultado_local is not null and resultado_visitante is not null
) t
group by equipo, condicion;

grant select on public.vista_promedios_jugador to anon, authenticated;
grant select on public.vista_totales_equipo_partido to anon, authenticated;
grant select on public.vista_promedios_equipo to anon, authenticated;
grant select on public.vista_record_equipo to anon, authenticated;

grant select, insert, update, delete on public.partidos_stats to anon, authenticated;
grant select, insert, update, delete on public.jugador_partido_stats to anon, authenticated;

notify pgrst, 'reload schema';
