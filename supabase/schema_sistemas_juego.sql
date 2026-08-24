-- Catalogo editable de los chips de Plan de juego (Scouting Hub / ficha de Partido): Transicion,
-- Set ofensivo, Cortinas directas y Cortinas indirectas. Antes eran un array fijo (SISTEMAS)
-- hardcodeado en App.jsx -- este script los mueve a una tabla para que el staff pueda agregar/sacar
-- sistemas propios sin tocar codigo. Global para todo el club (no se filtra por
-- categoria/tira/temporada), mismo criterio que Biblioteca de bloques.
-- Requiere haber corrido schema.sql y schema_auth.sql antes (usa mi_rol()).
--
-- Pegar este script completo en Supabase > SQL Editor > New query > Run.

create table if not exists public.sistemas_juego (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tipo text not null check (tipo in ('transicion', 'set', 'cortinas_directas', 'cortinas_indirectas')),
  nombre text not null,
  orden int not null default 0,
  unique (tipo, nombre)
);

alter table public.sistemas_juego enable row level security;

-- Migracion: "cortinas" (Defensa de cortinas, un solo grupo) se separo en "cortinas_directas" y
-- "cortinas_indirectas" -- los sistemas que ya tenias cargados bajo "cortinas" (los que se hayan
-- editado desde el modal "Sistemas de juego", no necesariamente los 7 originales) pasan a
-- "cortinas_directas" para no perder nada; "cortinas_indirectas" arranca vacio, lo cargas a mano.
-- Postgres valida TODAS las filas existentes en el momento de agregar un check constraint nuevo
-- -- por eso no alcanza con "agregar la restriccion final y despues migrar los datos" (las filas
-- viejas con tipo='cortinas' la violarian de entrada) ni al reves ("migrar los datos y despues
-- agregar la restriccion final", porque la restriccion VIEJA -- que no permite 'cortinas_directas'
-- -- todavia esta activa durante el update). Hace falta un paso intermedio: 1) ensanchar la
-- restriccion para que acepte tanto los tipos viejos como los nuevos, 2) migrar los datos, 3) recien
-- ahi angostarla al set final (ya no queda ninguna fila con el tipo viejo para que la rechace). El
-- nombre del constraint no se adivina (el original no se llamaba "sistemas_juego_tipo_check") --
-- se busca en el catalogo de Postgres para poder borrarlo sin importar como se llame de verdad.
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.sistemas_juego'::regclass and contype = 'c'
  loop
    execute format('alter table public.sistemas_juego drop constraint %I', r.conname);
  end loop;
end $$;

-- Paso 1: restriccion ancha (viejo + nuevo conviven mientras se migra el dato).
alter table public.sistemas_juego add constraint sistemas_juego_tipo_check
  check (tipo in ('transicion', 'set', 'cortinas', 'cortinas_directas', 'cortinas_indirectas'));

-- Paso 2: migrar. Valido porque 'cortinas_directas' ya es un tipo permitido por el paso 1.
update public.sistemas_juego set tipo = 'cortinas_directas' where tipo = 'cortinas';

-- Paso 3: restriccion final, sin el tipo viejo "cortinas" -- ya no queda ninguna fila con ese
-- tipo (se renombraron en el paso 2), asi que esta vez la validacion de filas existentes pasa.
alter table public.sistemas_juego drop constraint sistemas_juego_tipo_check;
alter table public.sistemas_juego add constraint sistemas_juego_tipo_check
  check (tipo in ('transicion', 'set', 'cortinas_directas', 'cortinas_indirectas'));

-- Lectura para los 4 roles: Preparador Fisico y Jugador ven el Plan de juego de un Partido en
-- solo lectura (ver PERMISOS_BLOQUE_EVENTO en permisos.js), pero igual necesitan el catalogo
-- completo para que TagPicker pueda mostrar todos los chips (resaltando los ya elegidos). Solo
-- Head Coach/Asistente Tecnico pueden dar de alta o borrar sistemas.
drop policy if exists "sistemas_juego_select_all" on public.sistemas_juego;
create policy "sistemas_juego_select_all" on public.sistemas_juego for select to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico', 'jugador'));

drop policy if exists "sistemas_juego_insert_all" on public.sistemas_juego;
create policy "sistemas_juego_insert_all" on public.sistemas_juego for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "sistemas_juego_delete_all" on public.sistemas_juego;
create policy "sistemas_juego_delete_all" on public.sistemas_juego for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

-- Semilla con los valores que antes estaban hardcodeados, para no perder ningun chip ya usado en
-- partidos ya cargados. Idempotente (on conflict do nothing) -- correrlo de nuevo no duplica.
insert into public.sistemas_juego (tipo, nombre, orden) values
  ('transicion', 'Libre', 0),
  ('transicion', 'Alto', 1),
  ('set', 'Camiseta', 0),
  ('set', 'Puño', 1),
  ('set', 'Fijo (vs Zona)', 2),
  ('set', 'Uno', 3),
  ('cortinas_directas', '0+Show', 0),
  ('cortinas_directas', '1', 1),
  ('cortinas_directas', 'Rojo', 2),
  ('cortinas_directas', 'Next', 3),
  ('cortinas_directas', 'Multiples', 6)
on conflict (tipo, nombre) do nothing;

create index if not exists sistemas_juego_tipo_orden_idx on public.sistemas_juego (tipo, orden);

notify pgrst, 'reload schema';
