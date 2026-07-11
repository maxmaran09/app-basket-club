# Proyecto: Sistema para staff técnico de básquet

## Contexto

Soy entrenador (DT) de un equipo de primera división de básquet. Hoy el staff técnico trabaja con varias planillas de Google Sheets sueltas (calendario, planificación de entrenamientos, plan de juego/scouting por partido). El objetivo es reemplazar eso por un sistema único, interconectado, usable desde web y celular por igual, donde todo el cuerpo técnico pueda cargar y consultar información sin duplicar datos ni pisarse versiones.

- Uso: tanto en celular (cancha, viajes) como en compu (armando planificación) — pensado como una **PWA** (una sola base de código, funciona en navegador y se puede instalar en el celular, con uso offline parcial).
- Permisos: sistema de login con 4 roles (Head Coach, Asistente Técnico, Preparador Físico, Jugador) — detalle en "Autenticación y Roles" más abajo. Decisión tomada: no se va a implementar historial de quién cambió qué (se evaluó y se descartó).

## Estado actual

El sistema ya está en producción, en uso real por el staff:

- **Stack**: React + Vite (todo en `src/App.jsx`) + Tailwind v4 + react-router-dom (rutas reales), sin backend propio — Supabase (Postgres + PostgREST + Auth + RLS por rol) como única base de datos.
- **Deploy**: GitHub ([maxmaran09/app-basket-club](https://github.com/maxmaran09/app-basket-club)) → Vercel (front, en `hacoaj-hoopspro.vercel.app`, redeploy automático en cada push) + Supabase (DB + Auth). `vercel.json` con rewrite de SPA para que las rutas de React Router no tiren 404 al refrescar.
- **Módulos implementados y deployados**: Login/Auth con roles, Inicio (dashboard), Calendario, Entrenamientos (con bloques de cancha, RPE de carga física), Individual (planes 1 a 1 por jugador), Plantel (con importador CSV), Scouting Hub (con partidos, plan de juego, e importador CSV de plantel rival), Estadísticas (carga de PDF de la CABB). Detalle de cada uno más abajo.
- **Navegación**: sidebar colapsable en desktop / bottom bar en mobile, con hasta 6 secciones (Inicio, Calendario, Plantel, Entrenamientos, Scouting, Estadísticas) filtradas según el rol logueado — ver "Autenticación y Roles". Inicio es la pantalla que abre por defecto para los roles que la tienen.
- **Branding**: escudo de Náutico Hacoaj ya cargado, y paleta de colores oficial ya aplicada en toda la app (ver Notas de diseño).
- Workflow de trabajo: cambios se prueban localmente (`npm run dev`), el dueño del proyecto corre el SQL en Supabase cuando aplica, y el commit/push a git se hace solo cuando lo pide explícitamente — nunca de forma proactiva.

## Autenticación y Roles (RBAC)

Login con Supabase Auth (email + contraseña, sin auto-registro — las cuentas las crea el dueño del proyecto a mano desde el dashboard de Supabase). Rutas reales con react-router-dom; sin sesión, cualquier ruta redirige a `/login`.

El rol se guarda en la tabla `public.perfiles` (vinculada a `auth.users` por `id`), no en metadata del usuario — permite políticas RLS reales del lado de la base, no solo ocultar botones en la interfaz. Función helper `mi_rol()` (`security definer`) para usar dentro de las policies de cualquier tabla sin caer en recursión.

**4 roles:**
- **Head Coach** / **Asistente Técnico**: acceso total de lectura y escritura a todos los módulos, sin diferencias entre ambos.
- **Preparador Físico**: ve las 6 secciones del nav. Edita Inicio (notas del staff), Calendario (entrar a fichas), Plantel (solo campos médicos/físicos — disponibilidad/lesión/evaluaciones; nombre/dorsal/posición/categoría quedan de solo lectura), y dentro de una ficha de Entrenamiento/Individual el bloque de Asistencia+RPE y Preparación física. El resto (bloques de cancha, Scouting, Estadísticas, alta/baja de jugadores) es de solo lectura.
- **Jugador**: pensado como **una cuenta compartida por categoría/tira** (todos los jugadores de un mismo equipo comparten el mismo login), no una cuenta por persona — por eso `perfiles` tiene columnas `categoria`/`tira` propias para este rol. Solo ve Calendario (fijo a su categoría/tira, sin poder cambiarlo) y Scouting, ambos de solo lectura. Dentro del Calendario solo puede abrir fichas de Partido (ve scouting rival + plan de juego propio); Entrenamiento e Individual no se pueden abrir. Las fechas de Entrenamiento sí aparecen en su calendario (vía la vista `vista_calendario_jugador`, que expone únicamente fecha/tipo/categoría/tira/título) pero sin exponer bloques ni objetivo de la semana. Los eventos tipo Individual no se muestran nunca en este rol: al ser una cuenta compartida por todo el equipo, no hay forma de filtrar "es mi sesión 1 a 1" sin exponer la de un compañero.

**RLS**: reescritas las 12 tablas que antes tenían policies abiertas (`using (true)`) para basarse en `mi_rol()`/`mi_categoria()`/`mi_tira()`. Detalle completo y comentado en `supabase/schema_auth.sql`.

**Decisión tomada**: no se va a implementar historial de cambios ("quién editó qué") — se evaluó como parte de este trabajo y se descartó explícitamente.

## Módulos y modelo de datos

### Inicio (dashboard)
Pantalla que abre por defecto, pensada para saber "qué pasa hoy" sin entrar módulo por módulo: banner de cuenta regresiva del próximo partido (con acceso directo al informe táctico), indicadores clave (RPE promedio semanal con semáforo, lesionados/enfermería, % asistencia semanal, tablón de alertas/notas rápidas del staff, con cada nota abriéndose en un modal al tocarla para leer el texto completo sin truncar), agenda de los próximos 7 días + cronograma de bloques del entrenamiento de hoy, y un bloque analítico (podio de líderes del último partido, tendencia de puntos a favor/en contra de los últimos 3 partidos). La mayoría de las tarjetas se filtran por la misma matriz Categoría/Tira que el resto de la app; próximo partido/líderes/tendencia son a nivel club.

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

1. **Fase 1 (MVP)**: ✅ Calendario + Entrenamientos + Partidos con scouting/plan de juego, todo enlazado. ✅ Login multiusuario con roles (RBAC) — Head Coach, Asistente Técnico, Preparador Físico, Jugador (ver "Autenticación y Roles").
2. **Fase 2**: ✅ Fichas de jugadores propios (Plantel) y rivales (Scouting Hub) más completas. ⏳ Biblioteca de ejercicios/jugadas reutilizables (hoy solo se puede duplicar un bloque puntual, no hay biblioteca ni plantillas guardadas). ❌ Historial de cambios visible — descartado, no se va a implementar.
3. **Fase 3**: ✅ Módulo de estadísticas (CABB) — adelantado, ya en producción, con promedios conectados a Scouting/Plantel. ⏳ Notificaciones, comentarios por ficha, importador de datos históricos desde Google Sheets.
4. **Extra (no estaba en el roadmap original)**: ✅ Módulo Inicio (dashboard) — pantalla de arranque con lo más urgente de cada módulo en un solo lugar.

## Notas de diseño

El escudo de Náutico Hacoaj ya está cargado en la app. La paleta ya no es un placeholder: el color principal (`brand-300` a `brand-950` en `src/index.css`, vía `@theme` de Tailwind v4) es el azul del club, muestreado directo del escudo (`#01215A`) — se usa en navegación, botones principales, Login, y en Partido/Scouting Hub (que antes tenían su propio naranja). El fondo se mantiene oscuro (zinc-950/900).

Colores por tipo de evento/módulo (siguen existiendo aparte del azul de marca, para poder distinguir de un vistazo qué es cada cosa en el Calendario): Entrenamiento = cyan, Individual = teal, Partido = azul de marca, Libre = gris, Optativo = ámbar, Especial/Evento = púrpura. Los colores semánticos de estado (semáforo RPE 1-10, Disponible = verde, Lesionado = rojo, Duda = ámbar) no se tocaron — no son de marca, son códigos de significado.
