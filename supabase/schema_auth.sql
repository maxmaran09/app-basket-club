-- Auth + Roles (RBAC). Requiere haber corrido supabase/schema.sql, schema_plantel.sql,
-- schema_scouting.sql, schema_stats.sql y schema_dashboard.sql antes.
--
-- IMPORTANTE - orden de ejecucion en produccion (la app ya esta en uso real):
--   1. Activar Supabase Auth (Authentication > Providers > Email, ya deberia estar activo).
--   2. Crear en Authentication > Users una cuenta por cada persona del staff actual
--      (y de los jugadores, si van a tener login ya mismo).
--   3. Correr este script completo.
--   4. Para cada usuario creado en el paso 2, insertar su fila en perfiles, por ejemplo:
--        insert into public.perfiles (id, nombre_completo, rol)
--        values ('<uuid del usuario en auth.users>', 'Nombre Apellido', 'head_coach');
--      Para un jugador, ademas hay que setear jugador_id:
--        insert into public.perfiles (id, nombre_completo, rol, jugador_id)
--        values ('<uuid>', 'Nombre Apellido', 'jugador', '<id de su fila en jugadores>');
--   5. Recien ahi el login funciona para todos. Si se corre este script ANTES de crear las
--      cuentas/perfiles del paso 2-4, la app queda inutilizable para todo el staff hasta que
--      cada uno tenga su fila en perfiles (las policies de abajo dependen de mi_rol()).
--
-- Pegar este script completo en Supabase > SQL Editor > New query > Run.

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text,
  rol text not null check (rol in ('head_coach', 'asistente_tecnico', 'preparador_fisico', 'jugador')),
  -- Solo se completa cuando rol = 'jugador': a que fila de "jugadores" corresponde este login,
  -- para poder filtrar su Calendario por su propia categoria/tira.
  jugador_id uuid references public.jugadores(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.perfiles enable row level security;

-- Funciones helper para usar dentro de las policies de RLS de todas las tablas. security
-- definer + search_path fijo para que no dependan de (ni sean secuestrables por) el
-- search_path de quien las llama, y para poder leer "perfiles"/"jugadores" aunque la policy
-- de esas tablas le niegue el select directo al rol que está consultando (ej: un jugador no
-- puede hacer select de "jugadores", pero necesita que esta función resuelva su categoria/tira).
-- Ademas, al ser security definer, esta funcion corre sin pasar por RLS (el dueño de la
-- funcion hace de "puente" con privilegios propios) -- por eso hay que usarla DENTRO de la
-- policy de "perfiles" en vez de un subselect a la propia tabla: un subselect directo a
-- "perfiles" desde su propia policy dispara la misma policy de nuevo (para poder resolver
-- CADA fila candidata) y termina en "infinite recursion detected in policy for relation
-- perfiles" -- pasando por la funcion se corta la recursion.
create or replace function public.mi_rol()
returns text
language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid();
$$;

drop policy if exists "perfiles_select_propio_o_staff" on public.perfiles;
create policy "perfiles_select_propio_o_staff" on public.perfiles for select to authenticated
  using (
    id = auth.uid()
    or public.mi_rol() in ('head_coach', 'asistente_tecnico')
  );
-- Sin policies de insert/update/delete: los perfiles se administran a mano desde el SQL
-- Editor (o el dashboard), nunca desde la app con la anon/authenticated key.

create or replace function public.mi_jugador_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select jugador_id from public.perfiles where id = auth.uid();
$$;

create or replace function public.mi_categoria()
returns text
language sql stable security definer set search_path = public as $$
  select j.categoria_origen from public.jugadores j
  join public.perfiles p on p.jugador_id = j.id
  where p.id = auth.uid();
$$;

create or replace function public.mi_tira()
returns text
language sql stable security definer set search_path = public as $$
  select j.tira from public.jugadores j
  join public.perfiles p on p.jugador_id = j.id
  where p.id = auth.uid();
$$;

-- Vista de solo lectura para que un Jugador vea EN SU CALENDARIO que hay entrenamiento/plan
-- individual tal dia, sin exponerle las columnas sensibles (bloques, objetivoSemana,
-- planesIndividuales de sus compañeros) que viven en esas mismas filas de "eventos". Se crea
-- sin "security_invoker" (igual que vista_promedios_jugador en schema_stats.sql), asi corre
-- con los privilegios de quien la creo y no la bloquea la policy restrictiva de "eventos" para
-- el rol jugador (ver mas abajo) — la vista es la unica puerta a esas fechas, y solo deja
-- pasar 6 columnas inofensivas.
create or replace view public.vista_calendario_jugador as
select e.id, e.date, e.type, e.categoria, e.tira, e.title
from public.eventos e
where e.type in ('entrenamiento', 'individual')
  and e.categoria = public.mi_categoria()
  and e.tira = public.mi_tira()
  and (
    e.type = 'entrenamiento'
    or exists (
      select 1 from jsonb_array_elements(e."planesIndividuales") el
      where (el ->> 'jugadorId')::uuid = public.mi_jugador_id()
    )
  );

grant select on public.vista_calendario_jugador to authenticated;

-- ============================================================================
-- Policies por tabla. Reemplazan los "using (true)" abiertos originales (MVP sin login) por
-- reglas basadas en mi_rol(). head_coach y asistente_tecnico siempre tienen acceso total.
-- ============================================================================

-- jugadores: Plantel propio. PF puede leer y actualizar (fichas medicas/fisicas se resuelven
-- solo en la interfaz, ver notas del proyecto), pero no dar de alta ni borrar jugadores.
-- Jugador no tiene acceso directo (no es una de sus 2 secciones permitidas).
drop policy if exists "jugadores_select_all" on public.jugadores;
create policy "jugadores_select_all" on public.jugadores for select to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

drop policy if exists "jugadores_insert_all" on public.jugadores;
create policy "jugadores_insert_all" on public.jugadores for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "jugadores_update_all" on public.jugadores;
create policy "jugadores_update_all" on public.jugadores for update to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

drop policy if exists "jugadores_delete_all" on public.jugadores;
create policy "jugadores_delete_all" on public.jugadores for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

-- asistencias: control de carga fisica (RPE) por jugador. PF puede leer/cargar/corregir, pero
-- no borrar registros.
drop policy if exists "asistencias_select_all" on public.asistencias;
create policy "asistencias_select_all" on public.asistencias for select to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

drop policy if exists "asistencias_insert_all" on public.asistencias;
create policy "asistencias_insert_all" on public.asistencias for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

drop policy if exists "asistencias_update_all" on public.asistencias;
create policy "asistencias_update_all" on public.asistencias for update to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

drop policy if exists "asistencias_delete_all" on public.asistencias;
create policy "asistencias_delete_all" on public.asistencias for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

-- eventos: Calendario (entrenamiento/partido/individual/libre/optativo/especial), una sola
-- tabla polimorfica. PF navega libremente (la interfaz le limita que puede escribir dentro de
-- cada ficha). Jugador SOLO ve filas de tipo partido/libre/optativo/especial de su propia
-- categoria/tira -- nunca entrenamiento/individual (esas sensibles quedan afuera de esta
-- policy a proposito, ver vista_calendario_jugador mas arriba para el motivo).
drop policy if exists "eventos_select_all" on public.eventos;
create policy "eventos_select_all" on public.eventos for select to authenticated
  using (
    public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico')
    or (
      public.mi_rol() = 'jugador'
      and type in ('partido', 'libre', 'optativo', 'especial')
      and categoria = public.mi_categoria()
      and tira = public.mi_tira()
    )
  );

drop policy if exists "eventos_insert_all" on public.eventos;
create policy "eventos_insert_all" on public.eventos for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "eventos_update_all" on public.eventos;
create policy "eventos_update_all" on public.eventos for update to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

drop policy if exists "eventos_delete_all" on public.eventos;
create policy "eventos_delete_all" on public.eventos for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

-- equipos_rivales / jugadores_rivales: Scouting Hub. Lectura universal (PF y Jugador incluidos,
-- es una de las 2 secciones permitidas de Jugador); escritura solo staff completo.
drop policy if exists "equipos_rivales_select_all" on public.equipos_rivales;
create policy "equipos_rivales_select_all" on public.equipos_rivales for select to authenticated
  using (true);

drop policy if exists "equipos_rivales_insert_all" on public.equipos_rivales;
create policy "equipos_rivales_insert_all" on public.equipos_rivales for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "equipos_rivales_update_all" on public.equipos_rivales;
create policy "equipos_rivales_update_all" on public.equipos_rivales for update to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "equipos_rivales_delete_all" on public.equipos_rivales;
create policy "equipos_rivales_delete_all" on public.equipos_rivales for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "jugadores_rivales_select_all" on public.jugadores_rivales;
create policy "jugadores_rivales_select_all" on public.jugadores_rivales for select to authenticated
  using (true);

drop policy if exists "jugadores_rivales_insert_all" on public.jugadores_rivales;
create policy "jugadores_rivales_insert_all" on public.jugadores_rivales for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "jugadores_rivales_update_all" on public.jugadores_rivales;
create policy "jugadores_rivales_update_all" on public.jugadores_rivales for update to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "jugadores_rivales_delete_all" on public.jugadores_rivales;
create policy "jugadores_rivales_delete_all" on public.jugadores_rivales for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

-- notas_staff: tablon de alertas/notas del dashboard (Inicio). PF tiene acceso total (es
-- explicitamente parte de su rol); Jugador no entra a Inicio, sin policy = sin acceso.
drop policy if exists "notas_staff_select_all" on public.notas_staff;
create policy "notas_staff_select_all" on public.notas_staff for select to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

drop policy if exists "notas_staff_insert_all" on public.notas_staff;
create policy "notas_staff_insert_all" on public.notas_staff for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

drop policy if exists "notas_staff_update_all" on public.notas_staff;
create policy "notas_staff_update_all" on public.notas_staff for update to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

drop policy if exists "notas_staff_delete_all" on public.notas_staff;
create policy "notas_staff_delete_all" on public.notas_staff for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

-- Estadisticas (partidos_stats, jugador_partido_stats, equipo_partido_stats, alias_*): PF
-- tiene lectura (puede consultar partidos/promedios ya cargados) pero no escritura (no sube
-- PDFs ni edita nada); Jugador sigue sin ningun acceso (no es una de sus 2 secciones). Las
-- vistas agregadas (vista_promedios_jugador, vista_promedios_equipo, etc.) NO se tocan: siguen
-- sin RLS propia y bypasean estas policies igual que antes.
drop policy if exists "partidos_stats_select_all" on public.partidos_stats;
create policy "partidos_stats_select_all" on public.partidos_stats for select to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));
drop policy if exists "partidos_stats_insert_all" on public.partidos_stats;
create policy "partidos_stats_insert_all" on public.partidos_stats for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico'));
drop policy if exists "partidos_stats_update_all" on public.partidos_stats;
create policy "partidos_stats_update_all" on public.partidos_stats for update to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));
drop policy if exists "partidos_stats_delete_all" on public.partidos_stats;
create policy "partidos_stats_delete_all" on public.partidos_stats for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "jugador_partido_stats_select_all" on public.jugador_partido_stats;
create policy "jugador_partido_stats_select_all" on public.jugador_partido_stats for select to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));
drop policy if exists "jugador_partido_stats_insert_all" on public.jugador_partido_stats;
create policy "jugador_partido_stats_insert_all" on public.jugador_partido_stats for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico'));
drop policy if exists "jugador_partido_stats_update_all" on public.jugador_partido_stats;
create policy "jugador_partido_stats_update_all" on public.jugador_partido_stats for update to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));
drop policy if exists "jugador_partido_stats_delete_all" on public.jugador_partido_stats;
create policy "jugador_partido_stats_delete_all" on public.jugador_partido_stats for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "equipo_partido_stats_select_all" on public.equipo_partido_stats;
create policy "equipo_partido_stats_select_all" on public.equipo_partido_stats for select to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));
drop policy if exists "equipo_partido_stats_insert_all" on public.equipo_partido_stats;
create policy "equipo_partido_stats_insert_all" on public.equipo_partido_stats for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico'));
drop policy if exists "equipo_partido_stats_update_all" on public.equipo_partido_stats;
create policy "equipo_partido_stats_update_all" on public.equipo_partido_stats for update to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));
drop policy if exists "equipo_partido_stats_delete_all" on public.equipo_partido_stats;
create policy "equipo_partido_stats_delete_all" on public.equipo_partido_stats for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "alias_equipo_select_all" on public.alias_equipo;
create policy "alias_equipo_select_all" on public.alias_equipo for select to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));
drop policy if exists "alias_equipo_insert_all" on public.alias_equipo;
create policy "alias_equipo_insert_all" on public.alias_equipo for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico'));
drop policy if exists "alias_equipo_update_all" on public.alias_equipo;
create policy "alias_equipo_update_all" on public.alias_equipo for update to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));
drop policy if exists "alias_equipo_delete_all" on public.alias_equipo;
create policy "alias_equipo_delete_all" on public.alias_equipo for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "alias_jugador_select_all" on public.alias_jugador;
create policy "alias_jugador_select_all" on public.alias_jugador for select to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));
drop policy if exists "alias_jugador_insert_all" on public.alias_jugador;
create policy "alias_jugador_insert_all" on public.alias_jugador for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico'));
drop policy if exists "alias_jugador_update_all" on public.alias_jugador;
create policy "alias_jugador_update_all" on public.alias_jugador for update to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));
drop policy if exists "alias_jugador_delete_all" on public.alias_jugador;
create policy "alias_jugador_delete_all" on public.alias_jugador for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "alias_jugador_rival_select_all" on public.alias_jugador_rival;
create policy "alias_jugador_rival_select_all" on public.alias_jugador_rival for select to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));
drop policy if exists "alias_jugador_rival_insert_all" on public.alias_jugador_rival;
create policy "alias_jugador_rival_insert_all" on public.alias_jugador_rival for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico'));
drop policy if exists "alias_jugador_rival_update_all" on public.alias_jugador_rival;
create policy "alias_jugador_rival_update_all" on public.alias_jugador_rival for update to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));
drop policy if exists "alias_jugador_rival_delete_all" on public.alias_jugador_rival;
create policy "alias_jugador_rival_delete_all" on public.alias_jugador_rival for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));
