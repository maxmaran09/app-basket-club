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

-- Totales de equipo por partido, tal cual la fila TOTALES del PDF (una fila por lado). Se puede
-- vincular a un equipo ya cargado en Scouting Hub (equipo_rival_id), igual que se vincula un
-- jugador con jugador_id/jugador_rival_id en jugador_partido_stats.
create table if not exists public.equipo_partido_stats (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  partido_id uuid not null references public.partidos_stats(id) on delete cascade,
  equipo text not null,
  condicion text not null check (condicion in ('LOCAL','VISITANTE')),
  equipo_rival_id uuid references public.equipos_rivales(id) on delete set null,

  pts integer,
  t2a integer, t2i integer,
  t3a integer, t3i integer,
  t1a integer, t1i integer,
  rdef integer, rof integer, rtot integer,
  ast integer, rec integer, per integer,
  tc integer, tr integer,
  fc integer, fr integer,
  val integer,
  efg_pct numeric(6,3),

  unique (partido_id, condicion)
);

create index if not exists equipo_partido_stats_partido_idx on public.equipo_partido_stats (partido_id);
create index if not exists equipo_partido_stats_equipo_rival_idx on public.equipo_partido_stats (equipo_rival_id);

drop trigger if exists equipo_partido_stats_set_updated_at on public.equipo_partido_stats;
create trigger equipo_partido_stats_set_updated_at
before update on public.equipo_partido_stats
for each row execute function public.set_updated_at();

alter table public.equipo_partido_stats enable row level security;
drop policy if exists "equipo_partido_stats_select_all" on public.equipo_partido_stats;
create policy "equipo_partido_stats_select_all" on public.equipo_partido_stats for select using (true);
drop policy if exists "equipo_partido_stats_insert_all" on public.equipo_partido_stats;
create policy "equipo_partido_stats_insert_all" on public.equipo_partido_stats for insert with check (true);
drop policy if exists "equipo_partido_stats_update_all" on public.equipo_partido_stats;
create policy "equipo_partido_stats_update_all" on public.equipo_partido_stats for update using (true);
drop policy if exists "equipo_partido_stats_delete_all" on public.equipo_partido_stats;
create policy "equipo_partido_stats_delete_all" on public.equipo_partido_stats for delete using (true);

-- Totales de equipo por partido sumando jugadores (referencia/cruce, no la fuente principal).
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

-- Promedios de equipo a partir de las filas TOTALES oficiales de cada partido (agrupa por
-- equipo_rival_id cuando esta vinculado, si no por nombre, igual que vista_promedios_jugador).
drop view if exists public.vista_promedios_equipo;
create view public.vista_promedios_equipo as
select
  max(equipo_rival_id::text)::uuid as equipo_rival_id,
  max(equipo) as equipo,
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
  round(avg(efg_pct)::numeric, 3) as efg_pct_prom
from public.equipo_partido_stats
group by coalesce(equipo_rival_id::text, 'n:' || lower(trim(equipo)));

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

-- Alias: recuerda que nombre EXACTO (normalizado) tal como aparece en un PDF corresponde a que
-- equipo/jugador ya cargado, para no tener que vincular a mano cada vez que subís un PDF del
-- mismo equipo o jugador. Coincidencia exacta a propósito (no "parecida"), para no vincular mal
-- a alguien por error — si el nombre viene escrito distinto, se vincula una vez más a mano y
-- ahí queda guardado ese nuevo alias tambien.
create table if not exists public.alias_equipo (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre_pdf text not null unique,
  equipo_rival_id uuid not null references public.equipos_rivales(id) on delete cascade
);

alter table public.alias_equipo enable row level security;
drop policy if exists "alias_equipo_select_all" on public.alias_equipo;
create policy "alias_equipo_select_all" on public.alias_equipo for select using (true);
drop policy if exists "alias_equipo_insert_all" on public.alias_equipo;
create policy "alias_equipo_insert_all" on public.alias_equipo for insert with check (true);
drop policy if exists "alias_equipo_update_all" on public.alias_equipo;
create policy "alias_equipo_update_all" on public.alias_equipo for update using (true);
drop policy if exists "alias_equipo_delete_all" on public.alias_equipo;
create policy "alias_equipo_delete_all" on public.alias_equipo for delete using (true);

create table if not exists public.alias_jugador (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre_pdf text not null unique,
  jugador_id uuid not null references public.jugadores(id) on delete cascade
);

alter table public.alias_jugador enable row level security;
drop policy if exists "alias_jugador_select_all" on public.alias_jugador;
create policy "alias_jugador_select_all" on public.alias_jugador for select using (true);
drop policy if exists "alias_jugador_insert_all" on public.alias_jugador;
create policy "alias_jugador_insert_all" on public.alias_jugador for insert with check (true);
drop policy if exists "alias_jugador_update_all" on public.alias_jugador;
create policy "alias_jugador_update_all" on public.alias_jugador for update using (true);
drop policy if exists "alias_jugador_delete_all" on public.alias_jugador;
create policy "alias_jugador_delete_all" on public.alias_jugador for delete using (true);

-- Un jugador rival se guarda por nombre + equipo (el mismo apellido puede repetirse en dos
-- equipos distintos, asi que el alias queda acotado a ese equipo puntual).
create table if not exists public.alias_jugador_rival (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre_pdf text not null,
  equipo_rival_id uuid not null references public.equipos_rivales(id) on delete cascade,
  jugador_rival_id uuid not null references public.jugadores_rivales(id) on delete cascade,
  unique (nombre_pdf, equipo_rival_id)
);

alter table public.alias_jugador_rival enable row level security;
drop policy if exists "alias_jugador_rival_select_all" on public.alias_jugador_rival;
create policy "alias_jugador_rival_select_all" on public.alias_jugador_rival for select using (true);
drop policy if exists "alias_jugador_rival_insert_all" on public.alias_jugador_rival;
create policy "alias_jugador_rival_insert_all" on public.alias_jugador_rival for insert with check (true);
drop policy if exists "alias_jugador_rival_update_all" on public.alias_jugador_rival;
create policy "alias_jugador_rival_update_all" on public.alias_jugador_rival for update using (true);
drop policy if exists "alias_jugador_rival_delete_all" on public.alias_jugador_rival;
create policy "alias_jugador_rival_delete_all" on public.alias_jugador_rival for delete using (true);

grant select on public.vista_promedios_jugador to anon, authenticated;
grant select on public.vista_totales_equipo_partido to anon, authenticated;
grant select on public.vista_promedios_equipo to anon, authenticated;
grant select on public.vista_record_equipo to anon, authenticated;

grant select, insert, update, delete on public.partidos_stats to anon, authenticated;
grant select, insert, update, delete on public.jugador_partido_stats to anon, authenticated;
grant select, insert, update, delete on public.equipo_partido_stats to anon, authenticated;
grant select, insert, update, delete on public.alias_equipo to anon, authenticated;
grant select, insert, update, delete on public.alias_jugador to anon, authenticated;
grant select, insert, update, delete on public.alias_jugador_rival to anon, authenticated;

notify pgrst, 'reload schema';
