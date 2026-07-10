# Proyecto: Sistema para staff técnico de básquet

## Contexto

Soy entrenador (DT) de un equipo de primera división de básquet. Hoy el staff técnico trabaja con varias planillas de Google Sheets sueltas (calendario, planificación de entrenamientos, plan de juego/scouting por partido). El objetivo es reemplazar eso por un sistema único, interconectado, usable desde web y celular por igual, donde todo el cuerpo técnico pueda cargar y consultar información sin duplicar datos ni pisarse versiones.

- Uso: tanto en celular (cancha, viajes) como en compu (armando planificación) — pensado como una **PWA** (una sola base de código, funciona en navegador y se puede instalar en el celular, con uso offline parcial).
- Permisos: todo el staff edita por igual (no hace falta un sistema de roles complejo al inicio), pero conviene guardar historial de quién cambió qué.

## Estado actual

El sistema ya está en producción, en uso real por el staff:

- **Stack**: React + Vite (todo en `src/App.jsx`) + Tailwind v4, sin backend propio — Supabase (Postgres + PostgREST + RLS abierta, sin login todavía) como única base de datos.
- **Deploy**: GitHub ([maxmaran09/app-basket-club](https://github.com/maxmaran09/app-basket-club)) → Vercel (front, redeploy automático en cada push) + Supabase (DB).
- **Módulos implementados y deployados**: Inicio (dashboard), Calendario, Entrenamientos (con bloques de cancha, RPE de carga física), Individual (planes 1 a 1 por jugador), Plantel, Scouting Hub (con partidos y plan de juego), Estadísticas (carga de PDF de la CABB). Detalle de cada uno más abajo.
- **Navegación**: sidebar colapsable en desktop / bottom bar en mobile, con 6 secciones (Inicio, Calendario, Plantel, Entrenamientos, Scouting, Estadísticas). Inicio es la pantalla que abre por defecto.
- **Branding**: escudo de Náutico Hacoaj ya cargado; paleta de colores del club todavía no definida (ver Notas de diseño).
- Workflow de trabajo: cambios se prueban localmente (`npm run dev`), el dueño del proyecto corre el SQL en Supabase cuando aplica, y el commit/push a git se hace solo cuando lo pide explícitamente — nunca de forma proactiva.

## Módulos y modelo de datos

### Inicio (dashboard)
Pantalla que abre por defecto, pensada para saber "qué pasa hoy" sin entrar módulo por módulo: banner de cuenta regresiva del próximo partido (con acceso directo al informe táctico), indicadores clave (RPE promedio semanal con semáforo, lesionados/enfermería, % asistencia semanal, tablón de alertas/notas rápidas del staff), agenda de los próximos 7 días + cronograma de bloques del entrenamiento de hoy, y un bloque analítico (podio de líderes del último partido, tendencia de puntos a favor/en contra de los últimos 3 partidos). La mayoría de las tarjetas se filtran por la misma matriz Categoría/Tira que el resto de la app; próximo partido/líderes/tendencia son a nivel club.

### Calendario (módulo central)
Vista mensual, cada evento enlaza a su ficha (entrenamiento o partido). Tipos de evento: `entrenamiento`, `partido`, `libre`, `optativo`, `especial`. Basado en cómo hoy se arma la pestaña "Calendario Formato Mensual" de la planilla real (grilla mensual con texto libre por celda, que en el sistema pasa a ser un evento real).

### Plantel (jugadores propios)
Roster del club: nombre, fecha de nacimiento (edad calculada), historial de altura/peso (con opción de borrar un registro puntual si se cargó mal), y soporte para jugadores que juegan en más de una categoría/tira a la vez (`equipos_adicionales`). Disponibilidad persistente por jugador (Disponible/Lesionado/Duda + detalle), independiente de la asistencia diaria — alimenta el contador de lesionados del dashboard. Filtro por matriz Categoría/Tira usado en toda la app (Calendario, Entrenamientos, Individual, Inicio) para saber qué jugadores corresponden a cada evento.

### Entrenamientos
Ficha por sesión: fecha, objetivo de la semana, asistencia, y una lista de **bloques de trabajo** (rango de minutos + título + descripción del ejercicio) — reflejando cómo está organizada hoy la pestaña "Federal 2026 - Temporada Regular + Post Temporada" (semanas en columnas, bloques de tiempo tipo `0'-5': Charla`, `5'-20': 5v0 Spacing`, etc). Cada bloque se puede **duplicar** (clona horario/título/descripción/diagramas) para repetir una dinámica sin recrearla.

**Control de carga física (RPE)**: por jugador, escala 1-10 con semáforo de color (1-3 verde, 4-6 amarillo, 7-8 naranja, 9-10 rojo) + nota, cargable individualmente o con "Asignar a todos".

**Evento Individual**: variante de Entrenamiento para trabajo 1 a 1 — un mismo evento contiene un plan por jugador (objetivo, prep. física, bloques de cancha propios), reutilizando los mismos componentes de bloques/diagramas. Cada plan tiene un jugador asignado editable (se puede corregir sin borrar todo) y se puede **duplicar el plan completo** de un jugador a otro cuando dos hicieron el mismo trabajo.

**Diagramas de cancha por bloque** (inspirado en la app "Basketball Playbook"):
- Herramientas: Mover, + Jugador ofensivo, + Jugador defensivo, Balón, Pase, Dribbling, Corte, Cortina, Borrar.
- Jugadores: círculos numerados, ofensivos en azul, defensivos en rojo con "X" + número, se agregan tocando la cancha y se arrastran con la herramienta "Mover".
- Balón: se asigna a un jugador con la herramienta "Balón" (un puntito naranja al lado del jugador).
- Líneas (según convención real del básquet):
  - **Pase** = línea punteada con flecha.
  - **Dribbling** = línea en zigzag con flecha.
  - **Corte** (correr sin balón) = línea sólida con flecha.
  - **Cortina/bloqueo** = línea sólida terminada en una "T" perpendicular (sin flecha).
- Toggle de **media cancha / cancha completa**.
- Implementado con SVG (no canvas), para que los elementos (jugadores, líneas) sean objetos manipulables y no un dibujo de trazo libre.
- Pendiente a futuro: acercar más la funcionalidad a la app "Basketball Playbook" (biblioteca de drills/jugadas guardadas, animación de la jugada, exportar como imagen/PDF, plantillas reutilizables).

### Partidos y Scouting rival (Scouting Hub)
Ficha por partido, calcada de la pestaña real "Plan de Juego", enlazada al **Scouting Hub** (`equipos_rivales`/`jugadores_rivales`):
- Header editable: rival (con vínculo relacional al equipo rival cargado en el Hub), fecha, jornada, condición (local/visitante), horario, citación, resultado.
- **Scouting colectivo**: lista de características del rival (bullets editables) + video de YouTube embebido (reproductor in-app, no redirección externa) para scouting colectivo.
- **Plantel rival**: tabla con número, nombre, características, posición, categoría, y video de YouTube embebido por jugador (scouting individual).
- **Plan de juego — ataque**: texto libre + chips de **Transición** (Libre, Alto, Bajo, Pantalón) y **Set ofensivo** (Camiseta, Puño, Fijo, Uno, Cuerno) — biblioteca de sistemas propios reutilizable entre partidos.
- **Plan de juego — defensa**: texto libre + chips de **Defensa de cortinas** (0, 1, 2, 0+Show, Trap, Switch, Ice/Rojo) + claves + "directos"/"indirectos".

### Estadísticas
Módulo implementado (adelantado respecto a la prioridad original de Fase 3). Reemplaza la planilla "Estadísticas - Liga Federal 2026":
- Se sube el **PDF de estadísticas de la CABB** (formato Gesdeportiva) y se parsea 100% client-side (`pdfjs-dist`, sin backend), extrayendo jugadores y totales de ambos equipos.
- Calcula métricas avanzadas (PLAY, POS, PPLAY, PPOS, TOV%, eFG%) verificadas contra el script de Power Query que se usaba antes en Excel.
- Vista previa editable antes de guardar (por equipo: nombre + jugadores + totales), con vínculo a jugadores propios (Plantel) o rivales (Scouting Hub).
- **Alias automático**: la primera vez que se vincula a mano un equipo o jugador de un PDF, se guarda el nombre exacto → id elegido. En próximas cargas del mismo equipo/jugador, el vínculo se autocompleta solo.
- Guarda en Supabase: `partidos_stats` (incluye `equipo_propio`, LOCAL/VISITANTE, autodetectado comparando contra "NAUTICO HACOAJ" y editable si el PDF trae el nombre distinto), `jugador_partido_stats`, `equipo_partido_stats` (+ `alias_equipo`, `alias_jugador`, `alias_jugador_rival`).
- **Promedios conectados**: la ficha de equipo rival (Scouting Hub) y cada jugador propio (Plantel) muestran sus promedios reales (PJ, PTS, RT, AST, REC, eFG%) leyendo las vistas `vista_promedios_equipo`/`vista_promedios_jugador`.
- Pendiente: las vistas de "resumen oponentes"/resultados por condición que hoy existen en la planilla vieja (record ganados/perdidos ya existe como vista `vista_record_equipo` pero todavía no está conectada a ninguna pantalla).

## Roadmap general

1. **Fase 1 (MVP)**: ✅ Calendario + Entrenamientos + Partidos con scouting/plan de juego, todo enlazado. ⏳ Login/multiusuario real todavía no implementado (por ahora todo el staff edita sin autenticar, vía RLS abierta).
2. **Fase 2**: ✅ Fichas de jugadores propios (Plantel) y rivales (Scouting Hub) más completas. ⏳ Biblioteca de ejercicios/jugadas reutilizables (hoy solo se puede duplicar un bloque puntual, no hay biblioteca ni plantillas guardadas). ⏳ Historial de cambios visible.
3. **Fase 3**: ✅ Módulo de estadísticas (CABB) — adelantado, ya en producción, con promedios conectados a Scouting/Plantel. ⏳ Notificaciones, comentarios por ficha, importador de datos históricos desde Google Sheets.
4. **Extra (no estaba en el roadmap original)**: ✅ Módulo Inicio (dashboard) — pantalla de arranque con lo más urgente de cada módulo en un solo lugar.

## Notas de diseño

El escudo de Náutico Hacoaj ya está cargado en la app. Todavía no se definió la paleta de colores final del club — la app sigue usando un estilo oscuro (zinc/naranja) funcional, no definitivo, hasta que se sumen los colores oficiales.
