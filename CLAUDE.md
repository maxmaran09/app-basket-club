# Proyecto: Sistema para staff técnico de básquet

## Contexto

Soy entrenador (DT) de un equipo de primera división de básquet. Hoy el staff técnico trabaja con varias planillas de Google Sheets sueltas (calendario, planificación de entrenamientos, plan de juego/scouting por partido). El objetivo es reemplazar eso por un sistema único, interconectado, usable desde web y celular por igual, donde todo el cuerpo técnico pueda cargar y consultar información sin duplicar datos ni pisarse versiones.

- Uso: tanto en celular (cancha, viajes) como en compu (armando planificación) — es una **PWA instalable** (una sola base de código; `public/manifest.json` + etiquetas en `index.html` permiten "Agregar a pantalla de inicio"/"Instalar" en celular y escritorio, con el escudo del club como ícono y apertura en pantalla completa). Todavía sin service worker/cache offline (pendiente, ver "Módulos planificados").
- Permisos: sistema de login con 4 roles (Head Coach, Asistente Técnico, Preparador Físico, Jugador) — detalle en "Autenticación y Roles" más abajo. Decisión tomada: no se va a implementar historial de quién cambió qué (se evaluó y se descartó).

## Estado actual

El sistema ya está en producción, en uso real por el staff:

- **Stack**: React + Vite (todo en `src/App.jsx`) + Tailwind v4 + react-router-dom (rutas reales), sin backend propio — Supabase (Postgres + PostgREST + Auth + RLS por rol) como única base de datos.
- **Deploy**: GitHub ([maxmaran09/app-basket-club](https://github.com/maxmaran09/app-basket-club)) → Vercel (front, en `hacoaj-hoopspro.vercel.app`, redeploy automático en cada push) + Supabase (DB + Auth). `vercel.json` con rewrite de SPA para que las rutas de React Router no tiren 404 al refrescar.
- **Módulos implementados y deployados**: Login/Auth con roles, Inicio (dashboard), Calendario, Entrenamientos (con bloques de cancha, RPE de carga física), Individual (planes 1 a 1 por jugador), Biblioteca (bloques de cancha reutilizables), Plantel (con importador CSV y foto de perfil), Jugador 360° (ficha integral con analítica comparada), Scouting Hub (con partidos, plan de juego, e importador CSV de plantel rival), Estadísticas (carga de PDF de la CABB), Configuración (cuenta + gestión de Temporadas). Detalle de cada uno más abajo.
- **Navegación**: sidebar colapsable en desktop / barra fija arriba en mobile, con hasta 9 secciones (Inicio, Calendario, Plantel, Jugador 360°, Entrenamientos, Biblioteca, Scouting, Estadísticas, Configuración) filtradas según el rol logueado — ver "Autenticación y Roles". Inicio es la pantalla que abre por defecto para los roles que la tienen. La nav de celular scrollea horizontal con ancho fijo por ítem (no reparte el ancho a partes iguales) porque con esta cantidad de secciones los labels se pisaban; el tab activo se autoscrollea a la vista al navegar.
- **Branding**: escudo de Náutico Hacoaj ya cargado, y paleta de colores oficial ya aplicada en toda la app (ver Notas de diseño).
- Workflow de trabajo: cambios se prueban localmente (`npm run dev`), el dueño del proyecto corre el SQL en Supabase cuando aplica, y el commit/push a git se hace solo cuando lo pide explícitamente — nunca de forma proactiva.

## Autenticación y Roles (RBAC)

Login con Supabase Auth (email + contraseña, sin auto-registro — las cuentas las crea el dueño del proyecto a mano desde el dashboard de Supabase). Rutas reales con react-router-dom; sin sesión, cualquier ruta redirige a `/login`.

El rol se guarda en la tabla `public.perfiles` (vinculada a `auth.users` por `id`), no en metadata del usuario — permite políticas RLS reales del lado de la base, no solo ocultar botones en la interfaz. Función helper `mi_rol()` (`security definer`) para usar dentro de las policies de cualquier tabla sin caer en recursión.

**4 roles:**
- **Head Coach** / **Asistente Técnico**: acceso total de lectura y escritura a todos los módulos, sin diferencias entre ambos.
- **Preparador Físico**: ve las 9 secciones del nav (incluida Configuración, pero sin la tarjeta de gestión de Temporadas — ver más abajo). Edita Inicio (notas del staff), Calendario (entrar a fichas), Plantel (solo campos médicos/físicos — disponibilidad/lesión/evaluaciones; nombre/dorsal/posición/categoría quedan de solo lectura), y dentro de una ficha de Entrenamiento/Individual el bloque de Asistencia+RPE y Preparación física. El resto (bloques de cancha, Biblioteca, Scouting, Estadísticas, alta/baja de jugadores, Jugador 360° que es de solo consulta para todos los roles) es de solo lectura.
- **Jugador**: pensado como **una cuenta compartida por categoría/tira** (todos los jugadores de un mismo equipo comparten el mismo login), no una cuenta por persona — por eso `perfiles` tiene columnas `categoria`/`tira` propias para este rol. Solo ve Calendario (fijo a su categoría/tira, sin poder cambiarlo) y Scouting, ambos de solo lectura — no tiene acceso a Configuración a propósito (ver más abajo, por qué). Dentro del Calendario solo puede abrir fichas de Partido (ve scouting rival + plan de juego propio); Entrenamiento e Individual no se pueden abrir. Las fechas de Entrenamiento sí aparecen en su calendario (vía la vista `vista_calendario_jugador`, que expone únicamente fecha/tipo/categoría/tira/título) pero sin exponer bloques ni objetivo de la semana. Los eventos tipo Individual no se muestran nunca en este rol: al ser una cuenta compartida por todo el equipo, no hay forma de filtrar "es mi sesión 1 a 1" sin exponer la de un compañero.

**RLS**: reescritas las 12 tablas que antes tenían policies abiertas (`using (true)`) para basarse en `mi_rol()`/`mi_categoria()`/`mi_tira()`. Detalle completo y comentado en `supabase/schema_auth.sql`.

**Decisión tomada**: no se va a implementar historial de cambios ("quién editó qué") — se evaluó como parte de este trabajo y se descartó explícitamente.

## Módulos y modelo de datos

### Temporadas (modelo transversal a Plantel, Scouting y Estadísticas)
"Temporada" no es un año único de club: cada combinación Categoría+Tira puede jugar una competencia distinta en el mismo año calendario (ej: Mayores Blanca juega "Liga Metropolitana 2026", Mayores Azul juega "Copa de Oro 2026"). La tabla `temporadas` tiene una fila por **equipo puntual** (`nombre_competencia`, `anio`, `categoria`, `tira`, `activa`), con un índice único que garantiza un solo torneo activo por equipo a la vez.

- **Plantel**: `jugador_temporada` separa la identidad de la persona (`jugadores`: nombre, nacimiento, evaluaciones físicas — nunca se duplica ni se pierde) de su membresía de equipo por temporada (dorsal, estado activo/baja, equipos adicionales). Dar de baja a un jugador ya no borra su ficha ni su historial — solo lo saca del plantel activo de esa temporada (reversible desde "Ver dados de baja"). La vista `vista_plantel_temporada` aplana ambas tablas con la misma forma que tenían las filas de `jugadores` antes de esta migración.
- **Scouting**: `equipos_rivales.temporada_id` reemplaza a las columnas sueltas `categoria`/`tira` — un rival se scoutea de nuevo cada competencia (plantel y enfoque táctico cambian año a año). Al crear una temporada nueva, el scouting **no se copia hacia adelante** (arranca vacío; decisión explícita, a diferencia del plantel propio que sí se copia).
- **Estadísticas**: `partidos_stats.temporada_id` reemplaza a `categoria_equipo`/`tira_equipo`. Los promedios (`vista_promedios_jugador`, `vista_promedios_equipo`) dejaron de ser un acumulado de toda la vida del jugador/equipo y ahora se calculan por temporada.
- **`TeamContext`** (`src/TeamContext.jsx`) resuelve automáticamente la temporada activa según la Categoría/Tira seleccionada en el filtro global, persistido en `localStorage`. El staff puede elegir a mano ver una temporada pasada del mismo equipo — ahí Plantel/Scouting/Estadísticas quedan en **solo lectura** (alta, edición y carga de PDFs bloqueadas) para no editar por error un archivo histórico.
- "Nueva Temporada" (desde Plantel o Scouting, mismo modal reutilizado) marca la temporada activa saliente como inactiva, crea la nueva, y copia el plantel propio activo hacia la nueva competencia.
- Migración aditiva en 3 scripts (`supabase/schema_temporadas.sql`, `schema_scouting_temporadas.sql`, `schema_estadisticas_temporadas.sql`), con backfill automático — las columnas viejas (`jugadores.categoria_origen`/`tira`/`dorsal`/`equipos_adicionales`, `equipos_rivales.categoria`/`tira`, `partidos_stats.categoria_equipo`/`tira_equipo`) quedan sin uso desde el frontend pero no se borraron todavía (ventana de rollback). **Cuidado al mergear la respuesta de un `update` a `jugadores` en el estado local**: la fila devuelta trae esas columnas viejas tal cual están en la tabla (casi siempre `null` en un jugador creado después de la migración) — pisarlas sobre el objeto ya aplanado por `vista_plantel_temporada` hace que el jugador dé `null` en categoría/tira y desaparezca del filtro de Plantel (bug real que pasó y se corrigió excluyendo esas columnas del merge en `updateJugador`).

### Inicio (dashboard)
Pantalla que abre por defecto, pensada para saber "qué pasa hoy" sin entrar módulo por módulo: banner de cuenta regresiva del próximo partido (con acceso directo al informe táctico), indicadores clave (RPE promedio semanal con semáforo, lesionados/enfermería, % asistencia semanal, tablón de alertas/notas rápidas del staff, con cada nota abriéndose en un modal al tocarla para leer el texto completo sin truncar), agenda de los próximos 7 días + cronograma de bloques del entrenamiento de hoy, un bloque analítico (podio de líderes del último partido, tendencia de puntos a favor/en contra de los últimos 3 partidos), y el **Panel de Rendimiento Colectivo** (ver debajo). Todas las tarjetas se filtran por la misma matriz Categoría/Tira que el resto de la app, incluidos próximo partido/líderes/tendencia (via `partidos_stats.temporada_id`) y las notas del staff (`notas_staff.categoria`/`tira`, agregado en `schema_dashboard.sql` — las notas cargadas antes de esa migración quedan sin equipo asignado y no aparecen bajo ningún filtro hasta reasignarlas a mano).

**Panel de Rendimiento Colectivo**: bloque de "salud táctica" del equipo en la temporada activa — Puntos a favor/en contra por partido (con desglose opcional Local/Visitante), Eficiencia de ejecución (eFG%, Plays/partido, PPP), Efectividad en tiros (T2/T3/TL con Anotados/Intentados + %), y Batalla de posesiones y control (RD, RO, RO Rival, AST, PER, %AST). Todo calculado **en el cliente** (`PanelRendimientoColectivo` en `App.jsx`, sin vistas SQL nuevas) sobre `partidos_stats` + `equipo_partido_stats`: por cada partido con `equipo_propio` definido, la fila de `equipo_partido_stats` cuya `condicion` coincide con `equipo_propio` es "nosotros" y la otra es el rival de ese partido puntual (de ahí salen PTS Contra y RO Rival). Diseño visual (paleta, agrupación en 3 pilares, comportamiento responsive) validado antes en un prototipo de Claude Artifacts con datos mockeados.

### Calendario (módulo central)
Vista mensual, cada evento enlaza a su ficha (entrenamiento o partido). Tipos de evento: `entrenamiento`, `partido`, `libre`, `optativo`, `especial`. Basado en cómo hoy se arma la pestaña "Calendario Formato Mensual" de la planilla real (grilla mensual con texto libre por celda, que en el sistema pasa a ser un evento real). Cada evento (de cualquier tipo) se puede **duplicar** completo desde la lista del día (clona todos sus campos, incluidos bloques de cancha con diagramas si es un Entrenamiento) para no recrear una sesión parecida desde cero; queda en el mismo día, listo para renombrar/mover de fecha con los mismos íconos.

### Plantel (jugadores propios)
Roster del club: nombre, fecha de nacimiento (edad calculada), historial de altura/peso (con opción de borrar un registro puntual si se cargó mal), y soporte para jugadores que juegan en más de una categoría/tira a la vez (`equipos_adicionales`, ahora colgado de `jugador_temporada`). Disponibilidad persistente por jugador (Disponible/Lesionado/Duda + detalle), independiente de la asistencia diaria — alimenta el contador de lesionados del dashboard. Filtro por matriz Categoría/Tira usado en toda la app (Calendario, Entrenamientos, Individual, Inicio) para saber qué jugadores corresponden a cada evento. Membresía de equipo (dorsal, alta/baja) separada por Temporada — ver sección "Temporadas" arriba. Posición secundaria opcional (`posicion_secundaria`, ej: Ala-Pivot y Pivot, o Base y Escolta) para jugadores híbridos — se muestra como "Base · Escolta" en listados y fichas (helper `formatPosicion` en `constants.js`), y el mismo campo existe en Scouting para jugadores rivales.

**DNI**: campo opcional (`jugadores.dni`, columna nueva `unique` — no reemplaza al `id` uuid como primary key) para trazabilidad con sistemas externos y como clave de identidad más confiable que nombre+equipo. Se muestra como chip en el listado de Plantel, se edita desde `JugadorFormModal`, y es la clave prioritaria de matching en el importador CSV (si no hay DNI, cae al matching por nombre+categoría+tira de antes). Un DNI duplicado tira un mensaje amigable ("Ya existe un jugador cargado con ese DNI.") en vez del error crudo de Postgres, tanto al crear como al importar.

**Importador/exportador CSV** (`ImportadorCSVPropio.jsx`): si el DNI (o, en su ausencia, el nombre) del CSV ya existe en esa categoría/tira, actualiza al jugador en vez de duplicarlo (solo pisa los campos que la fila trae con dato, para no borrar algo cargado a mano). Columna opcional `fecha_medicion`: si altura/peso cambian respecto a lo ya cargado, agrega una entrada al historial (`evaluaciones_pfs`) con esa fecha (o la de hoy si se deja vacía) en vez de pisar el dato sin dejar rastro. "Exportar CSV" en el header de Plantel descarga la lista mostrada con las mismas columnas que la plantilla de importación, para poder editarla y volver a subirla.

**Evaluaciones físicas del PF** (protocolo consensuado con los PFs del club, 14 ejercicios en 3 grupos — Fuerza en kg: Sentadilla/Pecho Plano/Peso Muerto/Dominadas; Potencia en cm: CMJ/CMJ Der/CMJ Izq/Squat Jump/Salto en Largo/Salto en Largo Der/Salto en Largo Izq; Aceleración en segundos: 5m/10m/15m). Se cargan desde el botón "Cargar evaluación física" en Plantel (`EvaluacionFisicaModal`), guardadas en la misma columna `jugadores.evaluaciones_pfs` (jsonb) que ya usaba el historial de altura/peso — una entrada nueva puede traer cualquier combinación de `fuerza`/`potencia`/`aceleracion` según lo que se haya tomado ese día, sin necesidad de completar los 14 juntos. "Ver evolución" abre un modal (`EvolucionJugadorModal`) con la tabla de Medidas corporales (Fecha/Altura/Peso) y la de Evaluación física por pestañas, con el % de cambio de cada ejercicio coloreado (verde/rojo) contra su toma anterior y borrado por fila. Diseño validado antes en un prototipo de Claude Artifacts.

### Entrenamientos
Ficha por sesión: fecha, objetivo del entrenamiento, horarios (cancha/físico, en su propio bloque debajo del objetivo — separado de Preparación física), asistencia, y una lista de **bloques de trabajo** (rango de minutos + título + descripción del ejercicio) — reflejando cómo está organizada hoy la pestaña "Federal 2026 - Temporada Regular + Post Temporada" (semanas en columnas, bloques de tiempo tipo `0'-5': Charla`, `5'-20': 5v0 Spacing`, etc). Cada bloque se puede **editar**, **duplicar** (clona horario/título/descripción/diagramas) o **eliminar** una vez ya creado (solo íconos, sin texto, para que entren en una sola fila en mobile), para repetir o corregir una dinámica sin recrearla. El evento de Entrenamiento completo también se puede duplicar (ver "Calendario" arriba).

**Control de carga física (RPE)**: por jugador, escala 1-10 con semáforo de color (1-3 verde, 4-6 amarillo, 7-8 naranja, 9-10 rojo) + nota, cargable individualmente o con "Asignar a todos".

**Evento Individual**: variante de Entrenamiento para trabajo 1 a 1 — un mismo evento contiene un plan por jugador (objetivo, prep. física, bloques de cancha propios), reutilizando los mismos componentes de bloques/diagramas. Cada plan tiene un jugador asignado editable (se puede corregir sin borrar todo) y se puede **duplicar el plan completo** de un jugador a otro cuando dos hicieron el mismo trabajo.

**Diagramas de cancha por bloque** (inspirado en la app "Basketball Playbook"):
- Herramientas: Mover, + Jugador ofensivo, + Jugador defensivo, + Coach, Balón, Pase, Dribbling, Corte, Cortina, Lanzamiento, Borrar — la barra muestra solo el ícono de cada una (igual en mobile y desktop) con tooltip nativo (`title`) al pasar el mouse para saber qué es.
- Jugadores: círculos numerados, ofensivos en azul, defensivos en rojo con "X" + número, se agregan tocando la cancha y se arrastran con la herramienta "Mover".
- Coach: círculo dorado con la letra "C" (sin número), misma mecánica que un jugador (se agrega/mueve/borra igual).
- Balón: se pueden agregar **varios** balones (cada clic con la herramienta "Balón" suma uno nuevo, no reemplaza al anterior), cada uno movible/borrable por separado. Los diagramas guardados con el formato viejo (un solo balón) se siguen mostrando bien.
- Líneas (según convención real del básquet):
  - **Pase** = línea punteada con flecha.
  - **Dribbling** = línea en zigzag con flecha.
  - **Corte** (correr sin balón) = línea sólida con flecha.
  - **Cortina/bloqueo** = línea sólida terminada en una "T" perpendicular (sin flecha).
- Toggle de **media cancha / cancha completa**.
- Implementado con SVG (no canvas), para que los elementos (jugadores, líneas) sean objetos manipulables y no un dibujo de trazo libre.
- Pendiente a futuro: acercar más la funcionalidad a la app "Basketball Playbook" (animación de la jugada, exportar como imagen/PDF).

### Biblioteca (bloques de cancha reutilizables)
Sección propia del menú (`schema_biblioteca_bloques.sql`, tabla `biblioteca_bloques`) para no recrear desde cero un ejercicio/jugada que ya se planificó antes. Los bloques de la biblioteca son independientes de los que viven dentro de un evento (`eventos.bloques`/`planesIndividuales`) — **insertar o guardar siempre clona** (nuevo id de bloque, nuevos ids de diagrama), así editar la copia dentro de un entrenamiento nunca modifica lo guardado en la biblioteca, y borrar de la biblioteca no afecta a los eventos donde ya se usó.
- Desde la propia Biblioteca: alta/edición/borrado de bloques (título, descripción, diagramas de cancha) sin necesidad de estar dentro de un entrenamiento.
- Desde `BloquesConCanchaSection` (dentro de un Entrenamiento o Individual): ícono de guardar (marcador) en cualquier bloque ya creado para copiarlo a la biblioteca, y botón "Desde la biblioteca" que abre un selector para insertar una copia de un bloque guardado.
- Global para todo el club (no se filtra por Categoría/Tira ni por Temporada) — un mismo ejercicio táctico sirve para cualquier equipo.
- Mismos permisos que "bloques de cancha" del resto de Entrenamientos: Head Coach/Asistente Técnico leen y escriben, Preparador Físico solo lectura, Jugador sin acceso (RLS en `schema_biblioteca_bloques.sql`, criterio `mi_rol()`).

### Partidos y Scouting rival (Scouting Hub)
Ficha por partido, calcada de la pestaña real "Plan de Juego", enlazada al **Scouting Hub** (`equipos_rivales`/`jugadores_rivales`, cada equipo rival atado a una Temporada — ver sección "Temporadas" arriba):
- Header editable: rival (con vínculo relacional al equipo rival cargado en el Hub), fecha, jornada, condición (local/visitante), horario, citación, resultado.
- **Scouting colectivo**: lista de características del rival (bullets editables) + video de YouTube embebido (reproductor in-app, no redirección externa) para scouting colectivo.
- **Plantel rival**: tabla con número, nombre, características, posición (+ posición secundaria opcional, mismo criterio que Plantel propio), categoría, y video de YouTube embebido por jugador (scouting individual).
- **Plan de juego — ataque**: texto libre + chips de **Transición** (Libre, Alto, Bajo, Pantalón) y **Set ofensivo** (Camiseta, Puño, Fijo, Uno, Cuerno) — biblioteca de sistemas propios reutilizable entre partidos.
- **Plan de juego — defensa**: texto libre + chips de **Defensa de cortinas** (0, 1, 2, 0+Show, Trap, Switch, Ice/Rojo) + claves + "directos"/"indirectos".

### Estadísticas
Módulo implementado (adelantado respecto a la prioridad original de Fase 3). Reemplaza la planilla "Estadísticas - Liga Federal 2026":
- Se sube el **PDF de estadísticas de la CABB** (formato Gesdeportiva) y se parsea 100% client-side (`pdfjs-dist`, sin backend), extrayendo jugadores y totales de ambos equipos.
- Calcula métricas avanzadas (PLAY, POS, PPLAY, PPOS, TOV%, eFG%) verificadas contra el script de Power Query que se usaba antes en Excel.
- Vista previa editable antes de guardar (por equipo: nombre + jugadores + totales), con vínculo a jugadores propios (Plantel, acotado a la categoría/tira del filtro activo — no todo el club) o rivales (Scouting Hub). El desplegable "Vincular" también permite **crear el jugador rival al vuelo** (queda en `jugadores_rivales` del equipo correcto) si todavía no estaba cargado en el Hub. El campo "Vincular equipo (Scouting Hub)" desaparece del lado marcado como "nosotros" (¿Cuál de los dos somos nosotros?) — el propio club no es un rival para vincular.
- Header del partido: **Torneo** se autocompleta con el nombre de la Temporada activa (editable); al cargar un partido nuevo (no al editar uno ya guardado) el campo es en realidad un **desplegable de temporadas** de esa categoría/tira (pasadas y la activa) para poder elegir a qué competencia pertenece sin salir del formulario — cambiarlo resetea el vínculo de Scouting Hub de ambos lados (es por temporada) y recalcula el plantel propio/rival disponible para vincular contra esa temporada puntual. "Jornada / Fase" es el campo que antes decía "Categoría" (así es como venía el dato realmente desde el PDF de la CABB).
- **Se puede cargar un partido nuevo en una temporada pasada** (para ir completando historial), no solo en la activa — vincula contra el plantel de esa temporada puntual. Editar/eliminar un partido que **ya está guardado** sigue restringido a la temporada activa (o a "sin asignar"), para no tocar por accidente un archivo histórico.
- **Editar un partido ya cargado**: ícono de lápiz en "Partidos cargados" trae ese partido de vuelta a la misma vista previa editable (header, totales, vínculos de jugador) y guarda con `update` en vez de `insert` (reemplaza las filas hijas de `jugador_partido_stats`/`equipo_partido_stats` enteras, no intenta mergear fila por fila).
- **Alias automático**: la primera vez que se vincula a mano un equipo o jugador de un PDF, se guarda el nombre exacto → id elegido. En próximas cargas del mismo equipo/jugador, el vínculo se autocompleta solo.
- Guarda en Supabase: `partidos_stats` (incluye `equipo_propio`, LOCAL/VISITANTE, autodetectado comparando contra "NAUTICO HACOAJ" y editable si el PDF trae el nombre distinto), `jugador_partido_stats`, `equipo_partido_stats` (+ `alias_equipo`, `alias_jugador`, `alias_jugador_rival`).
- **Promedios conectados**: la ficha de equipo rival (Scouting Hub) y cada jugador propio (Plantel) muestran sus promedios reales (PJ, PTS, RT, AST, REC, eFG%) leyendo las vistas `vista_promedios_equipo`/`vista_promedios_jugador`, ya filtradas por la Temporada activa (ver sección "Temporadas" arriba) — no son un acumulado de toda la vida del jugador/equipo.
- Pendiente: las vistas de "resumen oponentes"/resultados por condición que hoy existen en la planilla vieja (record ganados/perdidos ya existe como vista `vista_record_equipo`, ya con `temporada_id`, pero todavía no está conectada a ninguna pantalla).

### Jugador 360° (ficha integral de rendimiento)
Tablero de consulta (sin edición propia) por jugador, con buscador/selector scopeado a la Categoría/Tira/Temporada activa (mismo `TeamContext` que el resto de la app, incluye selector para mirar una temporada pasada). El buscador es un combobox desplegable (se abre al enfocar/escribir, se cierra al elegir o tocar afuera) en vez de una lista fija siempre visible. Fases:
- **Fase 1 (✅ implementada)**: ficha base — foto de perfil (`jugadores.foto_url`, bucket de Supabase Storage `fotos-jugadores`; el upload real vive en Plantel/`JugadorFormModal`, acá solo se muestra), dorsal, nombre, posición, altura/peso/edad calculada, semáforo de disponibilidad con detalle de lesión si corresponde.
- **Fase 2 (✅ implementada)**: evaluaciones físicas del PF (`EvaluacionesFisicasPanel`, sobre `jugadores.evaluaciones_pfs` — ver protocolo y carga en la sección "Plantel" arriba). Solo consulta (la carga es desde Plantel, no desde acá): pestañas Fuerza/Potencia/Aceleración con el último valor de cada ejercicio y su % de cambio vs. la toma anterior, **alerta de asimetría** en los saltos unilaterales (CMJ y Salto en Largo Derecha vs. Izquierda — diferencia mayor al 10% dispara el aviso de riesgo, umbral consensuado con los PFs), e historial compacto de 3 ejercicios de referencia (Sentadilla/CMJ/10m). Si el jugador todavía no tiene ninguna evaluación cargada, muestra el cartel "próximamente" (no simula datos). Diseño validado antes en un prototipo de Claude Artifacts.
- **Fase 3 (✅ implementada)**: analítica comparada — promedios de la temporada activa (PJ, Min, Plays con ranking "N° del equipo" por uso ofensivo, PTS/AST/RD/RO, PER/ROB, PTS por Play, T2/T3/TL con Metidos/Intentados+%, y en Eficiencia también eFG%, %TOV [Pérdidas/Plays] y ratio AST/TOV) contrastados contra la media del equipo y de su posición, calculadas en el cliente sobre `vista_promedios_jugador` (sin vistas SQL nuevas). Diseño visual (barra comparativa con marcas de equipo/posición) validado antes en un prototipo de Claude Artifacts con datos mockeados. Si el jugador tiene posición secundaria, la media "de su posición" se calcula contra la unión de ambos grupos (cualquier jugador que comparta alguna de las dos posiciones con el seleccionado).
- **Fase 4 (✅ implementada)**: modo espejo (`ModoEspejoPanel`) — comparación directa de 2 jugadores lado a lado, reutilizando exactamente el mismo set de métricas de la Fase 3 (Min, Plays, PTS/AST/RD/RO, PER/ROB, PTS por Play, T2/T3/TL, eFG%, %TOV, AST/TOV). Fetch propio contra `vista_promedios_jugador` filtrado a los 2 jugadores seleccionados + temporada activa, sin vistas SQL nuevas. Visual de "barra divergente" cabeza a cabeza (valor de cada jugador creciendo desde un eje central, ganador resaltado en verde) — el mismo lenguaje visual ya usado en la alerta de asimetría de Evaluaciones Físicas. Diseño validado antes en un prototipo de Claude Artifacts.

### Configuración
Panel de cuenta + administración, visible para Head Coach/Asistente Técnico/Preparador Físico (no Jugador — es una cuenta compartida por equipo, y un cambio de contraseña self-service ahí dejaría afuera a todo el mundo sin avisar):
- **Mi cuenta**: email, chip de rol, y cambiar contraseña (conectado de verdad a `supabase.auth.updateUser`).
- **Temporadas y competencias**: oculta por completo para Preparador Físico (`esStaffCompleto(rol)`, no un simple disabled). Listado de todas las competencias del club (no solo el filtro activo), alta libre de nombre/año/categoría/tira, y "Establecer como activa" — desactiva la temporada activa anterior de ese mismo equipo (categoría+tira) e impacta al instante en `TeamContext` vía `refrescarTemporadas()`.

## Roadmap general

1. **Fase 1 (MVP)**: ✅ Calendario + Entrenamientos + Partidos con scouting/plan de juego, todo enlazado. ✅ Login multiusuario con roles (RBAC) — Head Coach, Asistente Técnico, Preparador Físico, Jugador (ver "Autenticación y Roles").
2. **Fase 2**: ✅ Fichas de jugadores propios (Plantel) y rivales (Scouting Hub) más completas. ✅ Biblioteca de bloques de cancha reutilizables — ver sección "Biblioteca" arriba. ❌ Historial de cambios visible — descartado, no se va a implementar.
3. **Fase 3**: ✅ Módulo de estadísticas (CABB) — adelantado, ya en producción, con promedios conectados a Scouting/Plantel. ⏳ Notificaciones, comentarios por ficha, importador de datos históricos desde Google Sheets.
4. **Extra (no estaba en el roadmap original)**: ✅ Módulo Inicio (dashboard) — pantalla de arranque con lo más urgente de cada módulo en un solo lugar. ✅ Reestructuración por Temporadas/Competencias (Plantel, Scouting y Estadísticas) — ver sección "Temporadas" arriba; tampoco estaba en el roadmap original, se hizo para no perder historial al cambiar de plantel/rivales/torneo año a año. ✅ Panel de Configuración (cuenta + gestión de Temporadas) — ver sección "Configuración" arriba.
5. **Módulo: Vista 360° y Rendimiento Integral del Jugador** — ver sección "Jugador 360°" arriba. ✅ Fase 1 (ficha base + foto de perfil). ✅ Fase 2 (evaluaciones físicas del PF, protocolo de 14 ejercicios con alerta de asimetría). ✅ Fase 3 (analítica comparada vs. equipo/posición). ✅ Fase 4 (modo espejo, comparación directa jugador vs. jugador).

## Notas de diseño

El escudo de Náutico Hacoaj ya está cargado en la app. La paleta ya no es un placeholder: el color principal (`brand-300` a `brand-950` en `src/index.css`, vía `@theme` de Tailwind v4) es el azul del club, muestreado directo del escudo (`#01215A`) — se usa en navegación, botones principales, Login, y en Partido/Scouting Hub (que antes tenían su propio naranja). El fondo se mantiene oscuro (zinc-950/900).

Colores por tipo de evento/módulo (siguen existiendo aparte del azul de marca, para poder distinguir de un vistazo qué es cada cosa en el Calendario): Entrenamiento = cyan, Individual = teal, Partido = azul de marca, Libre = gris, Optativo = ámbar, Especial/Evento = púrpura. Los colores semánticos de estado (semáforo RPE 1-10, Disponible = verde, Lesionado = rojo, Duda = ámbar) no se tocaron — no son de marca, son códigos de significado.

**Mobile (`src/index.css`)**: todo `input`/`select`/`textarea` fuerza `font-size: 16px` por debajo de 768px, para que iOS/Android no disparen su zoom automático al enfocar un campo con texto más chico (quedaba con el zoom pegado). El color de foco también se fuerza al azul de marca (`outline`), en vez del acento que traiga el navegador por defecto (ej. Samsung Internet lo muestra naranja). Fuera de eso, filas de cabecera con varios botones (fichas de evento, header de Plantel, etc.) usan `flex-wrap` para no desbordar el ancho de pantalla en vez de asumir que siempre entran en una sola línea.

## Módulos planificados (roadmap técnico)

Reingenierías definidas pero **todavía no arrancadas** — no tocar código/Supabase para esto hasta que se pida explícitamente empezarlo.

### 🔄 Módulo Planificado (Próximamente): Migración de RPE a Control de Wellness Automatizado por Categoría y Tira

**Objetivo:** Reemplazar por completo el actual módulo de control de carga manual RPE por un sistema automatizado de Cuestionario de Bienestar (Wellness / Control de Fatiga), consumiendo datos de forma nativa desde un único formulario inteligente de Google Forms sin intermediarios externos.

**Arquitectura Técnica del Sistema:**

#### 📱 1. Flujo del Formulario Único Inteligente (Google Forms)
- **Sección 1 (Matriz):** El jugador selecciona su equipo exacto mediante un menú desplegable estructurado por pares (ej: "Mayores - Tira Blanca", "Mayores - Tira Azul", "Liga Próximo - Tira Blanca").
- **Sección 2 (Lógica de Salto):** El formulario redirige al usuario a la sección específica de su Categoría y Tira, mostrando un desplegable que contiene ÚNICAMENTE los nombres de los jugadores activos de ese equipo.
- **Sección 3 (Métricas):** El jugador responde las 4 preguntas estándar de Bienestar antes de entrenar en escala del 1 al 10: Calidad del Sueño, Nivel de Fatiga, Dolor Muscular (DOMS) y Nivel de Estrés.

#### 🗄️ 2. Mutación de la Base de Datos (Supabase)
La infraestructura del antiguo RPE se reconvierte en la tabla `public.wellness_diario` con la siguiente estructura:
- `id` (uuid, primary key)
- `jugador_id` (uuid, references public.jugadores)
- `temporada_id` (uuid, references public.temporadas — para aislamiento de torneos)
- `fecha` (date — extraída de la marca de tiempo de Google)
- `categoria` y `tira` (text — para indexación rápida)
- `sueno`, `fatiga`, `dolor_muscular`, `estres` (integers del 1 al 10)
- `promedio_wellness` (numeric — cálculo automático: suma de las 4 variables dividida entre 4)
- `notas_medicas` (text — casillero mutable para que el PF edite estados o trabajos diferenciados desde la interfaz)

#### 🔄 3. Automatización Nativa (Google Apps Script)
- **Ingreso de Datos (Disparador OnFormSubmit):** Un script de JavaScript alojado en el Google Sheet vinculado procesará cada envío en tiempo real, calculará las métricas, resolverá el `jugador_id` mediante una consulta API rápida a Supabase según el nombre/equipo en la temporada activa, y realizará un `.upsert()` limpio en la tabla.
- **Sincronización de Roster (Webhook Inverso):** Al añadir o dar de baja un jugador en la app, Supabase disparará un Webhook hacia Google Apps Script (Web App endpoint) para reescribir automáticamente los menús desplegables de nombres en Google Forms, evitando el mantenimiento manual.

#### 📊 4. Rediseño del Dashboard del PF
El semáforo deportivo actual se reconvierte para escuchar el `promedio_wellness`. Si un jugador registra un índice bajo en la fecha actual, la portada disparará una alerta roja visual de riesgo de lesión antes de que inicie la práctica de Hacoaj HoopsPro.
