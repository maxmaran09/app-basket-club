-- Segmenta Scouting Hub y Estadisticas por la misma matriz Categoria/Tira que ya se usa en
-- Calendario/Plantel/Entrenamientos. Requiere haber corrido schema_scouting.sql y schema_stats.sql
-- antes.
--
-- equipos_rivales no tenia categoria/tira: de ahora en mas cada ficha de equipo rival representa
-- un plantel puntual (ej "Regatas - Mayores"), igual que ya funciona con categoria_origen/tira en
-- jugadores propios. jugadores_rivales no necesita las suyas: cuelga de equipo_rival_id y hereda
-- la categoria/tira del equipo (su columna "categoria" existente es otra cosa -- la categoria
-- puntual del jugador rival, ej "Sub19" si juega arriba de su edad -- no se toca).
--
-- Pegar este script completo en Supabase > SQL Editor > New query > Run.

alter table public.equipos_rivales add column if not exists categoria text;
alter table public.equipos_rivales add column if not exists tira text;

create index if not exists equipos_rivales_categoria_tira_idx on public.equipos_rivales (categoria, tira);

-- partidos_stats ya tenia una columna "categoria": se llena sola al parsear el PDF de la CABB
-- (texto libre, lo que haya impreso la federacion ahi -- no coincide con la lista CATEGORIAS de
-- la app). Para no pisar ese dato ya cargado, la matriz Categoria/Tira del club va en columnas
-- nuevas con otro nombre.
alter table public.partidos_stats add column if not exists categoria_equipo text;
alter table public.partidos_stats add column if not exists tira_equipo text;

create index if not exists partidos_stats_categoria_tira_idx on public.partidos_stats (categoria_equipo, tira_equipo);

notify pgrst, 'reload schema';
