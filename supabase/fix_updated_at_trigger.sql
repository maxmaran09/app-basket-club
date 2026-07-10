-- FIX: bug preexistente encontrado al probar el Dashboard (modulo Inicio) — no tiene relacion
-- con el dashboard en si, ya estaba roto desde antes.
--
-- La funcion de trigger "set_updated_at()" fue escrita para "eventos" (columna "updatedAt" en
-- camelCase) pero se reutilizo tal cual como trigger en otras 7 tablas que en realidad tienen
-- la columna en snake_case ("updated_at"): jugadores, asistencias, equipos_rivales,
-- jugadores_rivales, partidos_stats, jugador_partido_stats, equipo_partido_stats. Como el error
-- ("record new has no field ...") solo se dispara en tiempo de ejecucion (la funcion es generica
-- y no valida el nombre de columna hasta que corre sobre una tabla puntual), esto quedo invisible
-- hasta ahora: cualquier UPDATE (no INSERT/DELETE) sobre esas 7 tablas fallaba y se revertia
-- entero. Afecta, entre otras cosas: editar un jugador o sus medidas en Plantel, editar
-- notas/video de un equipo o jugador rival en Scouting Hub, y volver a guardar una asistencia ya
-- cargada (RPE) para el mismo entrenamiento+jugador.
--
-- Este script separa la funcion en dos (una por convencion de nombres de columna) y repunta los
-- 7 triggers afectados. Seguro de correr varias veces. Pegar completo en Supabase > SQL Editor.

create or replace function public.set_updated_at_snake()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists jugadores_set_updated_at on public.jugadores;
create trigger jugadores_set_updated_at
before update on public.jugadores
for each row execute function public.set_updated_at_snake();

drop trigger if exists asistencias_set_updated_at on public.asistencias;
create trigger asistencias_set_updated_at
before update on public.asistencias
for each row execute function public.set_updated_at_snake();

drop trigger if exists equipos_rivales_set_updated_at on public.equipos_rivales;
create trigger equipos_rivales_set_updated_at
before update on public.equipos_rivales
for each row execute function public.set_updated_at_snake();

drop trigger if exists jugadores_rivales_set_updated_at on public.jugadores_rivales;
create trigger jugadores_rivales_set_updated_at
before update on public.jugadores_rivales
for each row execute function public.set_updated_at_snake();

drop trigger if exists partidos_stats_set_updated_at on public.partidos_stats;
create trigger partidos_stats_set_updated_at
before update on public.partidos_stats
for each row execute function public.set_updated_at_snake();

drop trigger if exists jugador_partido_stats_set_updated_at on public.jugador_partido_stats;
create trigger jugador_partido_stats_set_updated_at
before update on public.jugador_partido_stats
for each row execute function public.set_updated_at_snake();

drop trigger if exists equipo_partido_stats_set_updated_at on public.equipo_partido_stats;
create trigger equipo_partido_stats_set_updated_at
before update on public.equipo_partido_stats
for each row execute function public.set_updated_at_snake();

notify pgrst, 'reload schema';
