-- Vista 360 del Jugador (Fase 1): columna de foto + bucket de Storage para subirla desde
-- Plantel (JugadorFormModal). El resto de la Fase 1 (buscador, ficha base) no necesita SQL --
-- reusa "jugadores" tal cual ya se trae en toda la app.
--
-- Requiere haber corrido supabase/schema_plantel.sql y supabase/schema_auth.sql antes.
-- Pegar este script completo en Supabase > SQL Editor > New query > Run.

alter table public.jugadores add column if not exists foto_url text;

-- Bucket publico de lectura (mismo criterio que el escudo del club: una imagen de perfil no es
-- informacion sensible). Path de cada archivo = "<jugador_id>.<ext>", con upsert desde el
-- frontend, asi una foto nueva reemplaza a la vieja en vez de acumular archivos huerfanos.
insert into storage.buckets (id, name, public)
values ('fotos-jugadores', 'fotos-jugadores', true)
on conflict (id) do nothing;

drop policy if exists "fotos_jugadores_select_todos" on storage.objects;
create policy "fotos_jugadores_select_todos" on storage.objects for select to authenticated
  using (bucket_id = 'fotos-jugadores');

-- Subir/reemplazar/borrar la foto: solo staff completo (mismo criterio que nombre/dorsal/
-- categoria del jugador, que ya son de solo lectura para Preparador Fisico).
drop policy if exists "fotos_jugadores_insert_staff_completo" on storage.objects;
create policy "fotos_jugadores_insert_staff_completo" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-jugadores' and public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "fotos_jugadores_update_staff_completo" on storage.objects;
create policy "fotos_jugadores_update_staff_completo" on storage.objects for update to authenticated
  using (bucket_id = 'fotos-jugadores' and public.mi_rol() in ('head_coach', 'asistente_tecnico'));

drop policy if exists "fotos_jugadores_delete_staff_completo" on storage.objects;
create policy "fotos_jugadores_delete_staff_completo" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos-jugadores' and public.mi_rol() in ('head_coach', 'asistente_tecnico'));

notify pgrst, 'reload schema';
