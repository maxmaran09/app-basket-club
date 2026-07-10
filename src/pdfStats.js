import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export const round2 = (n) => Math.round(n * 100) / 100;
export const round3 = (n) => Math.round(n * 1000) / 1000;

// Normaliza un nombre (de equipo o jugador) para comparar de forma exacta pero insensible a
// mayúsculas/espacios — es la clave que usan las tablas de alias para "recordar" un vínculo.
export const normalizeName = (s) => (s || "").toUpperCase().replace(/\s+/g, " ").trim();

// Nombre del club propio tal como aparece en el encabezado del PDF de la CABB — se usa para
// detectar solo, al guardar un partido, si jugamos de local o visitante (necesario para calcular
// "puntos a favor vs en contra" en el dashboard). Si un PDF puntual lo escribe distinto, el
// usuario corrige el lado a mano en la vista previa de Estadísticas.
export const NOMBRE_CLUB_PROPIO = "NAUTICO HACOAJ";

export function detectarEquipoPropio(equipoLocal, equipoVisitante) {
  if (normalizeName(equipoLocal) === NOMBRE_CLUB_PROPIO) return "LOCAL";
  if (normalizeName(equipoVisitante) === NOMBRE_CLUB_PROPIO) return "VISITANTE";
  return null;
}

// Métricas avanzadas: PLAY = T2I+T3I+0.44*T1I+PER, POS = PLAY-ROF, PPLAY = PTS/PLAY,
// PPOS = PTS/POS, TOV% = PER/PLAY, eFG% = (T2A+1.5*T3A)/(T2I+T3I). Se usa tanto al parsear
// el PDF como al "recalcular" en la vista previa después de una corrección manual.
export function computeAdvancedStats({ t2a, t2i, t3a, t3i, t1i, per, rof, pts }) {
  const play = t2i + t3i + 0.44 * t1i + per;
  const pos = play - rof;
  return {
    play: round2(play),
    pos: round2(pos),
    pplay: play ? round3(pts / play) : 0,
    ppos: pos ? round3(pts / pos) : 0,
    tov_pct: play ? round3(per / play) : 0,
    efg_pct: t2i + t3i ? round3((t2a + 1.5 * t3a) / (t2i + t3i)) : 0,
  };
}

// Agrupa los items de texto posicionados del PDF en líneas visuales (misma banda de Y),
// ordenados de arriba hacia abajo y de izquierda a derecha dentro de cada línea.
function groupIntoLines(items) {
  const sorted = [...items].sort((a, b) => b.transform[5] - a.transform[5]);
  const TOL = 2.5;
  const clusters = [];
  let current = null;
  sorted.forEach((item) => {
    const y = item.transform[5];
    if (current && Math.abs(current.y - y) <= TOL) {
      current.items.push(item);
    } else {
      current = { y, items: [item] };
      clusters.push(current);
    }
  });
  return clusters.map((c) =>
    c.items
      .sort((a, b) => a.transform[4] - b.transform[4])
      .map((i) => i.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

async function extractLines(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    lines.push(...groupIntoLines(content.items).filter(Boolean));
  }
  return lines;
}

// Una fila de jugador (o la fila TOTALES) tiene: [dorsal|"TOTALES"] [nombre...] MIN PTS
// T2A/T2I %T2 T3A/T3I %T3 T1A/T1I %T1 RDEF ROF RTOT AST REC PER TC TR FC FR VAL +/-
// El nombre tiene largo variable, así que se recorta desde los dos extremos: dorsal al
// principio, y el bloque fijo de 20 campos de estadísticas al final.
function parseStatLine(line) {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 21) return null;

  const isTotales = tokens[0] === "TOTALES";
  if (!isTotales && !/^\d+$/.test(tokens[0])) return null;

  const stat = tokens.slice(-20);
  const [minStr, pts, t2ai, pT2, t3ai, pT3, t1ai, pT1, rdef, rof, rtot, ast, rec, per, tc, tr, fc, fr, val, pm] = stat;
  // Hasta 2 dígitos para un jugador (ej "27:51"), hasta 3 para la fila TOTALES del equipo (ej "200:00").
  if (!/^\d{1,3}:\d{2}$/.test(minStr)) return null;
  if (!t2ai?.includes("/") || !t3ai?.includes("/") || !t1ai?.includes("/")) return null;

  const [t2a, t2i] = t2ai.split("/").map(Number);
  const [t3a, t3i] = t3ai.split("/").map(Number);
  const [t1a, t1i] = t1ai.split("/").map(Number);

  const nameTokens = tokens.slice(1, tokens.length - 20);
  const nombre = nameTokens.join(" ").replace(/\(CAP\)/i, "").replace(/\*/g, "").trim();

  const [mm, ss] = minStr.split(":").map(Number);
  const minutos = round2(mm + ss / 60);

  const perNum = Number(per);
  const rofNum = Number(rof);
  const ptsNum = Number(pts);

  return {
    esTotales: isTotales,
    dorsal: isTotales ? null : Number(tokens[0]),
    nombre_jugador: isTotales ? "TOTALES" : nombre,
    minutos,
    pts: ptsNum,
    t2a, t2i, t3a, t3i, t1a, t1i,
    rdef: Number(rdef), rof: rofNum, rtot: Number(rtot),
    ast: Number(ast), rec: Number(rec), per: perNum,
    tc: Number(tc), tr: Number(tr), fc: Number(fc), fr: Number(fr),
    val: Number(val), plusminus: Number(pm),
    ...computeAdvancedStats({ t2a, t2i, t3a, t3i, t1i, per: perNum, rof: rofNum, pts: ptsNum }),
  };
}

// Lee un PDF de estadísticas de la CABB (formato Gesdeportiva) y devuelve los datos de ambos
// equipos ya parseados y con las métricas avanzadas calculadas. Pensado para revisar/corregir
// en una vista previa antes de guardar — el parseo es best-effort sobre texto posicionado.
export async function parseCabbPdf(file) {
  const lines = await extractLines(file);

  const headerLine = lines.find((l) => /^Estad/i.test(l)) || "";
  const headerMatch = headerLine.match(
    /Estad[íi]sticas\s*-\s*(.+?)\s+vs\s+(.+?)\s*-\s*(.+?)\s*-\s*(.+?)\s*-\s*CABB\s*-\s*(\d{4})/i
  );
  const equipoLocal = headerMatch?.[1]?.trim() || "";
  const equipoVisitante = headerMatch?.[2]?.trim() || "";
  const torneo = headerMatch?.[3]?.trim() || "";
  const categoria = headerMatch?.[4]?.trim() || "";
  const anio = headerMatch?.[5]?.trim() || "";

  const equipos = [
    { nombre: equipoLocal, jugadores: [], totales: null },
    { nombre: equipoVisitante, jugadores: [], totales: null },
  ];
  let equipoActual = 0;

  lines.forEach((line) => {
    const row = parseStatLine(line);
    if (!row) return;
    if (row.esTotales) {
      equipos[equipoActual].totales = row;
      equipoActual = Math.min(equipoActual + 1, 1);
    } else {
      equipos[equipoActual].jugadores.push(row);
    }
  });

  return { equipoLocal, equipoVisitante, torneo, categoria, anio, equipos, lines };
}
