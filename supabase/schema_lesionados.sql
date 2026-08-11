-- Modulo Lesionados: ficha medica por lesion (no por jugador), con zona marcada en el diagrama de
-- cuerpo, estudios (PDFs) y evolucion en el tiempo. Reemplaza el flujo viejo donde "lesion" era
-- solo disponibilidad/lesion_detalle/lesion_desde sueltos en "jugadores" -- esos 3 campos se
-- siguen escribiendo (los sigue leyendo el resto de la app: badges de Plantel, contador de
-- lesionados de Inicio, semaforo de Jugador 360), pero ahora se sincronizan desde esta tabla en
-- vez de editarse a mano.
--
-- Requiere haber corrido supabase/schema_plantel.sql y supabase/schema_auth.sql antes (reusa
-- "jugadores", mi_rol() y set_updated_at_snake()).
--
-- Pegar este script completo en Supabase > SQL Editor > New query > Run.

create table if not exists public.lesiones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  categoria text,   -- denormalizado del jugador al crear, para filtrar por Categoria/Tira igual que el resto de la app
  tira text,

  tipo_lesion text not null,               -- texto libre, ej "Esguince de tobillo grado II"
  ubicacion jsonb,                         -- {"x":0.42,"y":0.61,"vista":"frente"} -- click en el diagrama de cuerpo
  fecha_inicio date not null default current_date,
  fecha_alta date,                         -- null = lesion activa; se completa al "dar de alta"

  evolucion jsonb not null default '[]'::jsonb,  -- [{"fecha":"...","nota":"<p>...</p>"}] -- nota en HTML (RichTextEditor)
  estudios jsonb not null default '[]'::jsonb,   -- [{"nombre":"...","path":"...","fecha":"..."}] -- PDFs en Storage
  notas text                               -- diagnostico/notas generales de la lesion
);

-- Una sola lesion activa por jugador a la vez -- si vuelve a lesionarse (mismo lugar u otro), es
-- una lesion nueva. Mismo criterio que "una temporada activa por equipo" en schema_temporadas.sql.
create unique index if not exists lesiones_una_activa_por_jugador_idx on public.lesiones (jugador_id) where fecha_alta is null;
create index if not exists lesiones_jugador_idx on public.lesiones (jugador_id);
create index if not exists lesiones_categoria_tira_idx on public.lesiones (categoria, tira);

drop trigger if exists lesiones_set_updated_at on public.lesiones;
create trigger lesiones_set_updated_at
before update on public.lesiones
for each row execute function public.set_updated_at_snake();

-- RLS: mismo patron que "asistencias" en schema_auth.sql -- Preparador Fisico puede cargar y
-- editar el seguimiento (select/insert/update) pero no borrar historial medico. Jugador no tiene
-- ninguna policy (sin acceso, es informacion medica -- mismo criterio que Plantel).
alter table public.lesiones enable row level security;

drop policy if exists "lesiones_select_staff" on public.lesiones;
create policy "lesiones_select_staff" on public.lesiones for select to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

drop policy if exists "lesiones_insert_staff" on public.lesiones;
create policy "lesiones_insert_staff" on public.lesiones for insert to authenticated
  with check (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

drop policy if exists "lesiones_update_staff" on public.lesiones;
create policy "lesiones_update_staff" on public.lesiones for update to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

drop policy if exists "lesiones_delete_staff_completo" on public.lesiones;
create policy "lesiones_delete_staff_completo" on public.lesiones for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

-- Bucket de estudios medicos (PDFs). A diferencia de "fotos-jugadores"/"fotos-preparacion-fisica"
-- (publicos de lectura, foto de perfil no es dato sensible), este es informacion medica real --
-- bucket privado, lectura restringida por rol via RLS de storage.objects, y se sirve con URLs
-- firmadas (createSignedUrl) desde el frontend en vez de getPublicUrl.
insert into storage.buckets (id, name, public)
values ('estudios-medicos', 'estudios-medicos', false)
on conflict (id) do nothing;

drop policy if exists "estudios_medicos_select_staff" on storage.objects;
create policy "estudios_medicos_select_staff" on storage.objects for select to authenticated
  using (bucket_id = 'estudios-medicos' and public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

drop policy if exists "estudios_medicos_insert_staff" on storage.objects;
create policy "estudios_medicos_insert_staff" on storage.objects for insert to authenticated
  with check (bucket_id = 'estudios-medicos' and public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

drop policy if exists "estudios_medicos_delete_staff" on storage.objects;
create policy "estudios_medicos_delete_staff" on storage.objects for delete to authenticated
  using (bucket_id = 'estudios-medicos' and public.mi_rol() in ('head_coach', 'asistente_tecnico'));

-- ============================================================================
-- BACKFILL (una sola vez): por cada jugador que hoy tenga disponibilidad = 'Lesionado' (cargado
-- a mano por el flujo viejo), crea una fila en "lesiones" con lo que ya habia en
-- lesion_detalle/lesion_desde -- asi no se pierde el estado actual y aparece ya cargado en la
-- pestaña nueva sin reingreso manual. Seguro de re-correr: no duplica si el jugador ya tiene una
-- lesion activa (el indice unico de arriba lo impediria igual, pero el "not exists" evita el
-- error en vez de dejarlo fallar).
-- ============================================================================

insert into public.lesiones (jugador_id, categoria, tira, tipo_lesion, fecha_inicio, fecha_alta)
select
  j.id,
  j.categoria_origen,
  j.tira,
  coalesce(nullif(trim(j.lesion_detalle), ''), 'Lesión (sin detalle cargado)'),
  coalesce(j.lesion_desde, current_date),
  null
from public.jugadores j
where j.disponibilidad = 'Lesionado'
  and not exists (select 1 from public.lesiones l where l.jugador_id = j.id and l.fecha_alta is null);

notify pgrst, 'reload schema';
