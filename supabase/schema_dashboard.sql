-- Modulo Inicio (dashboard): agrega lo que faltaba para alimentarlo con datos reales.
-- Requiere haber corrido schema.sql, schema_plantel.sql y schema_stats.sql antes.
--
-- Pegar este script completo en Supabase > SQL Editor > New query > Run.

-- 1) Disponibilidad persistente del jugador (independiente de la asistencia diaria), para el
-- contador de lesionados/enfermeria del dashboard. El staff la marca/desmarca a mano en Plantel.
alter table public.jugadores add column if not exists disponibilidad text not null default 'Disponible' check (disponibilidad in ('Disponible','Lesionado','Duda'));
alter table public.jugadores add column if not exists lesion_detalle text;
alter table public.jugadores add column if not exists lesion_desde date;

-- 2) Que lado de cada partido cargado en Estadisticas somos nosotros (Nautico Hacoaj), para poder
-- calcular "puntos a favor vs en contra" sin adivinar por nombre cada vez. Se completa solo al
-- guardar el PDF (comparando contra "NAUTICO HACOAJ") y se puede corregir a mano en la vista previa
-- si el nombre vino escrito distinto en un PDF puntual.
alter table public.partidos_stats add column if not exists equipo_propio text check (equipo_propio in ('LOCAL','VISITANTE'));

-- 3) Tablon de alertas/notas rapidas del staff (no existia ninguna tabla para esto). Sin "autor"
-- porque todavia no hay login (Fase 1 pendiente, ver CLAUDE.md).
create table if not exists public.notas_staff (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  texto text not null,
  resuelta boolean not null default false
);

alter table public.notas_staff enable row level security;
drop policy if exists "notas_staff_select_all" on public.notas_staff;
create policy "notas_staff_select_all" on public.notas_staff for select using (true);
drop policy if exists "notas_staff_insert_all" on public.notas_staff;
create policy "notas_staff_insert_all" on public.notas_staff for insert with check (true);
drop policy if exists "notas_staff_update_all" on public.notas_staff;
create policy "notas_staff_update_all" on public.notas_staff for update using (true);
drop policy if exists "notas_staff_delete_all" on public.notas_staff;
create policy "notas_staff_delete_all" on public.notas_staff for delete using (true);

grant select, insert, update, delete on public.notas_staff to anon, authenticated;

notify pgrst, 'reload schema';
