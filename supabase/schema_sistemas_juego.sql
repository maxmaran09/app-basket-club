-- Catalogo editable de los chips de Plan de juego (Scouting Hub / ficha de Partido): Transicion,
-- Set ofensivo y Defensa de cortinas. Antes eran un array fijo (SISTEMAS) hardcodeado en App.jsx
-- -- este script los mueve a una tabla para que el staff pueda agregar/sacar sistemas propios sin
-- tocar codigo. Global para todo el club (no se filtra por categoria/tira/temporada), mismo
-- criterio que Biblioteca de bloques.
-- Requiere haber corrido schema.sql y schema_auth.sql antes (usa mi_rol()).
--
-- Pegar este script completo en Supabase > SQL Editor > New query > Run.

create table if not exists public.sistemas_juego (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tipo text not null check (tipo in ('transicion', 'set', 'cortinas')),
  nombre text not null,
  orden int not null default 0,
  unique (tipo, nombre)
);

alter table public.sistemas_juego enable row level security;

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
  ('transicion', 'Bajo', 2),
  ('transicion', 'Pantalón', 3),
  ('set', 'Camiseta', 0),
  ('set', 'Puño', 1),
  ('set', 'Fijo', 2),
  ('set', 'Uno', 3),
  ('set', 'Cuerno', 4),
  ('cortinas', '0', 0),
  ('cortinas', '1', 1),
  ('cortinas', '2', 2),
  ('cortinas', '0+Show', 3),
  ('cortinas', 'Trap', 4),
  ('cortinas', 'Switch', 5),
  ('cortinas', 'Ice / Rojo', 6)
on conflict (tipo, nombre) do nothing;

create index if not exists sistemas_juego_tipo_orden_idx on public.sistemas_juego (tipo, orden);

notify pgrst, 'reload schema';
