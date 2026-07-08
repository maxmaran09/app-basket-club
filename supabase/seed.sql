-- OPCIONAL: carga los 8 eventos de ejemplo que hoy estan hardcodeados en App.jsx, ya traducidos
-- al esquema de supabase/schema.sql. Correlo una sola vez (no es idempotente: si lo pegas dos
-- veces, duplica las filas, porque el id es un uuid autogenerado).
-- Requiere haber corrido schema.sql antes.

insert into public.eventos
  (date, type, categoria, tira, title, "objetivoSemana", asistencia, "horarioBasquet", "horarioFisico", "cargaFisica", "lugarFisico", "enfoqueFisico", "notasFisicas", bloques)
values (
  '2026-07-06', 'entrenamiento', 'Mayores', 'Blanca',
  $$Entrenamiento normal$$,
  $$Mantener intensidad defensiva de cara al cruce de playoff$$,
  $$7 Mayores + 9 U21 + 3 U17$$,
  $$20:00 a 21:30 hs$$,
  $$19:00 a 20:00 hs$$,
  'Alta', 'Cancha',
  $json$["Potencia", "Resistencia"]$json$::jsonb,
  $$Buena respuesta general. Cuidar rodilla de Pérez, trabajo regenerativo.$$,
  $json$[
    {"id":"b1","inicio":"0'","fin":"5'","titulo":"Charla de inicio","desc":"Repaso de objetivos del día y foco defensivo."},
    {"id":"b2","inicio":"5'","fin":"20'","titulo":"5v0 Spacing","desc":"Rompimiento del perímetro, juego del PB, juego desde la puerta de atrás."},
    {"id":"b3","inicio":"20'","fin":"40'","titulo":"5v5 formación de libre","desc":"Perímetros 45/45/esquina, grandes PB y top. Si pierden, ayuda y rotamos."},
    {"id":"b4","inicio":"40'","fin":"60'","titulo":"Series de lanzamiento","desc":"Objetivo 60 conversiones en pareja, corto-medio-largo."},
    {"id":"b5","inicio":"60'","fin":"80'","titulo":"5v5 bloques de 3'","desc":"14'' de posesión después de gol."},
    {"id":"b6","inicio":"80'","fin":"90'","titulo":"Tiros libres","desc":"100 metidos entre todos."}
  ]$json$::jsonb
);

insert into public.eventos
  (date, type, categoria, tira, title, rival, jornada, condicion, horario, citacion, resultado, "videoColectivo", "scoutingColectivo", "plantelRival", "planAtaque", "planDefensa", ataque, defensa)
values (
  '2026-07-08', 'partido', 'Mayores', 'Blanca',
  $$vs 3 DE FEBRERO$$, $$3 DE FEBRERO$$, $$Playoff — Juego 1$$, 'LOCAL', $$20:30 hs$$, $$19:15 hs$$, $$$$,
  $$$$,
  $json$[
    "Equipo agresivo en defensa. Niegan líneas de pase, presionan balón.",
    "Buscan correr la cancha y atacar en ventaja.",
    "Dañan desde el juego interior de Barrionuevo o el juego colectivo de Gómez Colloca y Manrique.",
    "Defienden en bloque cerrado y pierden de vista a jugadores del lado contrario a la bola.",
    "Hacen presión zonal 2-2-1 todo el campo."
  ]$json$::jsonb,
  $json$[
    {"numero":"7","nombre":"Celano","caracteristicas":"Base que ordena. Buenas descargas en el PnR. Tiro de 3 a pie firme.","posicion":"Base","categoria":"U21","video":""},
    {"numero":"4","nombre":"Manrique","caracteristicas":"1er paso potente. Tira y ataca en cualquier momento. Tiro de 3, stop y tiro.","posicion":"Escolta","categoria":"Mayor","video":""},
    {"numero":"13","nombre":"Heredia","caracteristicas":"Tiro a pie firme de 3 puntos. Rachero y letal.","posicion":"Alero","categoria":"Mayor","video":""},
    {"numero":"6","nombre":"Barrionuevo","caracteristicas":"Pesado. Buen juego de pies en el poste bajo. Buenas cortinas.","posicion":"Pivot","categoria":"Mayor","video":""}
  ]$json$::jsonb,
  $$Generar ventajas desde el ataque rápido y las conexiones. Ante cada rompimiento, barrer el fondo para castigar las ayudas. No forzar situaciones, jugar para el compañero mejor ubicado. Cargar al rebote ofensivo. Leer las ventajas y castigarlas.$$,
  $$Concentrar la defensa en que Manrique tome todas las decisiones de tiro, obligarlo a jugar 1v1 marcado. PnR con Barrionuevo: rechazar la cortina. El foco está en sacarles el juego en equipo.$$,
  $json${"claves":["Llegar a zona de ataque en menos de 4''.","Ocupar esquinas en transición.","Tocar pintura para generar ventajas.","Menos de 3 pérdidas por cuarto."],"transicion":["Libre","Alto"],"set":["Camiseta","Puño"]}$json$::jsonb,
  $json${"claves":["Agresividad al balón. Responsabilidad del 1v1.","Líneas de pase en rotación de balón.","Emparejar rápido todo el tiempo.","Box out, sobre todo con Barrionuevo."],"directos":["0+Suelto con Actis","0+Show con el resto"],"indirectos":["1 entre pares","0 en bloqueos a grandes a perímetros"],"cortinas":["0+Show","Ice / Rojo"]}$json$::jsonb
);

insert into public.eventos
  (date, type, categoria, tira, title, "objetivoSemana", asistencia, "horarioBasquet", "horarioFisico", "cargaFisica", "lugarFisico", "enfoqueFisico", "notasFisicas", bloques)
values (
  '2026-07-04', 'entrenamiento', 'Mayores', 'Blanca',
  $$Entrenamiento (defensa del PnR)$$,
  $$Agresividad de la bola en el PnR$$,
  $$6 Mayores + 9 U21$$,
  $$19:15 a 21:00 hs$$,
  $$18:30 a 19:15 hs$$,
  'Media', 'Gimnasio de pesas',
  $json$["Fuerza"]$json$::jsonb,
  $$$$,
  $json$[
    {"id":"b1","inicio":"5'","fin":"15'","titulo":"Activación con conversiones","desc":"60 conversiones en 3 min, tirador rebotea."},
    {"id":"b2","inicio":"15'","fin":"22'","titulo":"3v3 desde 0+Show","desc":"El manejador solo tira si pisa pintura."},
    {"id":"b3","inicio":"40'","fin":"60'","titulo":"Lanzamiento","desc":"Pie firme y desde el dribling."}
  ]$json$::jsonb
);

insert into public.eventos
  (date, type, categoria, tira, title, rival, jornada, condicion, horario, citacion, resultado, "videoColectivo", "scoutingColectivo", "plantelRival", "planAtaque", "planDefensa", ataque, defensa)
values (
  '2026-07-11', 'partido', 'Mayores', 'Blanca',
  $$vs GEVP$$, $$GEVP$$, $$Fecha 1$$, 'LOCAL', $$21:00 hs$$, $$19:45 hs$$, $$$$, $$$$,
  $json$["Equipo veloz, transición constante.", "Poco rebote ofensivo, hay que correr rápido."]$json$::jsonb,
  $json$[{"numero":"10","nombre":"Pérez","caracteristicas":"Base veloz, buen manejo.","posicion":"Base","categoria":"Mayor","video":""}]$json$::jsonb,
  $$Correr cada posesión defensiva convertida en recupero.$$,
  $$Transición defensiva inmediata, balance permanente.$$,
  $json${"claves":["Cargar al rebote ofensivo."],"transicion":["Bajo"],"set":["Fijo"]}$json$::jsonb,
  $json${"claves":["Balance defensivo permanente."],"directos":[],"indirectos":[],"cortinas":[]}$json$::jsonb
);

insert into public.eventos (date, type, categoria, tira, title)
values ('2026-07-05', 'libre', 'Mayores', 'Blanca', $$Libre$$);

insert into public.eventos (date, type, categoria, tira, title)
values ('2026-07-07', 'optativo', 'Mayores', 'Blanca', $$Optativo$$);

insert into public.eventos
  (date, type, categoria, tira, title, "objetivoSemana", asistencia, "horarioBasquet", "horarioFisico", "cargaFisica", "lugarFisico", "enfoqueFisico", "notasFisicas", bloques)
values (
  '2026-07-09', 'entrenamiento', 'Juveniles', 'Azul',
  $$Entrenamiento Juveniles$$,
  $$Fundamentos de manejo de balón y transición$$,
  $$12 jugadores$$,
  $$18:00 a 19:30 hs$$,
  $$17:30 a 18:00 hs$$,
  'Baja', 'Mixto',
  $json$["Movilidad", "Velocidad"]$json$::jsonb,
  $$$$,
  $json$[
    {"id":"b1","inicio":"0'","fin":"10'","titulo":"Entrada en calor","desc":"Manejo de balón individual, dos pelotas."},
    {"id":"b2","inicio":"10'","fin":"35'","titulo":"3v3 transición","desc":"Salida rápida tras rebote defensivo."}
  ]$json$::jsonb
);

insert into public.eventos
  (date, type, categoria, tira, title, rival, jornada, condicion, horario, citacion, resultado, "videoColectivo", "scoutingColectivo", "plantelRival", "planAtaque", "planDefensa", ataque, defensa)
values (
  '2026-07-10', 'partido', 'Cadetes', 'Celeste',
  $$vs ATENAS$$, $$ATENAS$$, $$Fecha 3$$, 'VISITANTE', $$18:00 hs$$, $$16:45 hs$$, $$$$, $$$$,
  $json$["Equipo joven, ataca en transición."]$json$::jsonb,
  $json$[]$json$::jsonb,
  $$Correr el primer pase tras rebote.$$,
  $$Balance defensivo y repliegue rápido.$$,
  $json${"claves":[],"transicion":[],"set":[]}$json$::jsonb,
  $json${"claves":[],"directos":[],"indirectos":[],"cortinas":[]}$json$::jsonb
);
