# Proyecto: Sistema para staff técnico de básquet

## Contexto

Soy entrenador (DT) de un equipo de primera división de básquet. Hoy el staff técnico trabaja con varias planillas de Google Sheets sueltas (calendario, planificación de entrenamientos, plan de juego/scouting por partido). El objetivo es reemplazar eso por un sistema único, interconectado, usable desde web y celular por igual, donde todo el cuerpo técnico pueda cargar y consultar información sin duplicar datos ni pisarse versiones.

- Uso: tanto en celular (cancha, viajes) como en compu (armando planificación) — pensado como una **PWA** (una sola base de código, funciona en navegador y se puede instalar en el celular, con uso offline parcial).
- Permisos: todo el staff edita por igual (no hace falta un sistema de roles complejo al inicio), pero conviene guardar historial de quién cambió qué.

Ya existe un **prototipo funcional en React** (datos en memoria, sin backend todavía) que sirve como punto de partida de la UI y el modelo de datos: `staff-basquet-app.jsx` (y una versión standalone sin dependencias de build en `staff-basquet-app-standalone.html`).

## Próximo paso pedido

Armar un proyecto React/Vite real a partir de `staff-basquet-app.jsx` que corra con `npm run dev`, manteniendo toda la funcionalidad ya construida, como base para después sumar backend (base de datos + multiusuario).

## Módulos y modelo de datos

### Calendario (módulo central)
Vista mensual, cada evento enlaza a su ficha (entrenamiento o partido). Tipos de evento: `entrenamiento`, `partido`, `libre`, `optativo`, `especial`. Basado en cómo hoy se arma la pestaña "Calendario Formato Mensual" de la planilla real (grilla mensual con texto libre por celda, que en el sistema pasa a ser un evento real).

### Entrenamientos
Ficha por sesión: fecha, objetivo de la semana, asistencia, y una lista de **bloques de trabajo** (rango de minutos + título + descripción del ejercicio) — reflejando cómo está organizada hoy la pestaña "Federal 2026 - Temporada Regular + Post Temporada" (semanas en columnas, bloques de tiempo tipo `0'-5': Charla`, `5'-20': 5v0 Spacing`, etc).

**Diagramas de cancha por bloque** (ya implementado en el prototipo, inspirado en la app "Basketball Playbook"):
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

### Partidos y Scouting rival
Ficha por partido, calcada de la pestaña real "Plan de Juego":
- Header: rival, fecha, jornada, condición (local/visitante), horario, citación, resultado.
- **Scouting colectivo**: lista de características del rival (bullets editables) + campo de **link de YouTube** para video colectivo del rival.
- **Plantel rival**: tabla con número, nombre, características, posición, categoría, y **link de YouTube** por jugador (scouting individual).
- **Plan de juego — ataque**: texto libre + chips de **Transición** (Libre, Alto, Bajo, Pantalón) y **Set ofensivo** (Camiseta, Puño, Fijo, Uno, Cuerno) — biblioteca de sistemas propios reutilizable entre partidos.
- **Plan de juego — defensa**: texto libre + chips de **Defensa de cortinas** (0, 1, 2, 0+Show, Trap, Switch, Ice/Rojo) + claves + "directos"/"indirectos".

### Estadísticas (prioridad baja, funcionalidad futura)
Hay una tercera planilla ("Estadísticas - Liga Federal 2026") que procesa datos descargados de la app de la CABB para generar estadísticas del torneo por jugador y equipo (PJ, minutos, puntos, %T2/%T3/%T1, rebotes, asistencias, recuperos, pérdidas, PER, eFG%, etc.) y resultados por condición. Se contempla como módulo de estadísticas enlazado a Jugador y Partido, pero es la última prioridad de desarrollo.

## Roadmap general

1. **Fase 1 (MVP)**: Calendario + Entrenamientos + Partidos con scouting/plan de juego, todo enlazado, multiusuario con login simple.
2. **Fase 2**: Biblioteca de ejercicios/jugadas reutilizables, fichas de jugadores propios y rivales más completas, historial de cambios visible.
3. **Fase 3**: Notificaciones, comentarios por ficha, importador de datos históricos desde Google Sheets, módulo de estadísticas (CABB).

## Notas de diseño

Todavía no se definió el diseño visual final (colores, escudo del club) — eso se suma más adelante cuando el dueño del proyecto pase el logo y los colores del club. Por ahora el prototipo usa un estilo oscuro (zinc/naranja) solo funcional, no definitivo.
