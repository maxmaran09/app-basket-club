-- Wellness diario: reemplaza al RPE manual (que quedaba en asistencias.rpe_valor/rpe_nota) por
-- un cuestionario que el propio jugador completa a diario desde un Google Form. Un Google Apps
-- Script (ver google-apps-script/wellness-sync.gs.txt) resuelve el jugador contra el plantel
-- activo y sube cada respuesta a esta tabla via REST, usando la service_role key (nunca la
-- authenticated/anon) -- por eso no hay policy de insert para "authenticated" mas abajo.
-- Requiere haber corrido schema.sql, schema_plantel.sql, schema_temporadas.sql y schema_auth.sql
-- antes (usa mi_rol() y set_updated_at_snake()).
--
-- Los datos viejos de RPE en "asistencias" NO se tocan ni se migran (es otra metrica, con otra
-- escala/sentido) -- solo se deja de leer/escribir desde el frontend.
--
-- Pegar este script completo en Supabase > SQL Editor > New query > Run.

create table if not exists public.wellness_diario (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  -- Nullable: si un equipo se queda sin temporada activa por un instante, el upsert del Apps
  -- Script no tiene por que fallar -- la fila igual queda scopeada por categoria/tira/fecha.
  temporada_id uuid references public.temporadas(id) on delete set null,

  fecha date not null default current_date,
  -- Denormalizadas (igual que partidos_stats.categoria_equipo en su momento) para poder
  -- filtrar rapido por equipo sin tener que resolver jugador_temporada en cada consulta.
  categoria text not null,
  tira text not null,

  -- Las 4 preguntas del cuestionario (protocolo tipo Hooper-Mackinnon), cargadas en su sentido
  -- natural tal cual las responde el jugador: 1 = nada, 10 = extremo. "Alto" es bueno en sueno,
  -- pero malo en fatiga/dolor_muscular/estres -- ver el signo invertido en promedio_wellness.
  sueno integer not null check (sueno between 1 and 10),
  fatiga integer not null check (fatiga between 1 and 10),
  dolor_muscular integer not null check (dolor_muscular between 1 and 10),
  estres integer not null check (estres between 1 and 10),

  -- Invierte fatiga/dolor_muscular/estres antes de promediar, para que ALTO siempre sea buen
  -- estado y BAJO dispare la alerta en el dashboard -- un promedio directo de las 4 columnas
  -- tal cual (como decia el plan original) no es confiable: un jugador puede dar "alto" aunque
  -- tenga mucha fatiga/dolor/estres, si esa noche durmio bien.
  promedio_wellness numeric generated always as (
    (sueno + (11 - fatiga) + (11 - dolor_muscular) + (11 - estres)) / 4.0
  ) stored,

  -- Casillero para que el PF anote estado/trabajo diferenciado. Solo se puede editar (update)
  -- una fila que ya existe -- no hay forma de cargar una nota para un jugador que no respondio
  -- el formulario ese dia (limitacion aceptada, ver policies mas abajo).
  notas_medicas text,

  -- Conflict key del upsert del Apps Script. Permite que un jugador de dos equipos reporte una
  -- vez por equipo por dia (mismo criterio que jugadorEnEquipo() en el frontend).
  unique (jugador_id, categoria, tira, fecha)
);

create index if not exists wellness_diario_categoria_tira_fecha_idx
  on public.wellness_diario (categoria, tira, fecha);
create index if not exists wellness_diario_jugador_idx
  on public.wellness_diario (jugador_id);

drop trigger if exists wellness_diario_set_updated_at on public.wellness_diario;
create trigger wellness_diario_set_updated_at
before update on public.wellness_diario
for each row execute function public.set_updated_at_snake();

alter table public.wellness_diario enable row level security;

-- Mismo criterio que "asistencias": PF puede leer y corregir (la nota medica), pero no borrar.
drop policy if exists "wellness_diario_select_staff" on public.wellness_diario;
create policy "wellness_diario_select_staff" on public.wellness_diario for select to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));

-- Sin policy de insert para "authenticated" A PROPOSITO: las filas las crea unicamente el
-- Google Apps Script via REST con la service_role key (que bypassea RLS por completo, no
-- necesita ningun grant aparte). Si en algun momento hace falta que el staff pueda cargar una
-- fila a mano desde la app, hay que agregar una policy de insert nueva y acotada -- no relajar
-- esta a proposito.
drop policy if exists "wellness_diario_update_staff" on public.wellness_diario;
create policy "wellness_diario_update_staff" on public.wellness_diario for update to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico', 'preparador_fisico'));
  -- La UI solo expone editar "notas_medicas" -- restriccion a nivel de interfaz, no de RLS,
  -- mismo criterio ya usado para que el PF edite solo los campos medicos/fisicos en Plantel.

drop policy if exists "wellness_diario_delete_staff_completo" on public.wellness_diario;
create policy "wellness_diario_delete_staff_completo" on public.wellness_diario for delete to authenticated
  using (public.mi_rol() in ('head_coach', 'asistente_tecnico'));

notify pgrst, 'reload schema';
