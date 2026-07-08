import React, { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, X, Plus, Users, Shield, Swords, Dumbbell, Trophy, Clock, MapPin, ArrowLeft, Tag, Youtube, PenLine, Eraser } from "lucide-react";
import { supabase } from "./supabaseClient";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

const TIPO_ESTILO = {
  entrenamiento: { bg: "bg-blue-500/15", text: "text-blue-300", dot: "bg-blue-400", label: "Entrenamiento" },
  partido: { bg: "bg-orange-500/15", text: "text-orange-300", dot: "bg-orange-400", label: "Partido" },
  libre: { bg: "bg-zinc-700/40", text: "text-zinc-400", dot: "bg-zinc-500", label: "Libre" },
  optativo: { bg: "bg-amber-500/15", text: "text-amber-300", dot: "bg-amber-400", label: "Optativo" },
  especial: { bg: "bg-purple-500/15", text: "text-purple-300", dot: "bg-purple-400", label: "Evento" },
};

const SISTEMAS = {
  transicion: ["Libre", "Alto", "Bajo", "Pantalón"],
  set: ["Camiseta", "Puño", "Fijo", "Uno", "Cuerno"],
  cortinas: ["0", "1", "2", "0+Show", "Trap", "Switch", "Ice / Rojo"],
};

const CATEGORIAS = ["Mayores", "Liga Próximo", "Juveniles", "Cadetes", "Infantiles", "Mini", "Pre-Mini", "Mosquitos"];
const TIRAS = ["Blanca", "Azul", "Celeste", "Femenino"];

const CARGAS_FISICAS = ["Baja", "Media", "Alta"];
const LUGARES_FISICOS = ["Cancha", "Gimnasio de pesas", "Mixto"];
const ENFOQUES_FISICOS = ["Velocidad", "Potencia", "Fuerza", "Resistencia", "Movilidad"];

function toKey(y, m, d) { return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }

function Chip({ children, tone = "zinc" }) {
  const map = {
    zinc: "bg-zinc-800 text-zinc-300 border-zinc-700",
    orange: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs border ${map[tone]} mr-1.5 mb-1.5`}>{children}</span>;
}

function Section({ icon: Icon, title, children, accent = "text-zinc-400" }) {
  return (
    <div className="mb-6">
      <div className={`flex items-center gap-2 mb-2 ${accent}`}>
        <Icon size={16} />
        <h3 className="text-xs font-bold uppercase tracking-widest">{title}</h3>
      </div>
      <div className="pl-1">{children}</div>
    </div>
  );
}

function TagPicker({ label, options, selected, onToggle, tone = "orange" }) {
  const activeCls = tone === "blue" ? "bg-sky-500/20 border-sky-500/50 text-sky-300" : "bg-orange-500/20 border-orange-500/50 text-orange-300";
  return (
    <div className="mb-3">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <div className="flex flex-wrap">
        {options.map((op) => {
          const active = selected.includes(op);
          return (
            <button key={op} onClick={() => onToggle(op)}
              className={`px-2.5 py-1 rounded text-xs border mr-1.5 mb-1.5 transition ${active ? activeCls : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600"}`}>
              {op}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EditableField({ label, icon, value, onSave, accent = "text-blue-400", multiline = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEdit = () => { setDraft(value); setEditing(true); };
  const save = () => { onSave(draft); setEditing(false); };

  return (
    <Section icon={icon} title={label} accent={accent}>
      {editing ? (
        <div className="space-y-2">
          {multiline ? (
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100" />
          ) : (
            <input value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100" />
          )}
          <div className="flex gap-2">
            <button onClick={save} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded">Guardar</button>
            <button onClick={() => setEditing(false)} className="text-zinc-400 text-xs px-3 py-1.5">Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-zinc-300 flex-1">{value || <span className="text-zinc-600">Sin datos.</span>}</p>
          <button onClick={startEdit} className="text-xs text-blue-400 hover:text-blue-300 shrink-0">Editar</button>
        </div>
      )}
    </Section>
  );
}

// Onda sinusoidal de longitud de onda fija (no importa el largo del segmento), que termina en un
// tramo recto final para que la flecha apunte en la dirección de la línea, no de la última onda.
function zigzagPoints(x1, y1, x2, y2) {
  const wavelength = 9, amp = 4, samplesPerWave = 8;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux;
  const tail = Math.min(wavelength * 0.55, len * 0.4);
  const waveLen = Math.max(len - tail, 0);
  const steps = Math.max(2, Math.round((waveLen / wavelength) * samplesPerWave));
  const pts = [];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const dist = t * waveLen;
    const bx = x1 + ux * dist, by = y1 + uy * dist;
    const offset = amp * Math.sin((2 * Math.PI * dist) / wavelength);
    pts.push({ x: bx + px * offset, y: by + py * offset });
  }
  pts.push({ x: x1 + ux * waveLen, y: y1 + uy * waveLen });
  pts.push({ x: x2, y: y2 });
  return pts;
}

function pathFromPoints(points, type) {
  if (!points || points.length < 2) return "";
  if (type === "dribbling") {
    let d = `M ${points[0].x} ${points[0].y} `;
    for (let i = 0; i < points.length - 1; i++) {
      zigzagPoints(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y).forEach((p) => { d += `L ${p.x} ${p.y} `; });
    }
    return d;
  }
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function screenTick(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux;
  const t = 6;
  return { ax: x2 + px * t, ay: y2 + py * t, bx: x2 - px * t, by: y2 - py * t };
}

const TACTIC_STROKE = 1.1;

function CourtLine({ l }) {
  const stroke = "#fb923c";
  const d = pathFromPoints(l.points, l.type);
  if (l.type === "pase") return <path d={d} fill="none" stroke={stroke} strokeWidth={TACTIC_STROKE} strokeDasharray="4 3" markerEnd="url(#arrowhead)" />;
  if (l.type === "dribbling") return <path d={d} fill="none" stroke={stroke} strokeWidth={TACTIC_STROKE} markerEnd="url(#arrowhead)" />;
  if (l.type === "cortina") {
    const last = l.points[l.points.length - 1];
    const prev = l.points[l.points.length - 2];
    const t = screenTick(prev.x, prev.y, last.x, last.y);
    return (
      <g>
        <path d={d} fill="none" stroke={stroke} strokeWidth={TACTIC_STROKE} />
        <line x1={t.ax} y1={t.ay} x2={t.bx} y2={t.by} stroke={stroke} strokeWidth={TACTIC_STROKE + 0.3} />
      </g>
    );
  }
  return <path d={d} fill="none" stroke={stroke} strokeWidth={TACTIC_STROKE} markerEnd="url(#arrowhead)" />;
}

// Ícono de tamaño fijo, orientable: primer clic ubica el símbolo, segundo clic define su dirección.
// Símbolo fijo "=>": dos barras y un chevron centrado verticalmente entre ambas, rotado según "angle".
function ShotIcon({ x, y, angle = 0, onMouseDown, onTouchStart, cursor = "pointer", faded = false }) {
  const stroke = "#fb923c";
  const barsLen = 8, gap = 2.4, chevron = 4.5;
  const tipX = x + barsLen + chevron;
  const deg = (angle * 180) / Math.PI;
  return (
    <g transform={`rotate(${deg} ${x} ${y})`} opacity={faded ? 0.5 : 1} onMouseDown={onMouseDown} onTouchStart={onTouchStart} style={{ cursor }}>
      <line x1={x} y1={y - gap / 2} x2={x + barsLen} y2={y - gap / 2} stroke={stroke} strokeWidth={TACTIC_STROKE} />
      <line x1={x} y1={y + gap / 2} x2={x + barsLen} y2={y + gap / 2} stroke={stroke} strokeWidth={TACTIC_STROKE} />
      <path d={`M ${x + barsLen} ${y - gap} L ${tipX} ${y} L ${x + barsLen} ${y + gap}`} fill="none" stroke={stroke} strokeWidth={TACTIC_STROKE} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function BallIcon({ x, y, r = 8, onMouseDown, onTouchStart, cursor = "pointer" }) {
  return (
    <g onMouseDown={onMouseDown} onTouchStart={onTouchStart} style={{ cursor }}>
      <circle cx={x} cy={y} r={r} fill="#f97316" stroke="#7c2d12" strokeWidth="1.2" />
      <line x1={x - r} y1={y} x2={x + r} y2={y} stroke="#7c2d12" strokeWidth="1" />
      <path d={`M ${x} ${y - r} Q ${x - r} ${y} ${x} ${y + r}`} fill="none" stroke="#7c2d12" strokeWidth="1" />
      <path d={`M ${x} ${y - r} Q ${x + r} ${y} ${x} ${y + r}`} fill="none" stroke="#7c2d12" strokeWidth="1" />
    </g>
  );
}

// Dibuja un aro con su línea de 3, zona, tiro libre y aro/tablero/red, para un extremo de la cancha.
// baseY = coordenada y de la línea de fondo; dir = +1 o -1, hacia dónde entra la cancha desde esa línea.
function CourtEnd({ w, S, baseY, dir }) {
  const cx = w / 2;
  const y = (m) => baseY + dir * m * S;
  const x = (m) => cx + m * S;

  const laneHalfW = 2.45, ftDist = 5.8, ftRadius = 1.8, noChargeR = 1.25;
  const basketDist = 1.575, tpRadius = 6.75, tpCornerX = 6.6;
  const backboardDist = 1.2, backboardHalfW = 0.9, rimR = 0.225;

  const sampleArc = (radius, centerM, thetaMax, steps = 24) => {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const theta = -thetaMax + (2 * thetaMax * i) / steps;
      pts.push({ x: x(Math.sin(theta) * radius), y: y(centerM + Math.cos(theta) * radius) });
    }
    return pts;
  };
  const toPath = (pts) => pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  const tpThetaMax = Math.asin(tpCornerX / tpRadius);
  const tpArc = sampleArc(tpRadius, basketDist, tpThetaMax);
  const tpPoints = [{ x: x(-tpCornerX), y: y(0) }, ...tpArc, { x: x(tpCornerX), y: y(0) }];
  const ftArc = sampleArc(ftRadius, ftDist, Math.PI / 2, 16);
  const noChargeArc = sampleArc(noChargeR, basketDist, Math.PI / 2, 16);

  const netTicks = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x1: x(0) + Math.cos(rad) * rimR * S, y1: y(basketDist) + Math.sin(rad) * rimR * S,
      x2: x(0) + Math.cos(rad) * rimR * 1.9 * S, y2: y(basketDist) + Math.sin(rad) * rimR * 1.9 * S,
    };
  });

  return (
    <g>
      <path d={toPath(tpPoints)} />
      <path d={`M ${x(-laneHalfW).toFixed(1)} ${y(0).toFixed(1)} L ${x(-laneHalfW).toFixed(1)} ${y(ftDist).toFixed(1)} L ${x(laneHalfW).toFixed(1)} ${y(ftDist).toFixed(1)} L ${x(laneHalfW).toFixed(1)} ${y(0).toFixed(1)}`} />
      <path d={toPath(ftArc)} />
      <path d={toPath(noChargeArc)} />
      <line x1={x(-backboardHalfW)} y1={y(backboardDist)} x2={x(backboardHalfW)} y2={y(backboardDist)} strokeWidth="3" />
      <circle cx={x(0)} cy={y(basketDist)} r={rimR * S} fill="#71717a" stroke="none" />
      {netTicks.map((t, i) => <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} strokeWidth="1" opacity="0.6" />)}
    </g>
  );
}

// Medidas FIBA reales (metros) escaladas a unidades SVG: ancho de cancha = 15m = w unidades.
function CourtBg({ w, h, courtType }) {
  const S = w / 15;
  const halfCourtW = 7.5;
  const ends = courtType === "full" ? [{ baseY: h, dir: -1 }, { baseY: 0, dir: 1 }] : [{ baseY: h, dir: -1 }];

  return (
    <g stroke="#71717a" strokeWidth="2" fill="none">
      <rect x={w / 2 - halfCourtW * S} y="0" width={halfCourtW * 2 * S} height={h} />
      {courtType === "full" && (
        <>
          <line x1="0" y1={h / 2} x2={w} y2={h / 2} />
          <circle cx={w / 2} cy={h / 2} r={1.8 * S} />
        </>
      )}
      {ends.map((end, i) => <CourtEnd key={i} w={w} S={S} baseY={end.baseY} dir={end.dir} />)}
    </g>
  );
}

const TOOLS = [
  { id: "mover", label: "Mover" },
  { id: "ataque", label: "+ Ofensivo" },
  { id: "defensa", label: "+ Defensivo" },
  { id: "balon", label: "Balón" },
  { id: "pase", label: "Pase" },
  { id: "dribbling", label: "Dribbling" },
  { id: "corte", label: "Corte" },
  { id: "cortina", label: "Cortina" },
  { id: "lanzamiento", label: "Lanzamiento" },
  { id: "borrar", label: "Borrar" },
];

function CourtDiagram() {
  const [courtType, setCourtType] = useState("half");
  const [players, setPlayers] = useState([]);
  const [lines, setLines] = useState([]);
  const [ball, setBall] = useState(null);
  const [shots, setShots] = useState([]);
  const [shotDraft, setShotDraft] = useState(null);
  const [tool, setTool] = useState("ataque");
  const [drawingPath, setDrawingPath] = useState(null);
  const [previewPt, setPreviewPt] = useState(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const offCount = useRef(0);
  const defCount = useRef(0);

  const vbW = 150, vbH = courtType === "half" ? 140 : 280;
  const LINE_TOOLS = ["pase", "dribbling", "corte", "cortina"];

  const getPoint = (evt) => {
    const rect = svgRef.current.getBoundingClientRect();
    const cx = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const cy = evt.touches ? evt.touches[0].clientY : evt.clientY;
    return { x: ((cx - rect.left) / rect.width) * vbW, y: ((cy - rect.top) / rect.height) * vbH };
  };

  const finalizeDrawing = (extraPt) => {
    if (!drawingPath) return;
    const points = extraPt ? [...drawingPath.points, extraPt] : drawingPath.points;
    if (points.length >= 2) setLines((ls) => [...ls, { id: "l" + Date.now(), type: drawingPath.type, points }]);
    setDrawingPath(null);
    setPreviewPt(null);
  };

  const onCourtDown = (evt) => {
    const pt = getPoint(evt);
    if (tool === "ataque") { offCount.current += 1; setPlayers((p) => [...p, { id: "p" + Date.now(), num: offCount.current, team: "off", x: pt.x, y: pt.y }]); }
    else if (tool === "defensa") { defCount.current += 1; setPlayers((p) => [...p, { id: "p" + Date.now(), num: defCount.current, team: "def", x: pt.x, y: pt.y }]); }
    else if (tool === "balon") { setBall({ x: pt.x, y: pt.y }); }
  };

  const onCourtClick = (evt) => {
    const pt = getPoint(evt);
    if (tool === "lanzamiento") {
      if (!shotDraft) { setShotDraft(pt); }
      else {
        const angle = Math.atan2(pt.y - shotDraft.y, pt.x - shotDraft.x);
        setShots((s) => [...s, { id: "s" + Date.now(), x: shotDraft.x, y: shotDraft.y, angle }]);
        setShotDraft(null);
        setPreviewPt(null);
      }
      return;
    }
    if (!LINE_TOOLS.includes(tool)) return;
    if (!drawingPath) setDrawingPath({ type: tool, points: [pt] });
    else setDrawingPath((d) => ({ ...d, points: [...d.points, pt] }));
  };

  const onCourtDoubleClick = (evt) => {
    if (!drawingPath) return;
    evt.preventDefault();
    finalizeDrawing(getPoint(evt));
  };

  const onMove = (evt) => {
    if (drawingPath || shotDraft) setPreviewPt(getPoint(evt));
    if (!dragRef.current) return;
    evt.preventDefault();
    const pt = getPoint(evt);
    if (dragRef.current.type === "player") setPlayers((ps) => ps.map((p) => (p.id === dragRef.current.id ? { ...p, x: pt.x, y: pt.y } : p)));
    else if (dragRef.current.type === "ball") setBall({ x: pt.x, y: pt.y });
    else if (dragRef.current.type === "shot") setShots((ss) => ss.map((s) => (s.id === dragRef.current.id ? { ...s, x: pt.x, y: pt.y } : s)));
  };

  const onUp = () => { dragRef.current = null; };

  const onPlayerDown = (evt, p) => {
    evt.stopPropagation();
    if (tool === "mover") dragRef.current = { type: "player", id: p.id };
    else if (tool === "borrar") setPlayers((ps) => ps.filter((x) => x.id !== p.id));
  };

  const onBallDown = (evt) => {
    evt.stopPropagation();
    if (tool === "mover") dragRef.current = { type: "ball" };
    else if (tool === "borrar") setBall(null);
  };

  const onShotDown = (evt, s) => {
    evt.stopPropagation();
    if (tool === "mover") dragRef.current = { type: "shot", id: s.id };
    else if (tool === "borrar") setShots((ss) => ss.filter((x) => x.id !== s.id));
  };

  const onLineClick = (evt, l) => { evt.stopPropagation(); if (tool === "borrar") setLines((ls) => ls.filter((x) => x.id !== l.id)); };

  const selectTool = (id) => { setTool(id); setDrawingPath(null); setPreviewPt(null); setShotDraft(null); };

  const clearAll = () => { setPlayers([]); setLines([]); setBall(null); setShots([]); setShotDraft(null); setDrawingPath(null); setPreviewPt(null); offCount.current = 0; defCount.current = 0; };

  const previewPoints = drawingPath ? [...drawingPath.points, ...(previewPt ? [previewPt] : [])] : [];

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1 mb-2">
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => selectTool(t.id)}
            className={`px-2 py-1 rounded text-xs border ${tool === t.id ? "bg-orange-500/20 border-orange-500/50 text-orange-300" : "bg-zinc-900 border-zinc-700 text-zinc-400"}`}>
            {t.label}
          </button>
        ))}
        <button onClick={() => setCourtType(courtType === "half" ? "full" : "half")} className="px-2 py-1 rounded text-xs border bg-zinc-900 border-zinc-700 text-zinc-400">
          {courtType === "half" ? "Media cancha" : "Cancha completa"}
        </button>
        {drawingPath && (
          <button onClick={() => finalizeDrawing()} className="px-2 py-1 rounded text-xs border bg-emerald-500/15 border-emerald-500/40 text-emerald-300">
            Finalizar trazo
          </button>
        )}
        <button onClick={clearAll} className="px-2 py-1 rounded text-xs border bg-red-500/10 border-red-500/30 text-red-300">Limpiar</button>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${vbW} ${vbH}`} width="100%" style={{ maxWidth: 320, touchAction: "none" }}
        className="bg-zinc-900 rounded-lg border border-zinc-800"
        onMouseDown={onCourtDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        onClick={onCourtClick} onDoubleClick={onCourtDoubleClick}
        onTouchStart={onCourtDown} onTouchMove={onMove} onTouchEnd={onUp}>
        <defs>
          <marker id="arrowhead" markerUnits="userSpaceOnUse" markerWidth="4" markerHeight="4" refX="3.4" refY="2" orient="auto">
            <path d="M0,0 L0,4 L3.4,2 z" fill="#fb923c" />
          </marker>
        </defs>
        <CourtBg w={vbW} h={vbH} courtType={courtType} />
        {lines.map((l) => <g key={l.id} onClick={(e) => onLineClick(e, l)}><CourtLine l={l} /></g>)}
        {previewPoints.length > 1 && (
          <polyline points={previewPoints.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeDasharray="3 3" />
        )}
        {players.map((p) => (
          <g key={p.id} onMouseDown={(e) => onPlayerDown(e, p)} onTouchStart={(e) => onPlayerDown(e, p)} style={{ cursor: tool === "mover" ? "grab" : "pointer" }}>
            <circle cx={p.x} cy={p.y} r="6" fill={p.team === "off" ? "#3b82f6" : "#18181b"} stroke={p.team === "off" ? "#93c5fd" : "#ef4444"} strokeWidth="1.5" />
            <text x={p.x} y={p.y + 2.5} textAnchor="middle" fontSize="6.5" fontWeight="bold" fill={p.team === "off" ? "#ffffff" : "#ef4444"}>
              {p.team === "def" ? "X" + p.num : p.num}
            </text>
          </g>
        ))}
        {ball && <BallIcon x={ball.x} y={ball.y} r={4} onMouseDown={onBallDown} onTouchStart={onBallDown} cursor={tool === "mover" ? "grab" : "pointer"} />}
        {shots.map((s) => (
          <ShotIcon key={s.id} x={s.x} y={s.y} angle={s.angle || 0} onMouseDown={(e) => onShotDown(e, s)} onTouchStart={(e) => onShotDown(e, s)} cursor={tool === "mover" ? "grab" : "pointer"} />
        ))}
        {shotDraft && (
          <>
            <circle cx={shotDraft.x} cy={shotDraft.y} r="1.5" fill="#fb923c" />
            <ShotIcon x={shotDraft.x} y={shotDraft.y} angle={previewPt ? Math.atan2(previewPt.y - shotDraft.y, previewPt.x - shotDraft.x) : 0} faded />
          </>
        )}
      </svg>
      <p className="text-xs text-zinc-600 mt-1">
        Mové, agregá jugadores o balón tocando la cancha. Para Pase/Dribbling/Corte/Cortina: cada clic agrega un punto y quiebra la trayectoria — doble clic o "Finalizar trazo" para terminar. Pase = punteada · Dribbling = zigzag · Corte = sólida con flecha · Cortina = sólida con T · Lanzamiento = símbolo fijo, primer clic ubica, segundo clic define la dirección.
      </p>
    </div>
  );
}

function EntrenamientoView({ event, onBack, onUpdate }) {
  const [bloques, setBloques] = useState(event.bloques || []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ inicio: "", fin: "", titulo: "", desc: "" });
  const [drawOpen, setDrawOpen] = useState({});
  const [objetivoSemana, setObjetivoSemana] = useState(event.objetivoSemana || "");
  const [asistencia, setAsistencia] = useState(event.asistencia || "");

  const [editFisica, setEditFisica] = useState(false);
  const [horarioBasquet, setHorarioBasquet] = useState(event.horarioBasquet || "");
  const [horarioFisico, setHorarioFisico] = useState(event.horarioFisico || "");
  const [cargaFisica, setCargaFisica] = useState(event.cargaFisica || "Media");
  const [lugarFisico, setLugarFisico] = useState(event.lugarFisico || "Cancha");
  const [enfoqueFisico, setEnfoqueFisico] = useState(event.enfoqueFisico || []);
  const [notasFisicas, setNotasFisicas] = useState(event.notasFisicas || "");
  const toggleEnfoque = (v) => setEnfoqueFisico(enfoqueFisico.includes(v) ? enfoqueFisico.filter((x) => x !== v) : [...enfoqueFisico, v]);

  const guardarFisica = () => {
    setEditFisica(false);
    onUpdate({ horarioBasquet, horarioFisico, cargaFisica, lugarFisico, enfoqueFisico, notasFisicas });
  };

  const addBloque = () => {
    if (!form.titulo) return;
    const next = [...bloques, { id: "b" + Date.now(), ...form }];
    setBloques(next);
    onUpdate({ bloques: next });
    setForm({ inicio: "", fin: "", titulo: "", desc: "" });
    setShowForm(false);
  };

  const toggleDraw = (id) => setDrawOpen({ ...drawOpen, [id]: !drawOpen[id] });

  return (
    <div className="max-w-2xl mx-auto text-zinc-100">
      <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm mb-4">
        <ArrowLeft size={15} /> Volver al calendario
      </button>

      <div className="flex items-center gap-2 text-blue-400 mb-1">
        <Dumbbell size={18} />
        <span className="text-xs font-bold uppercase tracking-widest">Entrenamiento</span>
      </div>
      <h1 className="text-2xl font-bold mb-1">{event.title}</h1>
      <div className="flex items-center gap-2 mb-6">
        <p className="text-zinc-500 text-sm">{event.date}</p>
        {(event.categoria || event.tira) && <Chip tone="blue">{event.categoria} · {event.tira}</Chip>}
      </div>

      <EditableField label="Objetivo de la semana" icon={Trophy} value={objetivoSemana} onSave={(v) => { setObjetivoSemana(v); onUpdate({ objetivoSemana: v }); }} multiline />

      <EditableField label="Asistencia" icon={Users} value={asistencia} onSave={(v) => { setAsistencia(v); onUpdate({ asistencia: v }); }} />

      <Section icon={Dumbbell} title="Preparación física" accent="text-sky-400">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          {editFisica ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Horario cancha (básquet)</p>
                  <input value={horarioBasquet} onChange={(e) => setHorarioBasquet(e.target.value)} placeholder="ej: 20:00 a 21:30 hs" className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Horario físico</p>
                  <input value={horarioFisico} onChange={(e) => setHorarioFisico(e.target.value)} placeholder="ej: 19:00 a 20:00 hs" className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Carga física</p>
                  <select value={cargaFisica} onChange={(e) => setCargaFisica(e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
                    {CARGAS_FISICAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Lugar</p>
                  <select value={lugarFisico} onChange={(e) => setLugarFisico(e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
                    {LUGARES_FISICOS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <TagPicker label="Enfoque físico" options={ENFOQUES_FISICOS} selected={enfoqueFisico} onToggle={toggleEnfoque} tone="blue" />
              <div>
                <p className="text-xs text-zinc-500 mb-1">Notas del preparador físico</p>
                <textarea value={notasFisicas} onChange={(e) => setNotasFisicas(e.target.value)} rows={2} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
              </div>
              <button onClick={guardarFisica} className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-3 py-1.5 rounded">Guardar</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-zinc-500">Cancha</p><p className="text-zinc-200">{horarioBasquet || "—"}</p></div>
                <div><p className="text-xs text-zinc-500">Físico</p><p className="text-zinc-200">{horarioFisico || "—"}</p></div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2 py-0.5 rounded text-xs border bg-sky-500/15 text-sky-300 border-sky-500/30">Carga {cargaFisica}</span>
                <span className="px-2 py-0.5 rounded text-xs border bg-zinc-800 text-zinc-300 border-zinc-700">{lugarFisico}</span>
                {enfoqueFisico.map((f) => <Chip key={f}>{f}</Chip>)}
              </div>
              {notasFisicas && <p className="text-sm text-zinc-400 italic">"{notasFisicas}"</p>}
              <button onClick={() => setEditFisica(true)} className="text-xs text-sky-400 hover:text-sky-300">Editar</button>
            </div>
          )}
        </div>
      </Section>

      <Section icon={Clock} title="Bloque de cancha" accent="text-blue-400">
        <div className="space-y-2">
          {bloques.map((b) => (
            <div key={b.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="flex gap-3">
                <div className="text-blue-300 text-xs font-mono whitespace-nowrap pt-0.5 w-16 shrink-0">{b.inicio}–{b.fin}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-100">{b.titulo}</p>
                  <p className="text-sm text-zinc-400 mt-0.5">{b.desc}</p>
                  <button onClick={() => toggleDraw(b.id)} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2">
                    <PenLine size={12} /> {drawOpen[b.id] ? "Ocultar cancha" : "Dibujar cancha"}
                  </button>
                  {drawOpen[b.id] && <CourtDiagram />}
                </div>
              </div>
            </div>
          ))}
        </div>

        {showForm ? (
          <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <input placeholder="Inicio (ej 0')" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} className="w-24 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
              <input placeholder="Fin (ej 20')" value={form.fin} onChange={(e) => setForm({ ...form, fin: e.target.value })} className="w-24 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
              <input placeholder="Título del bloque de cancha" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
            </div>
            <textarea placeholder="Descripción del ejercicio" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" rows={2} />
            <div className="flex gap-2">
              <button onClick={addBloque} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded">Agregar bloque de cancha</button>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 text-sm px-3 py-1.5">Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-blue-400 text-sm mt-2 hover:text-blue-300">
            <Plus size={15} /> Agregar bloque de cancha
          </button>
        )}
      </Section>

      <p className="text-xs text-zinc-600 mt-8 border-t border-zinc-800 pt-3">
        Diagramas de cancha con jugadores, balón y trayectorias con quiebres. Pendiente: biblioteca de jugadas guardadas y animación.
      </p>
    </div>
  );
}

function PartidoView({ event, onBack, onUpdate }) {
  const [scouting, setScouting] = useState(event.scoutingColectivo || []);
  const [newBullet, setNewBullet] = useState("");
  const [ataqueTags, setAtaqueTags] = useState(event.ataque?.transicion || []);
  const [setTags, setSetTags] = useState(event.ataque?.set || []);
  const [cortinaTags, setCortinaTags] = useState(event.defensa?.cortinas || []);
  const [videoColectivo, setVideoColectivo] = useState(event.videoColectivo || "");
  const [plantel, setPlantel] = useState(event.plantelRival || []);
  const [planAtaque, setPlanAtaque] = useState(event.planAtaque || "");
  const [planDefensa, setPlanDefensa] = useState(event.planDefensa || "");

  const toggleList = (list, val) => (list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);

  const addBullet = () => {
    if (!newBullet) return;
    const next = [...scouting, newBullet];
    setScouting(next);
    onUpdate({ scoutingColectivo: next });
    setNewBullet("");
  };

  const updatePlayerVideo = (idx, val) => {
    const copy = [...plantel];
    copy[idx] = { ...copy[idx], video: val };
    setPlantel(copy);
  };

  const onToggleTransicion = (v) => {
    const next = toggleList(ataqueTags, v);
    setAtaqueTags(next);
    onUpdate({ ataque: { claves: event.ataque?.claves || [], transicion: next, set: setTags } });
  };
  const onToggleSet = (v) => {
    const next = toggleList(setTags, v);
    setSetTags(next);
    onUpdate({ ataque: { claves: event.ataque?.claves || [], transicion: ataqueTags, set: next } });
  };
  const onToggleCortina = (v) => {
    const next = toggleList(cortinaTags, v);
    setCortinaTags(next);
    onUpdate({
      defensa: { claves: event.defensa?.claves || [], directos: event.defensa?.directos || [], indirectos: event.defensa?.indirectos || [], cortinas: next },
    });
  };

  return (
    <div className="max-w-2xl mx-auto text-zinc-100">
      <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm mb-4">
        <ArrowLeft size={15} /> Volver al calendario
      </button>

      <div className="flex items-center gap-2 text-orange-400 mb-1">
        <Trophy size={18} />
        <span className="text-xs font-bold uppercase tracking-widest">{event.jornada}</span>
      </div>
      <h1 className="text-2xl font-bold mb-2">vs {event.rival}</h1>
      <div className="flex flex-wrap mb-6">
        <Chip tone="orange">{event.condicion}</Chip>
        <Chip><Clock size={11} className="inline mr-1 -mt-0.5" />{event.horario}</Chip>
        <Chip>Citación {event.citacion}</Chip>
        <Chip>{event.date}</Chip>
        {(event.categoria || event.tira) && <Chip tone="blue">{event.categoria} · {event.tira}</Chip>}
      </div>

      <Section icon={Shield} title="Scouting colectivo" accent="text-orange-400">
        <ul className="space-y-1.5 mb-2">
          {scouting.map((s, i) => (
            <li key={i} className="text-sm text-zinc-300 flex gap-2">
              <span className="text-orange-500 mt-1">•</span><span>{s}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 mb-3">
          <input value={newBullet} onChange={(e) => setNewBullet(e.target.value)} placeholder="Agregar característica del rival..." className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-100" />
          <button onClick={addBullet} className="bg-zinc-800 hover:bg-zinc-700 text-sm px-3 rounded text-zinc-200">Agregar</button>
        </div>
        <div className="flex items-center gap-2">
          <Youtube size={14} className="text-zinc-500 shrink-0" />
          <input value={videoColectivo} onChange={(e) => setVideoColectivo(e.target.value)} onBlur={() => onUpdate({ videoColectivo })} placeholder="Link de YouTube — scouting colectivo" className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-100" />
        </div>
        {videoColectivo && <a href={videoColectivo} target="_blank" rel="noreferrer" className="text-xs text-orange-400 hover:underline block mt-1">Ver video ↗</a>}
      </Section>

      <Section icon={Users} title="Plantel rival" accent="text-orange-400">
        <div className="space-y-2">
          {plantel.map((j, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-orange-300 font-mono text-xs">#{j.numero}</span>
                <span className="font-medium text-sm">{j.nombre}</span>
                <span className="text-zinc-500 text-xs ml-auto">{j.posicion} · {j.categoria}</span>
              </div>
              <p className="text-sm text-zinc-400 mb-2">{j.caracteristicas}</p>
              <div className="flex items-center gap-2">
                <Youtube size={13} className="text-zinc-600 shrink-0" />
                <input value={j.video || ""} onChange={(e) => updatePlayerVideo(i, e.target.value)} onBlur={() => onUpdate({ plantelRival: plantel })} placeholder="Link scouting individual" className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Swords} title="Plan de juego — ataque" accent="text-orange-400">
        <textarea value={planAtaque} onChange={(e) => setPlanAtaque(e.target.value)} onBlur={() => onUpdate({ planAtaque })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 mb-3" rows={3} />
        <TagPicker label="Transición" options={SISTEMAS.transicion} selected={ataqueTags} onToggle={onToggleTransicion} />
        <TagPicker label="Set ofensivo" options={SISTEMAS.set} selected={setTags} onToggle={onToggleSet} />
        {event.ataque?.claves?.length > 0 && (
          <ul className="space-y-1 mt-2">
            {event.ataque.claves.map((c, i) => <li key={i} className="text-sm text-zinc-400 flex gap-2"><Tag size={13} className="mt-1 shrink-0 text-orange-500" />{c}</li>)}
          </ul>
        )}
      </Section>

      <Section icon={Shield} title="Plan de juego — defensa" accent="text-orange-400">
        <textarea value={planDefensa} onChange={(e) => setPlanDefensa(e.target.value)} onBlur={() => onUpdate({ planDefensa })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 mb-3" rows={3} />
        <TagPicker label="Defensa de cortinas" options={SISTEMAS.cortinas} selected={cortinaTags} onToggle={onToggleCortina} />
        {event.defensa?.claves?.length > 0 && (
          <ul className="space-y-1 mb-2 mt-2">
            {event.defensa.claves.map((c, i) => <li key={i} className="text-sm text-zinc-400 flex gap-2"><Tag size={13} className="mt-1 shrink-0 text-orange-500" />{c}</li>)}
          </ul>
        )}
        {event.defensa?.directos?.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-zinc-500 mb-1">Directos</p>
            <div className="flex flex-wrap">{event.defensa.directos.map((d, i) => <Chip key={i}>{d}</Chip>)}</div>
          </div>
        )}
        {event.defensa?.indirectos?.length > 0 && (
          <div className="mt-1">
            <p className="text-xs text-zinc-500 mb-1">Indirectos</p>
            <div className="flex flex-wrap">{event.defensa.indirectos.map((d, i) => <Chip key={i}>{d}</Chip>)}</div>
          </div>
        )}
      </Section>
    </div>
  );
}

function CalendarView({ events, onSelectEvent, onAddEvent }) {
  const today = new Date("2026-07-07");
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newEv, setNewEv] = useState({ title: "", type: "entrenamiento" });
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [tira, setTira] = useState(TIRAS[0]);

  const equipoEvents = events.filter((e) => e.categoria === categoria && e.tira === tira);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const eventsFor = (d) => equipoEvents.filter((e) => e.date === toKey(year, month, d));

  const changeMonth = (delta) => {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
    setMonth(m); setYear(y); setSelectedDay(null);
  };

  const selectEquipo = (nextCategoria, nextTira) => {
    setCategoria(nextCategoria); setTira(nextTira); setSelectedDay(null); setShowAdd(false);
  };

  const dayEvents = selectedDay ? eventsFor(selectedDay) : [];

  return (
    <div className="max-w-3xl mx-auto text-zinc-100">
      <div className="flex items-center gap-2 mb-1 text-zinc-400">
        <Calendar size={18} />
        <span className="text-xs font-bold uppercase tracking-widest">Calendario del staff</span>
      </div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">{MESES[month]} {year}</h1>
        <div className="flex gap-1">
          <button onClick={() => changeMonth(-1)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"><ChevronLeft size={18} /></button>
          <button onClick={() => changeMonth(1)} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={categoria} onChange={(e) => selectEquipo(e.target.value, tira)}
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={tira} onChange={(e) => selectEquipo(categoria, e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
          {TIRAS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS.map((d) => <div key={d} className="text-center text-xs text-zinc-500 font-medium py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const evs = eventsFor(d);
          const isToday = toKey(year, month, d) === "2026-07-07";
          return (
            <button key={i} onClick={() => setSelectedDay(d)}
              className={`aspect-square rounded-lg border p-1.5 text-left flex flex-col ${selectedDay === d ? "border-orange-500/60 bg-orange-500/5" : "border-zinc-800 hover:border-zinc-700"} ${isToday ? "ring-1 ring-zinc-500" : ""}`}>
              <span className={`text-xs ${isToday ? "text-orange-300 font-bold" : "text-zinc-400"}`}>{d}</span>
              <div className="flex flex-wrap gap-0.5 mt-auto">
                {evs.slice(0, 3).map((e) => <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${TIPO_ESTILO[e.type].dot}`} />)}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="mt-5 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-sm">{selectedDay} de {MESES[month]}</h2>
            <button onClick={() => setSelectedDay(null)} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
          </div>
          {dayEvents.length === 0 && <p className="text-sm text-zinc-500 mb-3">Sin eventos cargados.</p>}
          <div className="space-y-2 mb-3">
            {dayEvents.map((e) => {
              const st = TIPO_ESTILO[e.type];
              const clickable = e.type === "entrenamiento" || e.type === "partido";
              return (
                <button key={e.id} disabled={!clickable} onClick={() => clickable && onSelectEvent(e)}
                  className={`w-full text-left rounded-lg px-3 py-2 border border-zinc-800 flex items-center gap-2 ${clickable ? "hover:border-zinc-600 cursor-pointer" : "cursor-default"}`}>
                  <span className={`w-2 h-2 rounded-full ${st.dot} shrink-0`} />
                  <span className={`text-sm ${st.text}`}>{e.title}</span>
                  {e.type === "partido" && <MapPin size={12} className="text-zinc-500 ml-auto" />}
                </button>
              );
            })}
          </div>

          {showAdd ? (
            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <input value={newEv.title} onChange={(e) => setNewEv({ ...newEv, title: e.target.value })} placeholder="Título del evento" className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm" />
              <select value={newEv.type} onChange={(e) => setNewEv({ ...newEv, type: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm">
                {Object.keys(TIPO_ESTILO).map((t) => <option key={t} value={t}>{TIPO_ESTILO[t].label}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={() => { if (newEv.title) { onAddEvent({ date: toKey(year, month, selectedDay), categoria, tira, ...newEv }); setNewEv({ title: "", type: "entrenamiento" }); setShowAdd(false); } }} className="bg-orange-600 hover:bg-orange-500 text-white text-sm px-3 py-1.5 rounded">Guardar</button>
                <button onClick={() => setShowAdd(false)} className="text-zinc-400 text-sm px-3 py-1.5">Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-zinc-400 text-sm hover:text-zinc-200">
              <Plus size={15} /> Agregar evento
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-zinc-800">
        {Object.entries(TIPO_ESTILO).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-zinc-500"><span className={`w-2 h-2 rounded-full ${v.dot}`} />{v.label}</div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [events, setEvents] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("eventos").select("*").order("date", { ascending: true });
      if (cancelled) return;
      if (error) setErrorMsg(error.message);
      else setEvents(data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const addEvent = async (ev) => {
    const { data, error } = await supabase.from("eventos").insert(ev).select().single();
    if (error) { setErrorMsg(error.message); return; }
    setEvents((prev) => [...prev, data]);
  };

  const updateEvent = async (id, patch) => {
    const { data, error } = await supabase.from("eventos").update(patch).eq("id", id).select().single();
    if (error) { setErrorMsg(error.message); return; }
    setEvents((prev) => prev.map((e) => (e.id === id ? data : e)));
    setActive((prev) => (prev && prev.id === id ? data : prev));
  };

  return (
    <div className="bg-zinc-950 min-h-screen p-6 font-sans">
      {errorMsg && (
        <div className="max-w-3xl mx-auto mb-4 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-3 py-2">
          Error de conexión con Supabase: {errorMsg}
        </div>
      )}
      {!active && (
        loading ? (
          <p className="max-w-3xl mx-auto text-zinc-500 text-sm">Cargando eventos…</p>
        ) : (
          <CalendarView
            events={events}
            onSelectEvent={setActive}
            onAddEvent={addEvent}
          />
        )
      )}
      {active?.type === "entrenamiento" && (
        <EntrenamientoView event={active} onBack={() => setActive(null)} onUpdate={(patch) => updateEvent(active.id, patch)} />
      )}
      {active?.type === "partido" && (
        <PartidoView event={active} onBack={() => setActive(null)} onUpdate={(patch) => updateEvent(active.id, patch)} />
      )}
    </div>
  );
}
