-- Biblioteca de bloques de cancha: bloques de trabajo (con sus diagramas) guardados aparte para
-- reutilizarlos en cualquier entrenamiento o plan Individual sin recrearlos desde cero. Insertar
-- un bloque desde la biblioteca en un evento clona su contenido (nuevo id de bloque, nuevos ids
-- de diagrama) -- editar esa copia dentro del evento nunca modifica la fila guardada aca, son
-- independientes desde el momento en que se insertan.
-- Requiere haber corrido schema.sql y schema_auth.sql antes (usa mi_rol()).
--
-- Pegar este script completo en Supabase > SQL Editor > New query > Run.

create table if not exists public.biblioteca_bloques (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  titulo text not null,
  -- "descripcion" (no "desc", palabra reservada de SQL) -- mismo contenido que el campo "desc"
  -- de un bloque dentro de "eventos.bloques"/"planesIndividuales".
  descripcion text,
  diagrams jsonb not null default '[]'::jsonb
);

alter table public.biblioteca_bloques enable row level security;

-- Mismo criterio que "bloquesCancha" en permisos.js: Preparador Fisico puede ver la biblioteca
-- para reutilizarla pero no escribirla (sus bloques de cancha ya son de solo lectura en la
-- interfaz); Jugador no tiene acceso a Entrenamientos y no entra aca.
drop policy if exists "biblioteca_bloques_select_all" on public.biblioteca_bloques;
create policy "biblioteca_bloques_select_all" on public.biblioteca_bloques for select to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

drop policy if exists "biblioteca_bloques_insert_all" on public.biblioteca_bloques;
create policy "biblioteca_bloques_insert_all" on public.biblioteca_bloques for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "biblioteca_bloques_delete_all" on public.biblioteca_bloques;
create policy "biblioteca_bloques_delete_all" on public.biblioteca_bloques for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

create index if not exists biblioteca_bloques_titulo_idx on public.biblioteca_bloques (titulo);

notify pgrst, 'reload schema';
