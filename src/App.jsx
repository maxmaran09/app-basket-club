import React, { useState, useRef, useEffect, useId } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Calendar, ChevronLeft, ChevronRight, X, Plus, Users, Shield, Swords, Dumbbell, Trophy, Clock, MapPin, ArrowLeft, Tag, Youtube, PenLine, Eraser, Trash2, CalendarClock, MessageSquare, BarChart3, Upload, Download, Copy, Home, LogOut, Target, Search, Camera, UserCircle2, GitCompare, Settings, KeyRound, Move, UserPlus, ShieldPlus, UserCog, CircleDot, MoveRight, Shuffle, CornerUpRight, Minus, Check, Maximize2, Minimize2, AlertTriangle } from "lucide-react";
import { supabase } from "./supabaseClient";
import { parseCabbPdf, computeAdvancedStats, round3, normalizeName, detectarEquipoPropio } from "./pdfStats";
import { CATEGORIAS, TIRAS, POSICIONES, formatPosicion } from "./constants";
import { descargarCSV } from "./csvUtils";
import ImportadorCSVPropio, { CSV_HEADERS_TEMPLATE } from "./ImportadorCSVPropio";
import ImportadorCSVRival from "./ImportadorCSVRival";
import { useAuth } from "./AuthContext";
import { useTeam } from "./TeamContext";
import LoginView from "./LoginView";
import ProtectedRoute from "./ProtectedRoute";
import { ROLES, ROL_LABELS, SECCIONES_POR_ROL, puedeVerSeccion, seccionInicialDe, rutaDeSeccion, esStaffCompleto, nivelBloque, TIPOS_EVENTO_ABRIBLES_JUGADOR } from "./permisos";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

const TIPO_ESTILO = {
  entrenamiento: { bg: "bg-cyan-500/15", text: "text-cyan-300", dot: "bg-cyan-400", label: "Entrenamiento" },
  individual: { bg: "bg-teal-500/15", text: "text-teal-300", dot: "bg-teal-400", label: "Individual" },
  partido: { bg: "bg-brand-500/15", text: "text-brand-300", dot: "bg-brand-400", label: "Partido" },
  libre: { bg: "bg-zinc-700/40", text: "text-zinc-400", dot: "bg-zinc-500", label: "Libre" },
  optativo: { bg: "bg-amber-500/15", text: "text-amber-300", dot: "bg-amber-400", label: "Optativo" },
  especial: { bg: "bg-purple-500/15", text: "text-purple-300", dot: "bg-purple-400", label: "Evento" },
};

const SISTEMAS = {
  transicion: ["Libre", "Alto", "Bajo", "Pantalón"],
  set: ["Camiseta", "Puño", "Fijo", "Uno", "Cuerno"],
  cortinas: ["0", "1", "2", "0+Show", "Trap", "Switch", "Ice / Rojo"],
};

const CARGAS_FISICAS = ["Baja", "Media", "Alta"];
const LUGARES_FISICOS = ["Cancha", "Gimnasio de pesas", "Mixto"];
const ENFOQUES_FISICOS = ["Velocidad", "Potencia", "Fuerza", "Resistencia", "Movilidad"];

const ESTADOS_ASISTENCIA = ["Presente", "Ausente", "Tarde", "Lesionado"];
const ESTADO_ESTILO = {
  Presente: "bg-emerald-500/20 border-emerald-500/50 text-emerald-300",
  Ausente: "bg-red-500/20 border-red-500/50 text-red-300",
  Tarde: "bg-amber-500/20 border-amber-500/50 text-amber-300",
  Lesionado: "bg-purple-500/20 border-purple-500/50 text-purple-300",
};

function toKey(y, m, d) { return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }

// Fecha real de hoy en huso horario de Buenos Aires (America/Argentina/Buenos_Aires), como "YYYY-MM-DD".
function todayKeyBA() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Edad calculada al vuelo a partir de la fecha de nacimiento, así nunca queda desactualizada.
function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento + "T00:00:00");
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad;
}

// Un jugador pertenece a un equipo si es su categoría/tira principal, o si figura
// entre sus equipos adicionales (juega también en otra categoría del club).
function jugadorEnEquipo(j, categoria, tira) {
  if (j.categoria_origen === categoria && j.tira === tira) return true;
  return (j.equipos_adicionales || []).some((e) => e.categoria === categoria && e.tira === tira);
}

function Chip({ children, tone = "zinc" }) {
  const map = {
    zinc: "bg-zinc-800 text-zinc-300 border-zinc-700",
    brand: "bg-brand-500/15 text-brand-300 border-brand-500/30",
    blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
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

function TagPicker({ label, options, selected, onToggle, tone = "brand", soloLectura = false }) {
  const activeCls = tone === "blue" ? "bg-sky-500/20 border-sky-500/50 text-sky-300" : "bg-brand-500/20 border-brand-500/50 text-brand-300";
  return (
    <div className="mb-3">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <div className="flex flex-wrap">
        {options.map((op) => {
          const active = selected.includes(op);
          return (
            <button key={op} disabled={soloLectura} onClick={() => onToggle(op)}
              className={`px-2.5 py-1 rounded text-xs border mr-1.5 mb-1.5 transition ${active ? activeCls : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600"} ${soloLectura ? "cursor-default opacity-80" : ""}`}>
              {op}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EditableField({ label, icon, value, onSave, accent = "text-cyan-400", multiline = false, soloLectura = false }) {
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
          {!soloLectura && (
            <button onClick={startEdit} className="text-xs text-blue-400 hover:text-blue-300 shrink-0">Editar</button>
          )}
        </div>
      )}
    </Section>
  );
}

// Confirmación destructiva: hay que escribir BORRAR a mano para habilitar el botón.
function ConfirmDeleteModal({ itemLabel, subject = "elemento", onCancel, onConfirm }) {
  const [text, setText] = useState("");
  const ready = text.trim().toUpperCase() === "BORRAR";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-red-400 font-bold text-sm mb-2">Eliminar {subject}</h3>
        <p className="text-zinc-400 text-sm mb-3">
          Vas a eliminar {subject} <span className="text-zinc-200">"{itemLabel}"</span> de forma permanente. Escribí <span className="font-mono text-red-300">BORRAR</span> para confirmar.
        </p>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="BORRAR"
          autoFocus
          className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 mb-3"
        />
        <div className="flex gap-2">
          <button
            disabled={!ready}
            onClick={onConfirm}
            className={`text-sm px-3 py-1.5 rounded text-white ${ready ? "bg-red-600 hover:bg-red-500" : "bg-red-900/40 cursor-not-allowed"}`}
          >
            Eliminar definitivamente
          </button>
          <button onClick={onCancel} className="text-zinc-400 text-sm px-3 py-1.5">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// Confirmación liviana para acciones reversibles (ej. "dar de baja" a un jugador de la
// temporada, que se puede reactivar después) -- a diferencia de ConfirmDeleteModal, no exige
// escribir BORRAR ni habla de "permanente".
function ConfirmSimpleModal({ title, message, confirmLabel = "Confirmar", onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-sm mb-2">{title}</h3>
        <p className="text-zinc-400 text-sm mb-3">{message}</p>
        <div className="flex gap-2">
          <button onClick={onConfirm} className="bg-red-600 hover:bg-red-500 text-white text-sm px-3 py-1.5 rounded">{confirmLabel}</button>
          <button onClick={onCancel} className="text-zinc-400 text-sm px-3 py-1.5">Cancelar</button>
        </div>
      </div>
    </div>
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

function CourtLine({ l, markerId }) {
  const stroke = "#fb923c";
  const d = pathFromPoints(l.points, l.type);
  const marker = `url(#${markerId})`;
  if (l.type === "pase") return <path d={d} fill="none" stroke={stroke} strokeWidth={TACTIC_STROKE} strokeDasharray="4 3" markerEnd={marker} />;
  if (l.type === "dribbling") return <path d={d} fill="none" stroke={stroke} strokeWidth={TACTIC_STROKE} markerEnd={marker} />;
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
  return <path d={d} fill="none" stroke={stroke} strokeWidth={TACTIC_STROKE} markerEnd={marker} />;
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

const PLAYER_COLORS = {
  off: { fill: "#3b82f6", stroke: "#93c5fd", text: "#ffffff" },
  def: { fill: "#18181b", stroke: "#ef4444", text: "#ef4444" },
  coach: { fill: "#f59e0b", stroke: "#fde68a", text: "#78350f" },
};

const TOOLS = [
  { id: "mover", label: "Mover", icon: Move },
  { id: "ataque", label: "Jugador ofensivo", icon: UserPlus },
  { id: "defensa", label: "Jugador defensivo", icon: ShieldPlus },
  { id: "coach", label: "Coach", icon: UserCog },
  { id: "balon", label: "Balón", icon: CircleDot },
  { id: "pase", label: "Pase", icon: MoveRight },
  { id: "dribbling", label: "Dribbling", icon: Shuffle },
  { id: "corte", label: "Corte", icon: CornerUpRight },
  { id: "cortina", label: "Cortina", icon: Minus },
  { id: "lanzamiento", label: "Lanzamiento", icon: Target },
  { id: "borrar", label: "Borrar", icon: Eraser },
];

function CourtDiagram({ initial, onSave, onCancel }) {
  const [courtType, setCourtType] = useState(initial?.courtType || "half");
  const [players, setPlayers] = useState(initial?.players || []);
  const [lines, setLines] = useState(initial?.lines || []);
  const [balls, setBalls] = useState(initial?.balls || (initial?.ball ? [{ id: "ball-legacy", ...initial.ball }] : []));
  const [shots, setShots] = useState(initial?.shots || []);
  const [shotDraft, setShotDraft] = useState(null);
  const [tool, setTool] = useState("ataque");
  const [drawingPath, setDrawingPath] = useState(null);
  const [previewPt, setPreviewPt] = useState(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const offCount = useRef((initial?.players || []).filter((p) => p.team === "off").reduce((m, p) => Math.max(m, p.num), 0));
  const defCount = useRef((initial?.players || []).filter((p) => p.team === "def").reduce((m, p) => Math.max(m, p.num), 0));
  const coachCount = useRef((initial?.players || []).filter((p) => p.team === "coach").reduce((m, p) => Math.max(m, p.num), 0));
  const markerId = useId();

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
    else if (tool === "coach") { coachCount.current += 1; setPlayers((p) => [...p, { id: "p" + Date.now(), num: coachCount.current, team: "coach", x: pt.x, y: pt.y }]); }
    else if (tool === "balon") { setBalls((bs) => [...bs, { id: "ball" + Date.now(), x: pt.x, y: pt.y }]); }
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
    else if (dragRef.current.type === "ball") setBalls((bs) => bs.map((b) => (b.id === dragRef.current.id ? { ...b, x: pt.x, y: pt.y } : b)));
    else if (dragRef.current.type === "shot") setShots((ss) => ss.map((s) => (s.id === dragRef.current.id ? { ...s, x: pt.x, y: pt.y } : s)));
  };

  const onUp = () => { dragRef.current = null; };

  const onPlayerDown = (evt, p) => {
    evt.stopPropagation();
    if (tool === "mover") dragRef.current = { type: "player", id: p.id };
    else if (tool === "borrar") setPlayers((ps) => ps.filter((x) => x.id !== p.id));
  };

  const onBallDown = (evt, ballId) => {
    evt.stopPropagation();
    if (tool === "mover") dragRef.current = { type: "ball", id: ballId };
    else if (tool === "borrar") setBalls((bs) => bs.filter((b) => b.id !== ballId));
  };

  const onShotDown = (evt, s) => {
    evt.stopPropagation();
    if (tool === "mover") dragRef.current = { type: "shot", id: s.id };
    else if (tool === "borrar") setShots((ss) => ss.filter((x) => x.id !== s.id));
  };

  const onLineClick = (evt, l) => { evt.stopPropagation(); if (tool === "borrar") setLines((ls) => ls.filter((x) => x.id !== l.id)); };

  const selectTool = (id) => { setTool(id); setDrawingPath(null); setPreviewPt(null); setShotDraft(null); };

  const clearAll = () => { setPlayers([]); setLines([]); setBalls([]); setShots([]); setShotDraft(null); setDrawingPath(null); setPreviewPt(null); offCount.current = 0; defCount.current = 0; coachCount.current = 0; };

  const previewPoints = drawingPath ? [...drawingPath.points, ...(previewPt ? [previewPt] : [])] : [];

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1 mb-2">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => selectTool(t.id)} title={t.label}
              className={`p-1.5 rounded border ${tool === t.id ? "bg-brand-500/20 border-brand-500/50 text-brand-300" : "bg-zinc-900 border-zinc-700 text-zinc-400"}`}>
              <Icon size={15} />
            </button>
          );
        })}
        <button onClick={() => setCourtType(courtType === "half" ? "full" : "half")} title={courtType === "half" ? "Cambiar a cancha completa" : "Cambiar a media cancha"}
          className="p-1.5 rounded border bg-zinc-900 border-zinc-700 text-zinc-400">
          {courtType === "half" ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
        </button>
        {drawingPath && (
          <button onClick={() => finalizeDrawing()} title="Finalizar trazo" className="p-1.5 rounded border bg-emerald-500/15 border-emerald-500/40 text-emerald-300">
            <Check size={15} />
          </button>
        )}
        <button onClick={clearAll} title="Limpiar cancha" className="p-1.5 rounded border bg-red-500/10 border-red-500/30 text-red-300">
          <Trash2 size={15} />
        </button>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${vbW} ${vbH}`} width="100%" style={{ maxWidth: 320, touchAction: "none" }}
        className="bg-zinc-900 rounded-lg border border-zinc-800"
        onMouseDown={onCourtDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        onClick={onCourtClick} onDoubleClick={onCourtDoubleClick}
        onTouchStart={onCourtDown} onTouchMove={onMove} onTouchEnd={onUp}>
        <defs>
          <marker id={markerId} markerUnits="userSpaceOnUse" markerWidth="4" markerHeight="4" refX="3.4" refY="2" orient="auto">
            <path d="M0,0 L0,4 L3.4,2 z" fill="#fb923c" />
          </marker>
        </defs>
        <CourtBg w={vbW} h={vbH} courtType={courtType} />
        {lines.map((l) => <g key={l.id} onClick={(e) => onLineClick(e, l)}><CourtLine l={l} markerId={markerId} /></g>)}
        {previewPoints.length > 1 && (
          <polyline points={previewPoints.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeDasharray="3 3" />
        )}
        {players.map((p) => (
          <g key={p.id} onMouseDown={(e) => onPlayerDown(e, p)} onTouchStart={(e) => onPlayerDown(e, p)} style={{ cursor: tool === "mover" ? "grab" : "pointer" }}>
            <circle cx={p.x} cy={p.y} r="6" fill={PLAYER_COLORS[p.team].fill} stroke={PLAYER_COLORS[p.team].stroke} strokeWidth="1.5" />
            <text x={p.x} y={p.y + 2.5} textAnchor="middle" fontSize="6.5" fontWeight="bold" fill={PLAYER_COLORS[p.team].text}>
              {p.team === "def" ? "X" + p.num : p.team === "coach" ? "C" : p.num}
            </text>
          </g>
        ))}
        {balls.map((b) => (
          <BallIcon key={b.id} x={b.x} y={b.y} r={4} onMouseDown={(e) => onBallDown(e, b.id)} onTouchStart={(e) => onBallDown(e, b.id)} cursor={tool === "mover" ? "grab" : "pointer"} />
        ))}
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
      <p className="hidden sm:block text-xs text-zinc-600 mt-1">
        Mové, agregá jugadores, coach o balón tocando la cancha (pasá el mouse sobre cada ícono para ver qué hace). Para Pase/Dribbling/Corte/Cortina: cada clic agrega un punto y quiebra la trayectoria — doble clic o "Finalizar trazo" para terminar. Pase = punteada · Dribbling = zigzag · Corte = sólida con flecha · Cortina = sólida con T · Lanzamiento = símbolo fijo, primer clic ubica, segundo clic define la dirección.
      </p>
      <div className="flex gap-2 mt-2">
        <button onClick={() => onSave({ courtType, players, lines, balls, shots })} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded">
          Guardar cancha
        </button>
        <button onClick={onCancel} className="text-zinc-400 text-xs px-3 py-1.5">Cancelar</button>
      </div>
    </div>
  );
}

// Render de solo lectura de una cancha ya guardada (miniatura dentro de la lista de un bloque).
function CourtPreview({ courtType, players = [], lines = [], ball, balls, shots = [] }) {
  const markerId = useId();
  const vbW = 150, vbH = courtType === "half" ? 140 : 280;
  const ballList = balls || (ball ? [ball] : []);
  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%" style={{ maxWidth: 120, pointerEvents: "none" }} className="bg-zinc-900 rounded-lg border border-zinc-800 shrink-0">
      <defs>
        <marker id={markerId} markerUnits="userSpaceOnUse" markerWidth="4" markerHeight="4" refX="3.4" refY="2" orient="auto">
          <path d="M0,0 L0,4 L3.4,2 z" fill="#fb923c" />
        </marker>
      </defs>
      <CourtBg w={vbW} h={vbH} courtType={courtType} />
      {lines.map((l) => <CourtLine key={l.id} l={l} markerId={markerId} />)}
      {players.map((p) => (
        <g key={p.id}>
          <circle cx={p.x} cy={p.y} r="6" fill={PLAYER_COLORS[p.team].fill} stroke={PLAYER_COLORS[p.team].stroke} strokeWidth="1.5" />
          <text x={p.x} y={p.y + 2.5} textAnchor="middle" fontSize="6.5" fontWeight="bold" fill={PLAYER_COLORS[p.team].text}>
            {p.team === "def" ? "X" + p.num : p.team === "coach" ? "C" : p.num}
          </text>
        </g>
      ))}
      {ballList.map((b, i) => <BallIcon key={b.id || i} x={b.x} y={b.y} r={4} />)}
      {shots.map((s) => <ShotIcon key={s.id} x={s.x} y={s.y} angle={s.angle || 0} />)}
    </svg>
  );
}

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Semáforo deportivo: 1-3 verde (ligera/recuperación), 4-6 amarillo (moderada/aeróbica),
// 7-8 naranja (dura/umbral), 9-10 rojo (máxima/sobrecarga).
function rpeColorClasses(v) {
  if (v == null || v === "") return "bg-zinc-950 border-zinc-700 text-zinc-400";
  if (v <= 3) return "bg-emerald-500/20 border-emerald-500/50 text-emerald-300";
  if (v <= 6) return "bg-amber-500/20 border-amber-500/50 text-amber-300";
  if (v <= 8) return "bg-orange-500/20 border-orange-500/50 text-orange-300";
  return "bg-red-500/20 border-red-500/50 text-red-300";
}

// Lista de asistencia dinámica + control de carga física RPE: trae el plantel que corresponde a
// la categoría/tira del entrenamiento y guarda estado + RPE (1-10) + nota contra "asistencias"
// (upsert por jugador+evento).
function AsistenciaSection({ event, jugadores }) {
  const [estados, setEstados] = useState({});
  const [rpeValores, setRpeValores] = useState({});
  const [rpeNotas, setRpeNotas] = useState({});
  const [notasAbiertas, setNotasAbiertas] = useState({});
  const [cargaGeneral, setCargaGeneral] = useState(null);
  const [loadingAsist, setLoadingAsist] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("asistencias").select("jugador_id, estado, rpe_valor, rpe_nota").eq("entrenamiento_id", event.id);
      if (cancelled) return;
      if (!error && data) {
        const estMap = {}, rpeMap = {}, notaMap = {};
        data.forEach((r) => {
          estMap[r.jugador_id] = r.estado;
          if (r.rpe_valor != null) rpeMap[r.jugador_id] = r.rpe_valor;
          if (r.rpe_nota) notaMap[r.jugador_id] = r.rpe_nota;
        });
        setEstados(estMap);
        setRpeValores(rpeMap);
        setRpeNotas(notaMap);
      }
      setLoadingAsist(false);
    })();
    return () => { cancelled = true; };
  }, [event.id]);

  const roster = jugadores.filter((j) => jugadorEnEquipo(j, event.categoria, event.tira));

  const setEstado = (jugadorId, estado) => {
    setEstados((prev) => ({ ...prev, [jugadorId]: prev[jugadorId] === estado ? undefined : estado }));
    setSaved(false);
  };

  const setRpe = (jugadorId, valor) => {
    setRpeValores((prev) => ({ ...prev, [jugadorId]: valor }));
    setSaved(false);
  };

  const setNota = (jugadorId, texto) => {
    setRpeNotas((prev) => ({ ...prev, [jugadorId]: texto }));
    setSaved(false);
  };

  const toggleNota = (jugadorId) => setNotasAbiertas((prev) => ({ ...prev, [jugadorId]: !prev[jugadorId] }));

  const asignarATodos = () => {
    if (cargaGeneral == null) return;
    setRpeValores((prev) => {
      const next = { ...prev };
      roster.forEach((j) => { next[j.id] = cargaGeneral; });
      return next;
    });
    setSaved(false);
  };

  const guardar = async () => {
    const jugadorIds = new Set([...Object.keys(estados), ...Object.keys(rpeValores), ...Object.keys(rpeNotas)]);
    const rows = [...jugadorIds]
      .filter((id) => estados[id] || rpeValores[id] != null || rpeNotas[id])
      .map((jugador_id) => ({
        entrenamiento_id: event.id,
        jugador_id,
        estado: estados[jugador_id] || "Presente",
        rpe_valor: rpeValores[jugador_id] ?? null,
        rpe_nota: rpeNotas[jugador_id] || null,
      }));
    if (rows.length === 0) return;
    const { error } = await supabase.from("asistencias").upsert(rows, { onConflict: "entrenamiento_id,jugador_id" });
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };

  return (
    <Section icon={Users} title="Asistencia y carga física (RPE)" accent="text-cyan-400">
      {loadingAsist ? (
        <p className="text-sm text-zinc-500">Cargando plantel…</p>
      ) : roster.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay jugadores cargados para {event.categoria} · {event.tira}. Agregalos desde la pestaña Plantel.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3 bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
            <span className="text-xs text-zinc-400 shrink-0">Carga general del entrenamiento (RPE):</span>
            <div className="flex gap-1 flex-wrap">
              {RPE_VALUES.map((n) => (
                <button key={n} onClick={() => setCargaGeneral(n)}
                  className={`w-7 h-7 rounded text-xs font-bold border flex items-center justify-center ${rpeColorClasses(n)} ${cargaGeneral === n ? "ring-2 ring-white/60" : ""}`}>
                  {n}
                </button>
              ))}
            </div>
            <button onClick={asignarATodos} disabled={cargaGeneral == null} className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs px-3 py-1.5 rounded shrink-0">
              Asignar a todos
            </button>
          </div>

          <div className="space-y-1.5 mb-3">
            {roster.map((j) => (
              <div key={j.id} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2 min-w-0 sm:flex-1">
                    <span className="text-brand-300 font-mono text-xs w-7 shrink-0">#{j.dorsal ?? "-"}</span>
                    <span className="text-sm text-zinc-200 flex-1 min-w-0">
                      {j.nombre_apellido}
                      {(j.categoria_origen !== event.categoria || j.tira !== event.tira) && (
                        <span className="ml-1.5 text-xs text-zinc-500">(de {j.categoria_origen} · {j.tira})</span>
                      )}
                    </span>
                  </div>
                  <div className="flex gap-1 flex-wrap sm:justify-end">
                    {ESTADOS_ASISTENCIA.map((es) => (
                      <button key={es} onClick={() => setEstado(j.id, es)}
                        className={`px-2 py-1 rounded text-xs border ${estados[j.id] === es ? ESTADO_ESTILO[es] : "bg-zinc-950 border-zinc-700 text-zinc-500 hover:border-zinc-600"}`}>
                        {es}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 pl-9">
                  <span className="text-xs text-zinc-500 shrink-0">RPE</span>
                  <select
                    value={rpeValores[j.id] ?? ""}
                    onChange={(e) => setRpe(j.id, e.target.value ? Number(e.target.value) : undefined)}
                    className={`text-xs rounded px-2 py-1 border font-bold ${rpeColorClasses(rpeValores[j.id])}`}
                  >
                    <option value="">—</option>
                    {RPE_VALUES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <button onClick={() => toggleNota(j.id)} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-blue-400">
                    <MessageSquare size={12} /> Nota{rpeNotas[j.id] ? " ✓" : ""}
                  </button>
                </div>
                {notasAbiertas[j.id] && (
                  <div className="mt-2 pl-9">
                    <textarea
                      value={rpeNotas[j.id] || ""}
                      onChange={(e) => setNota(j.id, e.target.value)}
                      placeholder="Observación individual (ej: sintió sobrecarga en el gemelo)"
                      rows={2}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={guardar} className="bg-cyan-600 hover:bg-cyan-500 text-white text-sm px-3 py-1.5 rounded">Guardar Asistencia y Carga</button>
            {saved && <span className="text-emerald-400 text-xs">Guardado ✓</span>}
          </div>
        </>
      )}
    </Section>
  );
}

// Reutilizable: horarios + carga/lugar + enfoque + notas del preparador físico, con Editar/Guardar.
// Sirve tanto para el plan semanal de un entrenamiento como para el plan de cada jugador en un
// evento Individual — "data" trae los valores actuales y "onSave" recibe el patch a persistir.
function PreparacionFisicaSection({ data, onSave, soloLectura }) {
  const [editFisica, setEditFisica] = useState(false);
  const [horarioBasquet, setHorarioBasquet] = useState(data.horarioBasquet || "");
  const [horarioFisico, setHorarioFisico] = useState(data.horarioFisico || "");
  const [cargaFisica, setCargaFisica] = useState(data.cargaFisica || "Media");
  const [lugarFisico, setLugarFisico] = useState(data.lugarFisico || "Cancha");
  const [enfoqueFisico, setEnfoqueFisico] = useState(data.enfoqueFisico || []);
  const [notasFisicas, setNotasFisicas] = useState(data.notasFisicas || "");
  const toggleEnfoque = (v) => setEnfoqueFisico(enfoqueFisico.includes(v) ? enfoqueFisico.filter((x) => x !== v) : [...enfoqueFisico, v]);

  const guardarFisica = () => {
    setEditFisica(false);
    onSave({ horarioBasquet, horarioFisico, cargaFisica, lugarFisico, enfoqueFisico, notasFisicas });
  };

  return (
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
            {!soloLectura && (
              <button onClick={() => setEditFisica(true)} className="text-xs text-sky-400 hover:text-sky-300">Editar</button>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

// Clona un array de bloques (y sus diagramas) con ids nuevos, para duplicar sin pisar el original.
function clonarBloques(bloques) {
  return (bloques || []).map((b, i) => ({
    ...b,
    id: "b" + Date.now() + "-" + i,
    diagrams: (b.diagrams || []).map((d, j) => ({ ...d, id: "d" + Date.now() + "-" + i + "-" + j })),
  }));
}

// Reutilizable: lista de bloques de cancha con sus diagramas (secuencia de canchas por bloque).
// "bloques"/"onChange" son controlados por quien lo use (un entrenamiento entero, o el plan de
// un jugador puntual dentro de un evento Individual).
function BloquesConCanchaSection({ bloques, onChange, soloLectura }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ inicio: "", fin: "", titulo: "", desc: "" });
  const [editing, setEditing] = useState(null); // { bloqueId, diagramId } — diagramId "new" = cancha nueva
  const [editingBloqueId, setEditingBloqueId] = useState(null);
  const [editBloqueForm, setEditBloqueForm] = useState({ inicio: "", fin: "", titulo: "", desc: "" });

  const addBloque = () => {
    if (!form.titulo) return;
    onChange([...bloques, { id: "b" + Date.now(), ...form }]);
    setForm({ inicio: "", fin: "", titulo: "", desc: "" });
    setShowForm(false);
  };

  const startEditBloque = (b) => {
    setEditBloqueForm({ inicio: b.inicio || "", fin: b.fin || "", titulo: b.titulo || "", desc: b.desc || "" });
    setEditingBloqueId(b.id);
  };

  const saveBloque = () => {
    if (!editBloqueForm.titulo) return;
    onChange(bloques.map((b) => (b.id === editingBloqueId ? { ...b, ...editBloqueForm } : b)));
    setEditingBloqueId(null);
  };

  const saveDiagram = (bloqueId, diagramId, state) => {
    const next = bloques.map((b) => {
      if (b.id !== bloqueId) return b;
      const diagrams = b.diagrams || [];
      if (diagramId === "new") return { ...b, diagrams: [...diagrams, { id: "d" + Date.now(), ...state }] };
      return { ...b, diagrams: diagrams.map((d) => (d.id === diagramId ? { id: diagramId, ...state } : d)) };
    });
    onChange(next);
    setEditing(null);
  };

  const deleteDiagram = (bloqueId, diagramId) => {
    onChange(bloques.map((b) => (b.id === bloqueId ? { ...b, diagrams: (b.diagrams || []).filter((d) => d.id !== diagramId) } : b)));
  };

  const duplicateBloque = (bloqueId) => {
    const idx = bloques.findIndex((b) => b.id === bloqueId);
    if (idx === -1) return;
    const [copia] = clonarBloques([bloques[idx]]);
    onChange([...bloques.slice(0, idx + 1), copia, ...bloques.slice(idx + 1)]);
  };

  return (
    <Section icon={Clock} title="Bloque de cancha" accent="text-cyan-400">
      <div className="space-y-2">
        {bloques.map((b) => {
          const diagrams = b.diagrams || [];
          return (
            <div key={b.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              {editingBloqueId === b.id ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input placeholder="Inicio (ej 0')" value={editBloqueForm.inicio} onChange={(e) => setEditBloqueForm({ ...editBloqueForm, inicio: e.target.value })} className="w-24 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
                    <input placeholder="Fin (ej 20')" value={editBloqueForm.fin} onChange={(e) => setEditBloqueForm({ ...editBloqueForm, fin: e.target.value })} className="w-24 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
                    <input placeholder="Título del bloque de cancha" value={editBloqueForm.titulo} onChange={(e) => setEditBloqueForm({ ...editBloqueForm, titulo: e.target.value })} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
                  </div>
                  <textarea placeholder="Descripción del ejercicio" value={editBloqueForm.desc} onChange={(e) => setEditBloqueForm({ ...editBloqueForm, desc: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" rows={2} />
                  <div className="flex gap-2">
                    <button onClick={saveBloque} className="bg-cyan-600 hover:bg-cyan-500 text-white text-sm px-3 py-1.5 rounded">Guardar</button>
                    <button onClick={() => setEditingBloqueId(null)} className="text-zinc-400 text-sm px-3 py-1.5">Cancelar</button>
                  </div>
                </div>
              ) : (
              <div className="flex gap-3">
                <div className="text-cyan-300 text-xs font-mono whitespace-nowrap pt-0.5 w-16 shrink-0">{b.inicio}–{b.fin}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{b.titulo}</p>
                      <p className="text-sm text-zinc-400 mt-0.5">{b.desc}</p>
                    </div>
                    {!soloLectura && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => startEditBloque(b)} title="Editar bloque" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-cyan-400">
                          <PenLine size={13} /> Editar
                        </button>
                        <button onClick={() => duplicateBloque(b.id)} title="Duplicar bloque" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-cyan-400">
                          <Copy size={13} /> Duplicar
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 space-y-3">
                    {diagrams.map((d, di) =>
                      !soloLectura && editing?.bloqueId === b.id && editing?.diagramId === d.id ? (
                        <CourtDiagram key={d.id} initial={d} onSave={(state) => saveDiagram(b.id, d.id, state)} onCancel={() => setEditing(null)} />
                      ) : (
                        <div key={d.id} className="flex items-center gap-2">
                          <CourtPreview {...d} />
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-zinc-500">Cancha {di + 1}</span>
                            {!soloLectura && (
                              <>
                                <button onClick={() => setEditing({ bloqueId: b.id, diagramId: d.id })} className="text-xs text-cyan-400 hover:text-cyan-300 text-left">Editar</button>
                                <button onClick={() => deleteDiagram(b.id, d.id)} className="text-xs text-red-400 hover:text-red-300 text-left">Eliminar</button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    )}

                    {soloLectura ? null : editing?.bloqueId === b.id && editing?.diagramId === "new" ? (
                      <CourtDiagram initial={null} onSave={(state) => saveDiagram(b.id, "new", state)} onCancel={() => setEditing(null)} />
                    ) : (
                      <button onClick={() => setEditing({ bloqueId: b.id, diagramId: "new" })} className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
                        <PenLine size={12} /> Agregar cancha
                      </button>
                    )}
                  </div>
                </div>
              </div>
              )}
            </div>
          );
        })}
      </div>

      {soloLectura ? null : showForm ? (
        <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2">
          <div className="flex gap-2">
            <input placeholder="Inicio (ej 0')" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} className="w-24 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
            <input placeholder="Fin (ej 20')" value={form.fin} onChange={(e) => setForm({ ...form, fin: e.target.value })} className="w-24 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
            <input placeholder="Título del bloque de cancha" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          </div>
          <textarea placeholder="Descripción del ejercicio" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" rows={2} />
          <div className="flex gap-2">
            <button onClick={addBloque} className="bg-cyan-600 hover:bg-cyan-500 text-white text-sm px-3 py-1.5 rounded">Agregar bloque de cancha</button>
            <button onClick={() => setShowForm(false)} className="text-zinc-400 text-sm px-3 py-1.5">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-cyan-400 text-sm mt-2 hover:text-cyan-300">
          <Plus size={15} /> Agregar bloque de cancha
        </button>
      )}
    </Section>
  );
}

function EntrenamientoView({ event, onBack, onUpdate, onDelete, onDuplicate, jugadores, rol }) {
  const [bloques, setBloques] = useState(event.bloques || []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [objetivoSemana, setObjetivoSemana] = useState(event.objetivoSemana || "");

  const headerSoloLectura = nivelBloque(rol, "entrenamiento", "header") !== "rw";
  const prepFisicaSoloLectura = nivelBloque(rol, "entrenamiento", "preparacionFisica") !== "rw";
  const bloquesSoloLectura = nivelBloque(rol, "entrenamiento", "bloquesCancha") !== "rw";

  return (
    <div className="max-w-2xl mx-auto text-zinc-100">
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm">
          <ArrowLeft size={15} /> Volver al calendario
        </button>
        {!headerSoloLectura && (
          <div className="flex items-center flex-wrap gap-3">
            <button onClick={onDuplicate} title="Duplicar entrenamiento entero" className="flex items-center gap-1.5 text-zinc-500 hover:text-cyan-400 text-xs">
              <Copy size={13} /> Duplicar entrenamiento
            </button>
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-zinc-500 hover:text-red-400 text-xs">
              <Trash2 size={13} /> Eliminar evento
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-cyan-400 mb-1">
        <Dumbbell size={18} />
        <span className="text-xs font-bold uppercase tracking-widest">Entrenamiento</span>
      </div>
      <h1 className="text-2xl font-bold mb-1">{event.title}</h1>
      <div className="flex items-center gap-2 mb-6">
        <p className="text-zinc-500 text-sm">{event.date}</p>
        {(event.categoria || event.tira) && <Chip tone="blue">{event.categoria} · {event.tira}</Chip>}
      </div>

      <EditableField label="Objetivo de la semana" icon={Trophy} value={objetivoSemana} onSave={(v) => { setObjetivoSemana(v); onUpdate({ objetivoSemana: v }); }} multiline soloLectura={headerSoloLectura} />

      <AsistenciaSection event={event} jugadores={jugadores} />

      <PreparacionFisicaSection data={event} onSave={onUpdate} soloLectura={prepFisicaSoloLectura} />

      <BloquesConCanchaSection bloques={bloques} onChange={(next) => { setBloques(next); onUpdate({ bloques: next }); }} soloLectura={bloquesSoloLectura} />

      <p className="text-xs text-zinc-600 mt-8 border-t border-zinc-800 pt-3">
        Diagramas de cancha con jugadores, balón y trayectorias con quiebres. Pendiente: biblioteca de jugadas guardadas y animación.
      </p>

      {confirmDelete && (
        <ConfirmDeleteModal itemLabel={event.title} subject="evento" onCancel={() => setConfirmDelete(false)} onConfirm={onDelete} />
      )}
    </div>
  );
}

// Plan de trabajo de un jugador puntual dentro de un evento Individual: mismo formato que un
// entrenamiento (objetivo, preparación física, bloques de cancha con diagramas) pero uno por
// jugador, todos dentro del mismo evento.
function PlanIndividualCard({ jugador, plan, opcionesJugador, onUpdate, onRemove, onDuplicate, rol }) {
  const [objetivo, setObjetivo] = useState(plan.objetivo || "");
  const [bloques, setBloques] = useState(plan.bloques || []);

  const sinAsignar = !plan.jugadorId;
  const headerSoloLectura = nivelBloque(rol, "individual", "header") !== "rw";
  const prepFisicaSoloLectura = nivelBloque(rol, "individual", "preparacionFisica") !== "rw";
  const bloquesSoloLectura = nivelBloque(rol, "individual", "bloquesCancha") !== "rw";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-teal-300 font-mono text-xs shrink-0">#{jugador?.dorsal ?? "-"}</span>
          {headerSoloLectura ? (
            <span className="text-sm font-bold text-zinc-100">{jugador?.nombre_apellido ?? "Sin asignar"}</span>
          ) : (
            <select
              value={plan.jugadorId || ""}
              onChange={(e) => onUpdate({ jugadorId: e.target.value })}
              className={"bg-zinc-950 border rounded px-2 py-1 text-sm font-bold min-w-0 " + (sinAsignar ? "border-amber-600 text-amber-400" : "border-zinc-700 text-zinc-100")}
            >
              <option value="">Sin asignar — elegí un jugador</option>
              {opcionesJugador.map((j) => <option key={j.id} value={j.id}>{j.nombre_apellido}</option>)}
            </select>
          )}
        </div>
        {!headerSoloLectura && (
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={onDuplicate} title="Duplicar plan completo" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-blue-400">
              <Copy size={13} /> Duplicar
            </button>
            <button onClick={onRemove} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400">
              <Trash2 size={13} /> Quitar del plan
            </button>
          </div>
        )}
      </div>

      <EditableField label="Objetivo individual" icon={Trophy} accent="text-teal-400" value={objetivo} onSave={(v) => { setObjetivo(v); onUpdate({ objetivo: v }); }} multiline soloLectura={headerSoloLectura} />

      <PreparacionFisicaSection data={plan} onSave={onUpdate} soloLectura={prepFisicaSoloLectura} />

      <BloquesConCanchaSection bloques={bloques} onChange={(next) => { setBloques(next); onUpdate({ bloques: next }); }} soloLectura={bloquesSoloLectura} />
    </div>
  );
}

function IndividualView({ event, jugadores, onBack, onUpdate, onDelete, rol }) {
  const [planes, setPlanes] = useState(event.planesIndividuales || []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const headerSoloLectura = nivelBloque(rol, "individual", "header") !== "rw";

  // Los planes ya guardados antes de esta función no tienen "id" propio (se identificaban por
  // jugadorId, que ahora es editable). planKey da un identificador estable para ambos casos.
  const planKey = (p) => p.id || p.jugadorId;

  const roster = jugadores.filter((j) => jugadorEnEquipo(j, event.categoria, event.tira));
  const idsEnPlan = new Set(planes.map((p) => p.jugadorId).filter(Boolean));
  const disponibles = roster.filter((j) => !idsEnPlan.has(j.id));

  const persist = (next) => {
    setPlanes(next);
    onUpdate({ planesIndividuales: next });
  };

  const addJugador = (jugadorId) => {
    if (!jugadorId) return;
    persist([...planes, {
      id: "p" + Date.now(), jugadorId, objetivo: "", bloques: [],
      horarioBasquet: "", horarioFisico: "", cargaFisica: "Media", lugarFisico: "Cancha", enfoqueFisico: [], notasFisicas: "",
    }]);
  };

  const removePlan = (planId) => persist(planes.filter((p) => planKey(p) !== planId));

  const updatePlan = (planId, patch) => persist(planes.map((p) => (planKey(p) === planId ? { ...p, ...patch } : p)));

  const duplicatePlan = (planId) => {
    const idx = planes.findIndex((p) => planKey(p) === planId);
    if (idx === -1) return;
    const original = planes[idx];
    const copia = { ...original, id: "p" + Date.now(), jugadorId: "", bloques: clonarBloques(original.bloques) };
    persist([...planes.slice(0, idx + 1), copia, ...planes.slice(idx + 1)]);
  };

  return (
    <div className="max-w-2xl mx-auto text-zinc-100">
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm">
          <ArrowLeft size={15} /> Volver al calendario
        </button>
        {!headerSoloLectura && (
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-zinc-500 hover:text-red-400 text-xs">
            <Trash2 size={13} /> Eliminar evento
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-teal-400 mb-1">
        <Users size={18} />
        <span className="text-xs font-bold uppercase tracking-widest">Individual</span>
      </div>
      <h1 className="text-2xl font-bold mb-1">{event.title}</h1>
      <div className="flex items-center gap-2 mb-6">
        <p className="text-zinc-500 text-sm">{event.date}</p>
        {(event.categoria || event.tira) && <Chip tone="blue">{event.categoria} · {event.tira}</Chip>}
      </div>

      {!headerSoloLectura && disponibles.length > 0 && (
        <div className="flex gap-2 mb-4">
          <select
            defaultValue=""
            onChange={(e) => { addJugador(e.target.value); e.target.value = ""; }}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100"
          >
            <option value="">+ Agregar jugador al plan individual</option>
            {disponibles.map((j) => <option key={j.id} value={j.id}>{j.nombre_apellido}</option>)}
          </select>
        </div>
      )}

      {planes.length === 0 && (
        <p className="text-sm text-zinc-500 mb-4">Todavía no agregaste jugadores a este plan individual.</p>
      )}

      {planes.map((plan) => {
        const pid = planKey(plan);
        const jugador = jugadores.find((j) => j.id === plan.jugadorId);
        const opcionesJugador = roster.filter((j) => j.id === plan.jugadorId || !idsEnPlan.has(j.id));
        return (
          <PlanIndividualCard
            key={pid}
            jugador={jugador}
            plan={plan}
            opcionesJugador={opcionesJugador}
            onUpdate={(patch) => updatePlan(pid, patch)}
            onRemove={() => removePlan(pid)}
            onDuplicate={() => duplicatePlan(pid)}
            rol={rol}
          />
        );
      })}

      {confirmDelete && (
        <ConfirmDeleteModal itemLabel={event.title} subject="evento" onCancel={() => setConfirmDelete(false)} onConfirm={onDelete} />
      )}
    </div>
  );
}

// Convierte cualquier link de YouTube (watch?v=, youtu.be/, shorts/, embed/, live/, con
// parámetros extra o barra final) en su URL embebible, extrayendo el ID de 11 caracteres con
// una regex en vez de parsear a mano — más tolerante a formatos raros de link.
// Devuelve null si no se pudo interpretar (para poder ofrecer un link normal como respaldo).
function youtubeEmbedUrl(url) {
  if (!url) return null;
  try {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : null;
  } catch {
    return null;
  }
}

// Reproductor emergente: el video corre adentro de la app, sin redirigir a YouTube.
function VideoPlayerModal({ url, onClose }) {
  const embedUrl = youtubeEmbedUrl(url);
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200"><X size={18} /></button>
        </div>
        {embedUrl ? (
          <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
            <iframe
              src={embedUrl}
              title="Video de YouTube"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              frameBorder="0"
              className="absolute inset-0 w-full h-full rounded-lg"
            />
          </div>
        ) : (
          <p className="text-sm text-zinc-400 p-4">
            No pude interpretar este link como video de YouTube.{" "}
            <a href={url} target="_blank" rel="noreferrer" className="text-brand-400 underline">Abrirlo en una pestaña nueva</a>.
          </p>
        )}
      </div>
    </div>
  );
}

// Ícono de YouTube consistente en toda la app: si no hay link, queda visible pero deshabilitado
// (transparente); si hay link, abre el reproductor embebido en un modal. "label" lo convierte en
// botón destacado.
function VideoLinkButton({ url, size = 14, label }) {
  const [playing, setPlaying] = useState(false);
  const enabled = Boolean(url);

  return (
    <>
      {label ? (
        <button
          onClick={() => enabled && setPlaying(true)}
          disabled={!enabled}
          className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition ${
            enabled ? "bg-red-600/15 border-red-600/40 text-red-300 hover:bg-red-600/25" : "bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed"
          }`}
        >
          <Youtube size={size} /> {label}
        </button>
      ) : (
        <button onClick={() => enabled && setPlaying(true)} disabled={!enabled} title={enabled ? "Ver video" : "Sin video cargado"}
          className={enabled ? "text-red-400 hover:text-red-300" : "text-zinc-700 cursor-not-allowed"}>
          <Youtube size={size} />
        </button>
      )}
      {playing && <VideoPlayerModal url={url} onClose={() => setPlaying(false)} />}
    </>
  );
}

function PartidoView({ event, equiposRivales, onBack, onUpdate, onDelete, rol }) {
  const soloLectura = nivelBloque(rol, "partido", "todo") !== "rw";
  const [rivalId, setRivalId] = useState(event.rival_id || "");
  const [jugadoresRivales, setJugadoresRivales] = useState([]);
  const [loadingRival, setLoadingRival] = useState(true);
  const [ataqueTags, setAtaqueTags] = useState(event.ataque?.transicion || []);
  const [setTags, setSetTags] = useState(event.ataque?.set || []);
  const [cortinaTags, setCortinaTags] = useState(event.defensa?.cortinas || []);
  const [planAtaque, setPlanAtaque] = useState(event.planAtaque || "");
  const [planDefensa, setPlanDefensa] = useState(event.planDefensa || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [editHeader, setEditHeader] = useState(false);
  const [jornada, setJornada] = useState(event.jornada || "");
  const [condicion, setCondicion] = useState(event.condicion || "LOCAL");
  const [horario, setHorario] = useState(event.horario || "");
  const [citacion, setCitacion] = useState(event.citacion || "");

  const guardarHeader = () => {
    setEditHeader(false);
    onUpdate({ jornada, condicion, horario, citacion });
  };

  const equipoRival = equiposRivales.find((e) => e.id === rivalId) || null;

  useEffect(() => {
    if (!rivalId) { setJugadoresRivales([]); setLoadingRival(false); return; }
    let cancelled = false;
    setLoadingRival(true);
    (async () => {
      const { data, error } = await supabase.from("jugadores_rivales").select("*").eq("equipo_rival_id", rivalId).order("dorsal", { ascending: true });
      if (cancelled) return;
      if (!error) setJugadoresRivales(data);
      setLoadingRival(false);
    })();
    return () => { cancelled = true; };
  }, [rivalId]);

  const toggleList = (list, val) => (list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);

  const cambiarRival = (id) => {
    setRivalId(id);
    const eq = equiposRivales.find((e) => e.id === id);
    onUpdate({ rival_id: id || null, rival: eq?.nombre_club || "" });
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
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm">
          <ArrowLeft size={15} /> Volver al calendario
        </button>
        {!soloLectura && (
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-zinc-500 hover:text-red-400 text-xs">
            <Trash2 size={13} /> Eliminar evento
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-brand-400 mb-1">
        <Trophy size={18} />
        <span className="text-xs font-bold uppercase tracking-widest">{jornada || "Partido"}</span>
      </div>
      <h1 className="text-2xl font-bold mb-2">vs {equipoRival?.nombre_club || event.rival || "(sin rival asignado)"}</h1>

      {editHeader && !soloLectura ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2 mb-2">
          <div className="flex gap-2">
            <input value={jornada} onChange={(e) => setJornada(e.target.value)} placeholder="Jornada (ej: Fecha 3, Playoff — Juego 1)" className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
            <select value={condicion} onChange={(e) => setCondicion(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
              <option value="LOCAL">LOCAL</option>
              <option value="VISITANTE">VISITANTE</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Horario del partido (ej: 20:30 hs)" className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
            <input value={citacion} onChange={(e) => setCitacion(e.target.value)} placeholder="Horario de citación (ej: 19:15 hs)" className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          </div>
          <div className="flex gap-2">
            <button onClick={guardarHeader} className="bg-brand-500 hover:bg-brand-600 text-white text-sm px-3 py-1.5 rounded">Guardar</button>
            <button onClick={() => setEditHeader(false)} className="text-zinc-400 text-sm px-3 py-1.5">Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Chip tone="brand">{condicion}</Chip>
          <Chip><Clock size={11} className="inline mr-1 -mt-0.5" />{horario || "sin horario"}</Chip>
          <Chip>Citación {citacion || "—"}</Chip>
          <Chip>{event.date}</Chip>
          {(event.categoria || event.tira) && <Chip tone="blue">{event.categoria} · {event.tira}</Chip>}
          {!soloLectura && (
            <button onClick={() => setEditHeader(true)} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
              <PenLine size={12} /> Editar
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mb-6">
        <p className="text-xs text-zinc-500">Rival:</p>
        {soloLectura ? (
          <Chip>{equipoRival?.nombre_club || "(sin asignar)"}</Chip>
        ) : (
          <select value={rivalId} onChange={(e) => cambiarRival(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100">
            <option value="">(sin asignar)</option>
            {equiposRivales.map((r) => <option key={r.id} value={r.id}>{r.nombre_club}</option>)}
          </select>
        )}
      </div>

      <Section icon={Shield} title="Scouting colectivo" accent="text-brand-400">
        {!equipoRival ? (
          <p className="text-sm text-zinc-500">Asigná un rival arriba para ver su scouting (se carga desde Scouting Hub).</p>
        ) : (
          <>
            <p className="text-sm text-zinc-300 mb-3">{equipoRival.notas_colectivas || <span className="text-zinc-600">Sin notas colectivas cargadas todavía.</span>}</p>
            <VideoLinkButton url={equipoRival.video_colectivo_url} label="Ver Video de Partido" />
          </>
        )}
      </Section>

      <Section icon={Users} title="Plantel rival" accent="text-brand-400">
        {!equipoRival ? (
          <p className="text-sm text-zinc-500">—</p>
        ) : loadingRival ? (
          <p className="text-sm text-zinc-500">Cargando plantel…</p>
        ) : jugadoresRivales.length === 0 ? (
          <p className="text-sm text-zinc-500">Este rival todavía no tiene jugadores cargados en Scouting Hub.</p>
        ) : (
          <div className="space-y-2">
            {jugadoresRivales.map((j) => (
              <div key={j.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-brand-300 font-mono text-xs">#{j.dorsal ?? "-"}</span>
                  <span className="font-medium text-sm">{j.nombre_apellido}</span>
                  <VideoLinkButton url={j.video_individual_url} size={13} />
                  <span className="text-zinc-500 text-xs ml-auto">{formatPosicion(j)}{j.categoria ? ` · ${j.categoria}` : ""}</span>
                </div>
                {j.cualidades_ataque && <p className="text-sm text-zinc-400"><span className="text-zinc-500">Ataque:</span> {j.cualidades_ataque}</p>}
                {j.cualidades_defensa && <p className="text-sm text-zinc-400"><span className="text-zinc-500">Defensa:</span> {j.cualidades_defensa}</p>}
                {j.debilidades && <p className="text-sm text-zinc-400"><span className="text-zinc-500">Debilidades:</span> {j.debilidades}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={Swords} title="Plan de juego — ataque" accent="text-brand-400">
        <textarea value={planAtaque} onChange={(e) => setPlanAtaque(e.target.value)} onBlur={() => onUpdate({ planAtaque })} disabled={soloLectura} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 mb-3 disabled:opacity-80" rows={3} />
        <TagPicker label="Transición" options={SISTEMAS.transicion} selected={ataqueTags} onToggle={onToggleTransicion} soloLectura={soloLectura} />
        <TagPicker label="Set ofensivo" options={SISTEMAS.set} selected={setTags} onToggle={onToggleSet} soloLectura={soloLectura} />
        {event.ataque?.claves?.length > 0 && (
          <ul className="space-y-1 mt-2">
            {event.ataque.claves.map((c, i) => <li key={i} className="text-sm text-zinc-400 flex gap-2"><Tag size={13} className="mt-1 shrink-0 text-brand-400" />{c}</li>)}
          </ul>
        )}
      </Section>

      <Section icon={Shield} title="Plan de juego — defensa" accent="text-brand-400">
        <textarea value={planDefensa} onChange={(e) => setPlanDefensa(e.target.value)} onBlur={() => onUpdate({ planDefensa })} disabled={soloLectura} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 mb-3 disabled:opacity-80" rows={3} />
        <TagPicker label="Defensa de cortinas" options={SISTEMAS.cortinas} selected={cortinaTags} onToggle={onToggleCortina} soloLectura={soloLectura} />
        {event.defensa?.claves?.length > 0 && (
          <ul className="space-y-1 mb-2 mt-2">
            {event.defensa.claves.map((c, i) => <li key={i} className="text-sm text-zinc-400 flex gap-2"><Tag size={13} className="mt-1 shrink-0 text-brand-400" />{c}</li>)}
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

      {confirmDelete && (
        <ConfirmDeleteModal itemLabel={event.title} subject="evento" onCancel={() => setConfirmDelete(false)} onConfirm={onDelete} />
      )}
    </div>
  );
}

function CalendarView({ events, equiposRivales, onSelectEvent, onAddEvent, onDeleteEvent, onMoveEvent, onRenameEvent, onDuplicateEvent, rol }) {
  const todayKey = todayKeyBA();
  const [todayYear, todayMonth] = todayKey.split("-").map(Number);
  const [month, setMonth] = useState(todayMonth - 1);
  const [year, setYear] = useState(todayYear);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newEv, setNewEv] = useState({ title: "", type: "entrenamiento", rivalId: "" });
  const { categoria, tira, setCategoria, setTira } = useTeam();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveDate, setMoveDate] = useState("");
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [eventosPropios, setEventosPropios] = useState([]); // solo se llena para rol jugador (vista_calendario_jugador)

  const esJugador = rol === ROLES.JUGADOR;
  const puedeEditarEventos = esStaffCompleto(rol);
  const tiposClickeables = esJugador ? TIPOS_EVENTO_ABRIBLES_JUGADOR : ["entrenamiento", "partido", "individual"];

  // Un Jugador no puede elegir categoria/tira (queda fijo a la suya) y ademas necesita traer
  // las fechas de entrenamiento/individual desde una vista aparte, porque "eventos" le niega
  // esas filas por RLS (ver supabase/schema_auth.sql: eventos_select_all + vista_calendario_jugador).
  useEffect(() => {
    if (!esJugador) return;
    let cancelled = false;
    (async () => {
      const [{ data: cat }, { data: tir }, { data: propios }] = await Promise.all([
        supabase.rpc("mi_categoria"),
        supabase.rpc("mi_tira"),
        supabase.from("vista_calendario_jugador").select("*"),
      ]);
      if (cancelled) return;
      if (cat) setCategoria(cat);
      if (tir) setTira(tir);
      setEventosPropios(propios || []);
    })();
    return () => { cancelled = true; };
  }, [esJugador]);

  const equipoEvents = [...events, ...eventosPropios].filter((e) => e.categoria === categoria && e.tira === tira);

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

      {esJugador ? (
        <p className="text-sm text-zinc-400 mb-4">{categoria} · {tira}</p>
      ) : (
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
      )}

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS.map((d) => <div key={d} className="text-center text-xs text-zinc-500 font-medium py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const evs = eventsFor(d);
          const isToday = toKey(year, month, d) === todayKey;
          return (
            <button key={i} onClick={() => setSelectedDay(d)}
              className={`aspect-square rounded-lg border p-1.5 text-left flex flex-col ${selectedDay === d ? "border-brand-500/60 bg-brand-500/5" : "border-zinc-800 hover:border-zinc-700"} ${isToday ? "ring-1 ring-zinc-500" : ""}`}>
              <span className={`text-xs ${isToday ? "text-brand-300 font-bold" : "text-zinc-400"}`}>{d}</span>
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
              const clickable = tiposClickeables.includes(e.type);
              const isMoving = moveTarget === e.id;
              const isRenaming = renameTarget === e.id;
              return (
                <div key={e.id} className="rounded-lg border border-zinc-800">
                  <div className="flex items-center gap-1 px-1">
                    <button disabled={!clickable} onClick={() => clickable && onSelectEvent(e)}
                      className={`flex-1 min-w-0 text-left px-2 py-2 flex items-center gap-2 ${clickable ? "hover:text-zinc-200 cursor-pointer" : "cursor-default"}`}>
                      <span className={`w-2 h-2 rounded-full ${st.dot} shrink-0`} />
                      <span className={`text-sm ${st.text} truncate`}>{e.title}</span>
                      {e.type === "partido" && <MapPin size={12} className="text-zinc-500 ml-auto shrink-0" />}
                    </button>
                    {puedeEditarEventos && (
                      <>
                        <button onClick={() => { setRenameTarget(isRenaming ? null : e.id); setRenameValue(e.title); }} title="Editar nombre" className="text-zinc-500 hover:text-blue-400 p-1.5 shrink-0">
                          <PenLine size={14} />
                        </button>
                        <button onClick={() => { setMoveTarget(isMoving ? null : e.id); setMoveDate(e.date); }} title="Cambiar de día" className="text-zinc-500 hover:text-blue-400 p-1.5 shrink-0">
                          <CalendarClock size={14} />
                        </button>
                        <button onClick={() => onDuplicateEvent(e)} title="Duplicar evento" className="text-zinc-500 hover:text-cyan-400 p-1.5 shrink-0">
                          <Copy size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(e)} title="Eliminar evento" className="text-zinc-500 hover:text-red-400 p-1.5 shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                  {isRenaming && (
                    <div className="flex items-center flex-wrap gap-2 px-3 pb-2">
                      <input value={renameValue} onChange={(ev) => setRenameValue(ev.target.value)} className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100" />
                      <button onClick={() => { if (renameValue.trim()) { onRenameEvent(e.id, renameValue.trim()); setRenameTarget(null); } }} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-1 rounded shrink-0">Guardar</button>
                      <button onClick={() => setRenameTarget(null)} className="text-zinc-400 text-xs px-2 py-1 shrink-0">Cancelar</button>
                    </div>
                  )}
                  {isMoving && (
                    <div className="flex items-center flex-wrap gap-2 px-3 pb-2">
                      <input type="date" value={moveDate} onChange={(ev) => setMoveDate(ev.target.value)} className="min-w-0 flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100" />
                      <button onClick={() => { onMoveEvent(e.id, moveDate); setMoveTarget(null); }} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-1 rounded shrink-0">Guardar</button>
                      <button onClick={() => setMoveTarget(null)} className="text-zinc-400 text-xs px-2 py-1 shrink-0">Cancelar</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!puedeEditarEventos ? null : showAdd ? (
            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <input value={newEv.title} onChange={(e) => setNewEv({ ...newEv, title: e.target.value })} placeholder="Título del evento" className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm" />
              <select value={newEv.type} onChange={(e) => setNewEv({ ...newEv, type: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm">
                {Object.keys(TIPO_ESTILO).map((t) => <option key={t} value={t}>{TIPO_ESTILO[t].label}</option>)}
              </select>
              {newEv.type === "partido" && (
                <select value={newEv.rivalId} onChange={(e) => setNewEv({ ...newEv, rivalId: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm">
                  <option value="">Rival (elegilo o cargalo en Scouting Hub)</option>
                  {equiposRivales.map((r) => <option key={r.id} value={r.id}>{r.nombre_club}</option>)}
                </select>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!newEv.title) return;
                    const payload = { date: toKey(year, month, selectedDay), categoria, tira, title: newEv.title, type: newEv.type };
                    const rivalEquipo = equiposRivales.find((r) => r.id === newEv.rivalId);
                    if (newEv.type === "partido" && rivalEquipo) {
                      payload.rival_id = rivalEquipo.id;
                      payload.rival = rivalEquipo.nombre_club;
                    }
                    onAddEvent(payload);
                    setNewEv({ title: "", type: "entrenamiento", rivalId: "" });
                    setShowAdd(false);
                  }}
                  className="bg-brand-500 hover:bg-brand-600 text-white text-sm px-3 py-1.5 rounded"
                >
                  Guardar
                </button>
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

      {deleteTarget && (
        <ConfirmDeleteModal
          itemLabel={deleteTarget.title}
          subject="evento"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { onDeleteEvent(deleteTarget.id); setDeleteTarget(null); }}
        />
      )}
    </div>
  );
}

// Sirve para alta y edición: si viene "jugador", precarga sus datos y guarda un patch (update);
// si no, arranca vacío con la categoría/tira del filtro activo y crea uno nuevo (insert).
function JugadorFormModal({ jugador, categoria, tira, onCancel, onSave, soloCamposMedicos = false }) {
  const [form, setForm] = useState({
    dorsal: jugador?.dorsal ?? "",
    nombre_apellido: jugador?.nombre_apellido ?? "",
    posicion: jugador?.posicion ?? POSICIONES[0],
    posicion_secundaria: jugador?.posicion_secundaria ?? "",
    altura: jugador?.altura ?? "",
    peso: jugador?.peso ?? "",
    fecha_nacimiento: jugador?.fecha_nacimiento ?? "",
    categoria_origen: jugador?.categoria_origen ?? categoria,
    tira: jugador?.tira ?? tira,
    notas_comentarios: jugador?.notas_comentarios ?? "",
    disponibilidad: jugador?.disponibilidad ?? "Disponible",
    lesion_detalle: jugador?.lesion_detalle ?? "",
    lesion_desde: jugador?.lesion_desde ?? "",
  });
  const [equipos, setEquipos] = useState(jugador?.equipos_adicionales || []);
  const [nuevoCat, setNuevoCat] = useState(CATEGORIAS[0]);
  const [nuevoTira, setNuevoTira] = useState(TIRAS[0]);
  const [saving, setSaving] = useState(false);
  const [fotoUrl, setFotoUrl] = useState(jugador?.foto_url || "");
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // El path es "<jugador_id>.<ext>" con upsert: una foto nueva reemplaza a la vieja en el bucket
  // en vez de acumular archivos huerfanos. Solo se puede subir editando un jugador ya guardado
  // (necesita su id) -- de alta, primero se crea el jugador y despues se le carga la foto.
  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !jugador) return;
    setErrorFoto("");
    setSubiendoFoto(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const { error: errUpload } = await supabase.storage.from("fotos-jugadores").upload(`${jugador.id}.${ext}`, file, { upsert: true, cacheControl: "3600" });
    if (errUpload) { setErrorFoto(errUpload.message); setSubiendoFoto(false); return; }
    const { data } = supabase.storage.from("fotos-jugadores").getPublicUrl(`${jugador.id}.${ext}`);
    setFotoUrl(`${data.publicUrl}?v=${Date.now()}`);
    setSubiendoFoto(false);
  };

  const addEquipo = () => {
    const esPrincipal = nuevoCat === form.categoria_origen && nuevoTira === form.tira;
    const yaEsta = equipos.some((e) => e.categoria === nuevoCat && e.tira === nuevoTira);
    if (esPrincipal || yaEsta) return;
    setEquipos([...equipos, { categoria: nuevoCat, tira: nuevoTira }]);
  };
  const removeEquipo = (idx) => setEquipos(equipos.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!form.nombre_apellido) return;
    setSaving(true);
    await onSave({
      dorsal: form.dorsal ? Number(form.dorsal) : null,
      nombre_apellido: form.nombre_apellido,
      posicion: form.posicion,
      posicion_secundaria: form.posicion_secundaria || null,
      altura: form.altura ? Number(form.altura) : null,
      peso: form.peso ? Number(form.peso) : null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      categoria_origen: form.categoria_origen,
      tira: form.tira,
      notas_comentarios: form.notas_comentarios,
      foto_url: fotoUrl || null,
      equipos_adicionales: equipos,
      disponibilidad: form.disponibilidad,
      lesion_detalle: form.disponibilidad === "Disponible" ? "" : form.lesion_detalle,
      lesion_desde: form.disponibilidad === "Disponible" ? null : (form.lesion_desde || null),
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto text-zinc-100" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-sm mb-3">{soloCamposMedicos ? `Ficha médica/física — ${jugador?.nombre_apellido}` : jugador ? "Editar jugador" : "Agregar jugador"}</h3>
        <div className="space-y-2">
          {!soloCamposMedicos && jugador && (
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800">
              <FotoJugadorMini url={fotoUrl} size={52} />
              <div>
                <label className={`inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 ${subiendoFoto ? "opacity-50" : "cursor-pointer"}`}>
                  <Camera size={13} /> {subiendoFoto ? "Subiendo…" : fotoUrl ? "Cambiar foto" : "Subir foto"}
                  <input type="file" accept="image/*" className="hidden" disabled={subiendoFoto} onChange={handleFotoChange} />
                </label>
                {errorFoto && <p className="text-xs text-red-400 mt-1">{errorFoto}</p>}
              </div>
            </div>
          )}
          {!soloCamposMedicos && !jugador && (
            <p className="text-xs text-zinc-500 pb-2 border-b border-zinc-800">Guardá el jugador para poder cargarle una foto.</p>
          )}
          {!soloCamposMedicos && (
            <>
              <div className="flex gap-2">
                <input placeholder="Dorsal" type="number" value={form.dorsal} onChange={(e) => set("dorsal", e.target.value)} className="w-20 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
                <input placeholder="Nombre y apellido" value={form.nombre_apellido} onChange={(e) => set("nombre_apellido", e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
              </div>
              <div className="flex gap-2">
                <select value={form.posicion} onChange={(e) => {
                  const nueva = e.target.value;
                  set("posicion", nueva);
                  if (nueva === form.posicion_secundaria) set("posicion_secundaria", "");
                }} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
                  {POSICIONES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={form.posicion_secundaria} onChange={(e) => set("posicion_secundaria", e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
                  <option value="">— Sin 2da posición —</option>
                  {POSICIONES.filter((p) => p !== form.posicion).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <input placeholder="Altura (m)" type="number" step="0.01" value={form.altura} onChange={(e) => set("altura", e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
                <input placeholder="Peso (kg)" type="number" value={form.peso} onChange={(e) => set("peso", e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Fecha de nacimiento</p>
                <input type="date" value={form.fecha_nacimiento} onChange={(e) => set("fecha_nacimiento", e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
              </div>
              <div className="flex gap-2">
                <select value={form.categoria_origen} onChange={(e) => set("categoria_origen", e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={form.tira} onChange={(e) => set("tira", e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
                  {TIRAS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <textarea placeholder="Notas / comentarios" value={form.notas_comentarios} onChange={(e) => set("notas_comentarios", e.target.value)} rows={2} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
            </>
          )}

          <div className="pt-2 border-t border-zinc-800">
            <p className="text-xs text-zinc-500 mb-1">Disponibilidad</p>
            <select value={form.disponibilidad} onChange={(e) => set("disponibilidad", e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 mb-2">
              <option value="Disponible">Disponible</option>
              <option value="Duda">Duda</option>
              <option value="Lesionado">Lesionado</option>
            </select>
            {form.disponibilidad !== "Disponible" && (
              <div className="flex gap-2">
                <input placeholder="Detalle (ej: esguince tobillo)" value={form.lesion_detalle} onChange={(e) => set("lesion_detalle", e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
                <input type="date" value={form.lesion_desde} onChange={(e) => set("lesion_desde", e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
              </div>
            )}
          </div>

          {!soloCamposMedicos && (
            <div className="pt-2 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 mb-1">Equipos adicionales (además de {form.categoria_origen} · {form.tira})</p>
              {equipos.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {equipos.map((e, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300">
                      {e.categoria} · {e.tira}
                      <button onClick={() => removeEquipo(i)} className="text-zinc-500 hover:text-red-400"><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <select value={nuevoCat} onChange={(e) => setNuevoCat(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100">
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={nuevoTira} onChange={(e) => setNuevoTira(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100">
                  {TIRAS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={addEquipo} className="bg-zinc-800 hover:bg-zinc-700 text-xs px-3 rounded text-zinc-200 shrink-0">+ Agregar</button>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <button disabled={!form.nombre_apellido || saving} onClick={submit} className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded">{jugador ? "Guardar cambios" : "Guardar jugador"}</button>
          <button onClick={onCancel} className="text-zinc-400 text-sm px-3 py-1.5">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// Protocolo de evaluaciones fisicas consensuado con los PFs del club: 14 ejercicios en 3
// grupos, guardados dentro del mismo jugadores.evaluaciones_pfs (jsonb) que ya usaba
// ActualizarMedidasModal para altura/peso -- una entrada nueva puede traer cualquier
// combinacion de "fuerza"/"potencia"/"aceleracion" segun lo que se haya tomado ese dia.
const CAMPOS_FUERZA = [
  { k: "sentadilla", l: "Sentadilla", u: "kg" },
  { k: "pechoPlano", l: "Pecho Plano", u: "kg" },
  { k: "pesoMuerto", l: "Peso Muerto", u: "kg" },
  { k: "dominadas", l: "Dominadas (lastre)", u: "kg" },
];
const CAMPOS_POTENCIA = [
  { k: "cmj", l: "CMJ", u: "cm" },
  { k: "cmjDer", l: "CMJ Pierna Derecha", u: "cm" },
  { k: "cmjIzq", l: "CMJ Pierna Izquierda", u: "cm" },
  { k: "squatJump", l: "Squat Jump", u: "cm" },
  { k: "saltoLargo", l: "Salto en Largo (2 piernas)", u: "cm" },
  { k: "saltoLargoDer", l: "Salto en Largo Pierna Derecha", u: "cm" },
  { k: "saltoLargoIzq", l: "Salto en Largo Pierna Izquierda", u: "cm" },
];
const CAMPOS_ACELERACION = [
  { k: "m5", l: "5 metros", u: "s" },
  { k: "m10", l: "10 metros", u: "s" },
  { k: "m15", l: "15 metros", u: "s" },
];
const TABS_EVALUACION = [["fuerza", "Fuerza"], ["potencia", "Potencia"], ["aceleracion", "Aceleración"]];

function EvaluacionFisicaModal({ jugador, onCancel, onSave }) {
  const [fecha, setFecha] = useState(todayKeyBA());
  const [tab, setTab] = useState("fuerza");
  const [valores, setValores] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setValores((prev) => ({ ...prev, [k]: v }));

  const grupoDe = (campos) => {
    const obj = {};
    campos.forEach((c) => { if (valores[c.k] !== undefined && valores[c.k] !== "") obj[c.k] = Number(valores[c.k]); });
    return Object.keys(obj).length > 0 ? obj : null;
  };

  const submit = async () => {
    const fuerza = grupoDe(CAMPOS_FUERZA);
    const potencia = grupoDe(CAMPOS_POTENCIA);
    const aceleracion = grupoDe(CAMPOS_ACELERACION);
    if (!fuerza && !potencia && !aceleracion) return;
    setSaving(true);
    const entry = { fecha, ...(fuerza && { fuerza }), ...(potencia && { potencia }), ...(aceleracion && { aceleracion }) };
    const evaluaciones = [...(jugador.evaluaciones_pfs || []), entry];
    await onSave({ evaluaciones_pfs: evaluaciones });
    setSaving(false);
  };

  const camposDeTab = tab === "fuerza" ? CAMPOS_FUERZA : tab === "potencia" ? CAMPOS_POTENCIA : CAMPOS_ACELERACION;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-sm w-full max-h-[85vh] overflow-y-auto text-zinc-100" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-sm mb-3">Evaluación física — {jugador.nombre_apellido}</h3>
        <p className="text-xs text-zinc-500 mb-1">Fecha</p>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 mb-3" />

        <div className="flex bg-zinc-950 border border-zinc-800 rounded-lg p-1 mb-3 gap-1">
          {TABS_EVALUACION.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 text-xs font-semibold py-1.5 rounded-md ${tab === k ? "bg-brand-500 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>{l}</button>
          ))}
        </div>

        <div className="space-y-2 mb-4">
          {camposDeTab.map((c) => (
            <div key={c.k} className="flex items-center gap-2">
              <label className="flex-1 min-w-0 text-sm text-zinc-300 truncate">{c.l}</label>
              <input type="number" step="0.01" value={valores[c.k] ?? ""} onChange={(e) => set(c.k, e.target.value)}
                className="w-20 shrink-0 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 text-right" />
              <span className="text-xs text-zinc-500 w-6 shrink-0">{c.u}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button disabled={saving} onClick={submit} className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded">
            {saving ? "Guardando…" : "Guardar evaluación"}
          </button>
          <button onClick={onCancel} className="text-zinc-400 text-sm px-3 py-1.5">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// Busca, entre las filas ya ordenadas de mas reciente a mas vieja, el primer valor de "getter"
// despues de la posicion "i" -- el registro anterior de ESE campo puntual, que no siempre es la
// fila de al lado (una fecha puede no haber tomado ese ejercicio).
function valorAnteriorEnFilas(filasDesc, i, getter) {
  for (let k = i + 1; k < filasDesc.length; k++) {
    const v = getter(filasDesc[k].ev);
    if (v != null) return v;
  }
  return null;
}

// Tabla de evolucion de campos sueltos en la raiz de la entrada (altura/peso).
function TablaEvolucionSimple({ filasDesc, campos, puedeEliminar, onEliminar }) {
  return (
    <div className="overflow-x-auto border border-zinc-800 rounded-lg">
      <table className="w-full text-xs whitespace-nowrap">
        <thead>
          <tr className="bg-zinc-950 text-zinc-500">
            <th className="text-left font-normal px-2.5 py-2 sticky left-0 bg-zinc-950">Fecha</th>
            {campos.map((c) => <th key={c.k} className="text-right font-normal px-2.5 py-2">{c.l}</th>)}
            {puedeEliminar && <th className="px-2 py-2" />}
          </tr>
        </thead>
        <tbody>
          {filasDesc.map((f, i) => (
            <tr key={f.idx} className="border-t border-zinc-800">
              <td className={`px-2.5 py-2 sticky left-0 bg-zinc-900 ${i === 0 ? "text-zinc-100 font-semibold" : "text-zinc-400"}`}>{f.ev.fecha}</td>
              {campos.map((c) => {
                const v = f.ev[c.k];
                if (v == null) return <td key={c.k} className="px-2.5 py-2 text-right text-zinc-700">—</td>;
                const prev = valorAnteriorEnFilas(filasDesc, i, (ev) => ev[c.k]);
                return (
                  <td key={c.k} className="px-2.5 py-2 text-right text-zinc-300">
                    {v}{c.u} <CambioBadge curr={v} prev={prev} lowerIsBetter={c.lowerIsBetter} />
                  </td>
                );
              })}
              {puedeEliminar && (
                <td className="px-2 py-2 text-center">
                  <button onClick={() => onEliminar(f.idx)} title="Eliminar este registro" className="text-zinc-600 hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Tabla de evolucion de un grupo del protocolo del PF (fuerza/potencia/aceleracion) -- solo
// muestra las fechas que tengan algo cargado en ese grupo puntual.
function TablaEvolucionGrupo({ filasDesc, grupo, campos, lowerIsBetter, puedeEliminar, onEliminar }) {
  const filas = filasDesc.filter((f) => f.ev[grupo]);
  if (filas.length === 0) return <p className="text-xs text-zinc-500 py-3 text-center">Sin registros de {grupo}.</p>;
  return (
    <div className="overflow-x-auto border border-zinc-800 rounded-lg">
      <table className="w-full text-xs whitespace-nowrap">
        <thead>
          <tr className="bg-zinc-950 text-zinc-500">
            <th className="text-left font-normal px-2.5 py-2 sticky left-0 bg-zinc-950">Fecha</th>
            {campos.map((c) => <th key={c.k} className="text-right font-normal px-2.5 py-2">{c.l}</th>)}
            {puedeEliminar && <th className="px-2 py-2" />}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={f.idx} className="border-t border-zinc-800">
              <td className={`px-2.5 py-2 sticky left-0 bg-zinc-900 ${i === 0 ? "text-zinc-100 font-semibold" : "text-zinc-400"}`}>{f.ev.fecha}</td>
              {campos.map((c) => {
                const v = f.ev[grupo]?.[c.k];
                if (v == null) return <td key={c.k} className="px-2.5 py-2 text-right text-zinc-700">—</td>;
                const prev = valorAnteriorEnFilas(filas, i, (ev) => ev[grupo]?.[c.k]);
                return (
                  <td key={c.k} className="px-2.5 py-2 text-right text-zinc-300">
                    {v}{c.u} <CambioBadge curr={v} prev={prev} lowerIsBetter={lowerIsBetter} />
                  </td>
                );
              })}
              {puedeEliminar && (
                <td className="px-2 py-2 text-center">
                  <button onClick={() => onEliminar(f.idx)} title="Eliminar este registro" className="text-zinc-600 hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Modal "Ver evolucion": medidas corporales + evaluacion fisica completa (todas las fechas, no
// solo el ultimo valor como en Jugador 360). Reemplaza la vieja lista de texto que solo
// mostraba altura/peso y no tenia forma de mostrar el protocolo nuevo. Diseno validado antes en
// un prototipo de Claude Artifacts.
function EvolucionJugadorModal({ jugador, puedeEliminar, onEliminar, onCancel }) {
  const [tab, setTab] = useState("fuerza");
  const filasDesc = (jugador.evaluaciones_pfs || []).map((ev, idx) => ({ ev, idx })).reverse();

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-2xl w-full max-h-[85vh] overflow-y-auto text-zinc-100" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="font-bold text-sm">Evolución — {jugador.nombre_apellido}</h3>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300"><X size={18} /></button>
        </div>
        <p className="text-xs text-zinc-500 mb-4">Medidas corporales y evaluación física a lo largo del tiempo.</p>

        <SeccionMini>Medidas corporales</SeccionMini>
        <div className="mb-4">
          <TablaEvolucionSimple
            filasDesc={filasDesc}
            campos={[{ k: "altura", l: "Altura", u: "m" }, { k: "peso", l: "Peso", u: "kg" }]}
            puedeEliminar={puedeEliminar}
            onEliminar={onEliminar}
          />
        </div>

        <SeccionMini>Evaluación física</SeccionMini>
        <div className="flex bg-zinc-950 border border-zinc-800 rounded-lg p-1 mb-3 gap-1">
          {TABS_EVALUACION.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 text-xs font-semibold py-1.5 rounded-md ${tab === k ? "bg-brand-500 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>{l}</button>
          ))}
        </div>
        {tab === "fuerza" && <TablaEvolucionGrupo filasDesc={filasDesc} grupo="fuerza" campos={CAMPOS_FUERZA} puedeEliminar={puedeEliminar} onEliminar={onEliminar} />}
        {tab === "potencia" && <TablaEvolucionGrupo filasDesc={filasDesc} grupo="potencia" campos={CAMPOS_POTENCIA} puedeEliminar={puedeEliminar} onEliminar={onEliminar} />}
        {tab === "aceleracion" && <TablaEvolucionGrupo filasDesc={filasDesc} grupo="aceleracion" campos={CAMPOS_ACELERACION} lowerIsBetter puedeEliminar={puedeEliminar} onEliminar={onEliminar} />}
      </div>
    </div>
  );
}

function ActualizarMedidasModal({ jugador, onCancel, onSave }) {
  const [fecha, setFecha] = useState(todayKeyBA());
  const [altura, setAltura] = useState(jugador.altura ?? "");
  const [peso, setPeso] = useState(jugador.peso ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const entry = { fecha };
    if (altura !== "") entry.altura = Number(altura);
    if (peso !== "") entry.peso = Number(peso);
    const evaluaciones = [...(jugador.evaluaciones_pfs || []), entry];
    await onSave({
      altura: altura !== "" ? Number(altura) : jugador.altura,
      peso: peso !== "" ? Number(peso) : jugador.peso,
      evaluaciones_pfs: evaluaciones,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-sm w-full text-zinc-100" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-sm mb-3">Actualizar medidas — {jugador.nombre_apellido}</h3>
        <div className="space-y-2">
          <div>
            <p className="text-xs text-zinc-500 mb-1">Fecha</p>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          </div>
          <div className="flex gap-2">
            <input placeholder="Altura (m)" type="number" step="0.01" value={altura} onChange={(e) => setAltura(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
            <input placeholder="Peso (kg)" type="number" value={peso} onChange={(e) => setPeso(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button disabled={saving} onClick={submit} className="bg-sky-600 hover:bg-sky-500 text-white text-sm px-3 py-1.5 rounded">Guardar</button>
          <button onClick={onCancel} className="text-zinc-400 text-sm px-3 py-1.5">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function PlantelView({ jugadores, onAddJugador, onDeleteJugador, onUpdateJugador, onImportJugadores, onReactivarJugador, rol }) {
  const {
    categoria, tira, setCategoria, setTira,
    temporadas, temporadasDelEquipo, temporadaId, temporadaSeleccionada, esTemporadaActiva,
    setTemporadaId, refrescarTemporadas,
  } = useTeam();
  // Solo se puede dar de alta/editar/dar de baja mirando la temporada activa de este equipo --
  // una temporada pasada queda de solo lectura, para no editar por error un archivo historico.
  const puedeAltaBaja = esStaffCompleto(rol) && esTemporadaActiva;
  const soloCamposMedicos = !esStaffCompleto(rol);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showNuevaTemporada, setShowNuevaTemporada] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [medidasTarget, setMedidasTarget] = useState(null);
  const [evaluacionTarget, setEvaluacionTarget] = useState(null);
  const [evolucionTargetId, setEvolucionTargetId] = useState(null);
  const [promedios, setPromedios] = useState({});
  const [verBaja, setVerBaja] = useState(false);
  const [jugadoresBaja, setJugadoresBaja] = useState([]);
  const [loadingBaja, setLoadingBaja] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // "jugadores" (prop, viene de App()) solo trae la temporada ACTIVA de cada equipo del club --
  // alcanza para el caso normal (jugadorEnEquipo ya resuelve tambien a quienes juegan en este
  // equipo via equipos_adicionales). Mirar una temporada PASADA de este equipo puntual es un
  // fetch aparte, acotado a esa temporada_id, que no reemplaza el estado global.
  const filtered = jugadores.filter((j) => jugadorEnEquipo(j, categoria, tira));

  useEffect(() => {
    if (esTemporadaActiva || !temporadaId) { setHistorico([]); return; }
    let cancelled = false;
    setLoadingHistorico(true);
    (async () => {
      const { data, error } = await supabase
        .from("vista_plantel_temporada")
        .select("*")
        .eq("temporada_id", temporadaId)
        .eq("estado", "activo")
        .order("nombre_apellido", { ascending: true });
      if (cancelled) return;
      if (!error) setHistorico(data || []);
      setLoadingHistorico(false);
    })();
    return () => { cancelled = true; };
  }, [esTemporadaActiva, temporadaId]);

  useEffect(() => {
    if (!verBaja || !temporadaId) return;
    let cancelled = false;
    setLoadingBaja(true);
    (async () => {
      const { data, error } = await supabase
        .from("vista_plantel_temporada")
        .select("*")
        .eq("temporada_id", temporadaId)
        .eq("estado", "baja")
        .order("nombre_apellido", { ascending: true });
      if (cancelled) return;
      if (!error) setJugadoresBaja(data || []);
      setLoadingBaja(false);
    })();
    return () => { cancelled = true; };
  }, [verBaja, temporadaId]);

  const reactivar = async (j) => {
    await onReactivarJugador(j.jugador_temporada_id);
    setJugadoresBaja((prev) => prev.filter((x) => x.id !== j.id));
  };

  const eliminarEvaluacion = (jugador, idx) => {
    const next = (jugador.evaluaciones_pfs || []).filter((_, i) => i !== idx);
    onUpdateJugador(jugador.id, { evaluaciones_pfs: next });
  };

  // Promedios de ESTA temporada puntual (no de la carrera completa del jugador) -- ver
  // supabase/schema_estadisticas_temporadas.sql, vista_promedios_jugador ahora agrupa tambien
  // por temporada_id.
  useEffect(() => {
    if (jugadores.length === 0 || !temporadaId) { setPromedios({}); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("vista_promedios_jugador")
        .select("*")
        .in("jugador_id", jugadores.map((j) => j.id))
        .eq("temporada_id", temporadaId);
      if (!cancelled && !error && data) {
        setPromedios(Object.fromEntries(data.map((p) => [p.jugador_id, p])));
      }
    })();
    return () => { cancelled = true; };
  }, [jugadores, temporadaId]);

  const puedeEditar = esTemporadaActiva;
  const listaMostrada = verBaja ? jugadoresBaja : esTemporadaActiva ? filtered : historico;
  // Se busca en vivo (no una copia guardada al abrir el modal) para que borrar una fila desde
  // "Ver evolucion" actualice la tabla sin tener que cerrar y volver a abrir el modal.
  const evolucionJugador = evolucionTargetId ? listaMostrada.find((j) => j.id === evolucionTargetId) : null;

  // Mismo orden de columnas que la plantilla del importador, para que el CSV exportado se
  // pueda editar (ej. medidas nuevas) y volver a importar sin reacomodar nada.
  const exportarCSV = () => {
    const filas = listaMostrada.map((j) => [
      j.dorsal ?? "",
      j.nombre_apellido || "",
      j.posicion || "",
      j.altura ?? "",
      j.peso ?? "",
      "",
      j.fecha_nacimiento || "",
      j.categoria_origen || "",
      j.tira || "",
      j.notas_comentarios || "",
      j.disponibilidad || "",
      j.lesion_detalle || "",
      j.lesion_desde || "",
      (j.equipos_adicionales || []).map((e) => `${e.categoria}:${e.tira}`).join("|"),
    ]);
    descargarCSV(`plantel_${categoria}_${tira}.csv`.replace(/\s+/g, "_"), [CSV_HEADERS_TEMPLATE, ...filas]);
  };

  return (
    <div className="max-w-3xl mx-auto text-zinc-100">
      <div className="flex items-center gap-2 mb-1 text-zinc-400">
        <Users size={18} />
        <span className="text-xs font-bold uppercase tracking-widest">Plantel</span>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-4">
        <h1 className="text-2xl font-bold">Jugadores</h1>
        <div className="flex items-center flex-wrap gap-2">
          <button onClick={exportarCSV} disabled={listaMostrada.length === 0} className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-zinc-700 text-zinc-100 text-sm px-3 py-1.5 rounded">
            <Download size={15} /> Exportar CSV
          </button>
          {puedeAltaBaja && (
            <>
              <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-sm px-3 py-1.5 rounded">
                <Upload size={15} /> Importar CSV
              </button>
              <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm px-3 py-1.5 rounded">
                <Plus size={15} /> Agregar jugador
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={tira} onChange={(e) => setTira(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
          {TIRAS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {temporadasDelEquipo.length > 1 && (
          <select value={temporadaId ?? ""} onChange={(e) => setTemporadaId(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
            {temporadasDelEquipo.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre_competencia} {t.anio}{t.activa ? " (activa)" : ""}</option>
            ))}
          </select>
        )}
        {esStaffCompleto(rol) && esTemporadaActiva && (
          <button onClick={() => setShowNuevaTemporada(true)} className="text-xs text-brand-400 hover:text-brand-300">
            + Nueva temporada
          </button>
        )}
      </div>

      {!esTemporadaActiva && temporadaSeleccionada && (
        <p className="text-xs text-amber-400 mb-3">
          Estás viendo {temporadaSeleccionada.nombre_competencia} {temporadaSeleccionada.anio} (no es la temporada activa) — solo lectura.
        </p>
      )}

      {!temporadaId && (
        <p className="text-sm text-amber-400 mb-3">
          Todavía no hay ninguna temporada creada para {categoria} · {tira}.
          {esStaffCompleto(rol) && (
            <button onClick={() => setShowNuevaTemporada(true)} className="ml-1 text-brand-400 hover:text-brand-300 underline">Creá la primera</button>
          )}
        </p>
      )}

      {temporadaId && esTemporadaActiva && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-zinc-500">{verBaja ? "Jugadores dados de baja" : ""}</p>
          <button onClick={() => setVerBaja((v) => !v)} className="text-xs text-zinc-400 hover:text-zinc-200">
            {verBaja ? "Volver al plantel" : "Ver dados de baja"}
          </button>
        </div>
      )}

      {(loadingHistorico || loadingBaja) && <p className="text-sm text-zinc-500 mb-2">Cargando…</p>}

      {!loadingHistorico && !loadingBaja && listaMostrada.length === 0 && (
        <p className="text-sm text-zinc-500">
          {verBaja ? "No hay jugadores dados de baja en esta temporada." : temporadaId ? `No hay jugadores cargados en ${categoria} · ${tira} todavía.` : ""}
        </p>
      )}

      <div className="space-y-2">
        {listaMostrada.map((j) => (
          <div key={j.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <FotoJugadorMini url={j.foto_url} size={24} />
              <span className="text-brand-300 font-mono text-xs">#{j.dorsal ?? "-"}</span>
              <span className="font-medium text-sm">{j.nombre_apellido}</span>
              {(j.categoria_origen !== categoria || j.tira !== tira) && (
                <span className="text-xs text-zinc-500">(de {j.categoria_origen} · {j.tira})</span>
              )}
              {j.disponibilidad && j.disponibilidad !== "Disponible" && (
                <span className={`text-xs px-1.5 py-0.5 rounded border ${j.disponibilidad === "Lesionado" ? "bg-red-500/15 text-red-300 border-red-500/30" : "bg-amber-500/15 text-amber-300 border-amber-500/30"}`}>
                  {j.disponibilidad}
                </span>
              )}
              <span className="text-zinc-500 text-xs ml-auto">{formatPosicion(j)}</span>
              {verBaja ? (
                <button onClick={() => reactivar(j)} className="text-xs text-emerald-400 hover:text-emerald-300">Reactivar</button>
              ) : (
                <>
                  {puedeEditar && (
                    <button onClick={() => setEditTarget(j)} title="Editar jugador" className="text-zinc-600 hover:text-blue-400 p-1">
                      <PenLine size={13} />
                    </button>
                  )}
                  {puedeAltaBaja && (
                    <button onClick={() => setDeleteTarget(j)} title="Dar de baja" className="text-zinc-600 hover:text-red-400 p-1">
                      <Trash2 size={13} />
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {j.altura != null && <Chip>{j.altura} m</Chip>}
              {j.peso != null && <Chip>{j.peso} kg</Chip>}
              {calcularEdad(j.fecha_nacimiento) != null && <Chip>{calcularEdad(j.fecha_nacimiento)} años</Chip>}
              {(j.equipos_adicionales || []).map((e, i) => (
                <Chip key={i} tone="blue">+ {e.categoria} · {e.tira}</Chip>
              ))}
            </div>
            {j.notas_comentarios && <p className="text-sm text-zinc-400 mb-1">{j.notas_comentarios}</p>}
            {j.disponibilidad !== "Disponible" && (j.lesion_detalle || j.lesion_desde) && (
              <p className="text-sm text-amber-300/80 mb-1">
                {j.lesion_detalle}{j.lesion_desde ? ` (desde ${j.lesion_desde})` : ""}
              </p>
            )}
            <PromedioMiniStats p={promedios[j.id]} />
            {puedeEditar && !verBaja && (
              <div className="flex items-center gap-3">
                <button onClick={() => setMedidasTarget(j)} className="text-xs text-sky-400 hover:text-sky-300">Actualizar medidas</button>
                <button onClick={() => setEvaluacionTarget(j)} className="text-xs text-sky-400 hover:text-sky-300">Cargar evaluación física</button>
              </div>
            )}
            {j.evaluaciones_pfs?.length > 0 && (
              <button onClick={() => setEvolucionTargetId(j.id)} className="mt-1 text-xs text-zinc-500 hover:text-zinc-300">
                Ver evolución ({j.evaluaciones_pfs.length})
              </button>
            )}
          </div>
        ))}
      </div>

      {(showAdd || editTarget) && (
        <JugadorFormModal
          jugador={editTarget}
          categoria={categoria}
          tira={tira}
          soloCamposMedicos={soloCamposMedicos}
          onCancel={() => { setShowAdd(false); setEditTarget(null); }}
          onSave={async (data) => {
            if (editTarget) await onUpdateJugador(editTarget.id, data);
            else await onAddJugador(data);
            setShowAdd(false);
            setEditTarget(null);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmSimpleModal
          title="Dar de baja"
          message={`${deleteTarget.nombre_apellido} deja de aparecer en el plantel activo de esta temporada. No se borra su ficha ni su historial — se puede reactivar después desde "Ver dados de baja".`}
          confirmLabel="Dar de baja"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { onDeleteJugador(deleteTarget.id); setDeleteTarget(null); }}
        />
      )}

      {medidasTarget && (
        <ActualizarMedidasModal
          jugador={medidasTarget}
          onCancel={() => setMedidasTarget(null)}
          onSave={async (patch) => { await onUpdateJugador(medidasTarget.id, patch); setMedidasTarget(null); }}
        />
      )}

      {evaluacionTarget && (
        <EvaluacionFisicaModal
          jugador={evaluacionTarget}
          onCancel={() => setEvaluacionTarget(null)}
          onSave={async (patch) => { await onUpdateJugador(evaluacionTarget.id, patch); setEvaluacionTarget(null); }}
        />
      )}

      {evolucionJugador && (
        <EvolucionJugadorModal
          jugador={evolucionJugador}
          puedeEliminar={puedeEditar && !verBaja}
          onEliminar={(idx) => eliminarEvaluacion(evolucionJugador, idx)}
          onCancel={() => setEvolucionTargetId(null)}
        />
      )}

      {showImport && (
        <ImportadorCSVPropio
          categoriaDefault={categoria}
          tiraDefault={tira}
          temporadas={temporadas}
          jugadoresExistentes={jugadores}
          onCancel={() => setShowImport(false)}
          onImported={(nuevos, actualizados) => { onImportJugadores(nuevos, actualizados); setShowImport(false); }}
        />
      )}

      {showNuevaTemporada && (
        <NuevaTemporadaModal
          categoria={categoria}
          tira={tira}
          temporadaActivaActual={temporadasDelEquipo.find((t) => t.activa) || null}
          onCancel={() => setShowNuevaTemporada(false)}
          onCreada={async (nuevaId) => {
            await refrescarTemporadas();
            setTemporadaId(nuevaId);
            setShowNuevaTemporada(false);
          }}
        />
      )}
    </div>
  );
}

// Crea una nueva temporada (competencia) para el equipo activo (categoria/tira ya vienen
// fijos, se muestran de referencia). Si habia una temporada activa previa para este mismo
// equipo, la desactiva y le copia el plantel activo a la nueva (mismo dorsal/equipos
// adicionales), para no tener que recargar a mano a quienes siguen.
function NuevaTemporadaModal({ categoria, tira, temporadaActivaActual, onCancel, onCreada }) {
  const [nombreCompetencia, setNombreCompetencia] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const crear = async () => {
    if (!nombreCompetencia.trim()) return;
    setSaving(true);
    setError("");

    if (temporadaActivaActual) {
      const { error: errDesactivar } = await supabase.from("temporadas").update({ activa: false }).eq("id", temporadaActivaActual.id);
      if (errDesactivar) { setError(errDesactivar.message); setSaving(false); return; }
    }

    const { data: nueva, error: errCrear } = await supabase
      .from("temporadas")
      .insert({ nombre_competencia: nombreCompetencia.trim(), anio: Number(anio), categoria, tira, activa: true })
      .select()
      .single();
    if (errCrear) { setError(errCrear.message); setSaving(false); return; }

    if (temporadaActivaActual) {
      const { data: plantelSaliente, error: errPlantel } = await supabase
        .from("jugador_temporada")
        .select("jugador_id, dorsal, equipos_adicionales")
        .eq("temporada_id", temporadaActivaActual.id)
        .eq("estado", "activo");
      if (errPlantel) { setError(errPlantel.message); setSaving(false); return; }
      if (plantelSaliente.length > 0) {
        const filas = plantelSaliente.map((p) => ({
          jugador_id: p.jugador_id, temporada_id: nueva.id, dorsal: p.dorsal, equipos_adicionales: p.equipos_adicionales, estado: "activo",
        }));
        const { error: errCopia } = await supabase.from("jugador_temporada").insert(filas);
        if (errCopia) { setError(errCopia.message); setSaving(false); return; }
      }
    }

    setSaving(false);
    onCreada(nueva.id);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-md w-full text-zinc-100" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-sm mb-1">Nueva temporada</h3>
        <p className="text-xs text-zinc-500 mb-3">Para {categoria} · {tira}</p>
        <div className="space-y-2">
          <input placeholder="Nombre de la competencia (ej: Liga Metropolitana)" value={nombreCompetencia} onChange={(e) => setNombreCompetencia(e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          <input type="number" placeholder="Año" value={anio} onChange={(e) => setAnio(e.target.value)} className="w-32 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
        </div>
        {temporadaActivaActual && (
          <p className="text-xs text-zinc-500 mt-2">
            Va a reemplazar a "{temporadaActivaActual.nombre_competencia} {temporadaActivaActual.anio}" como temporada activa, copiando el plantel activo actual.
          </p>
        )}
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        <div className="flex gap-2 mt-3">
          <button disabled={!nombreCompetencia.trim() || saving} onClick={crear} className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded">
            {saving ? "Creando…" : "Crear temporada"}
          </button>
          <button onClick={onCancel} className="text-zinc-400 text-sm px-3 py-1.5">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// Foto de perfil circular chica (lista/selector); sin foto cargada muestra una silueta neutra
// en vez de romper el layout.
function FotoJugadorMini({ url, size = 40 }) {
  return url ? (
    <img src={url} alt="" style={{ width: size, height: size }} className="rounded-full object-cover border border-zinc-700 shrink-0" />
  ) : (
    <div style={{ width: size, height: size }} className="rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
      <UserCircle2 size={Math.round(size * 0.65)} className="text-zinc-600" />
    </div>
  );
}

// Tarjeta de ficha base (Fase 1 de Jugador 360°): dorsal, nombre, posicion, altura/peso/edad y
// el semaforo de disponibilidad que ya existe en Plantel, reutilizado tal cual.
function FichaBaseJugador({ jugador }) {
  const edad = calcularEdad(jugador.fecha_nacimiento);
  const semaforo = {
    Disponible: { dot: "bg-emerald-400", text: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/25" },
    Duda: { dot: "bg-amber-400", text: "text-amber-300", bg: "bg-amber-500/10 border-amber-500/25" },
    Lesionado: { dot: "bg-red-400", text: "text-red-300", bg: "bg-red-500/10 border-red-500/25" },
  }[jugador.disponibilidad || "Disponible"];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-fit">
      <div className="flex items-center gap-3 mb-3">
        <FotoJugadorMini url={jugador.foto_url} size={58} />
        <div className="min-w-0">
          <p className="font-bold text-base leading-tight truncate">{jugador.nombre_apellido}</p>
          <p className="text-xs text-zinc-500">#{jugador.dorsal ?? "-"} · {formatPosicion(jugador) || "Sin posición"}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-zinc-950 rounded-lg py-2 text-center">
          <p className="text-sm font-bold">{jugador.altura != null ? `${jugador.altura} m` : "-"}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Altura</p>
        </div>
        <div className="bg-zinc-950 rounded-lg py-2 text-center">
          <p className="text-sm font-bold">{jugador.peso != null ? `${jugador.peso} kg` : "-"}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Peso</p>
        </div>
        <div className="bg-zinc-950 rounded-lg py-2 text-center">
          <p className="text-sm font-bold">{edad != null ? edad : "-"}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Años</p>
        </div>
      </div>
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${semaforo.bg} ${semaforo.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${semaforo.dot}`} />
        {(jugador.disponibilidad || "Disponible").toUpperCase()}
      </span>
      {jugador.disponibilidad && jugador.disponibilidad !== "Disponible" && (jugador.lesion_detalle || jugador.lesion_desde) && (
        <p className="text-sm text-amber-300/80 mt-3">
          {jugador.lesion_detalle}{jugador.lesion_desde ? ` (desde ${jugador.lesion_desde})` : ""}
        </p>
      )}
    </div>
  );
}

// Espacio reservado para las Fases 2/3 (evaluaciones fisicas del PF, promedios vs. plantel) --
// todavia sin implementar, se marca "proximamente" a proposito para no simular datos que no
// existen.
function PlaceholderFase360({ titulo, fase, texto }) {
  return (
    <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{titulo}</p>
        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full shrink-0">{fase} · próximamente</span>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed">{texto}</p>
    </div>
  );
}

function SeccionMini({ children }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{children}</p>
      <div className="flex-1 h-px bg-zinc-800" />
    </div>
  );
}

// Busca, de la evaluacion mas reciente hacia atras, la primera que tenga cargado este campo --
// una evaluacion puntual puede traer solo alguno de los 3 grupos (fuerza/potencia/aceleracion),
// asi que "el ultimo valor" de cada ejercicio no siempre es el de la ultima entrada del array.
function ultimoValorEjercicio(evaluaciones, grupo, campo) {
  for (let i = evaluaciones.length - 1; i >= 0; i--) {
    const v = evaluaciones[i]?.[grupo]?.[campo];
    if (v != null) return { valor: v, fecha: evaluaciones[i].fecha, idx: i };
  }
  return null;
}
function valorAnteriorEjercicio(evaluaciones, grupo, campo, antesDeIdx) {
  for (let i = antesDeIdx - 1; i >= 0; i--) {
    const v = evaluaciones[i]?.[grupo]?.[campo];
    if (v != null) return v;
  }
  return null;
}

// % de cambio vs. la toma anterior de ESE ejercicio puntual, coloreado segun si esa direccion es
// una mejora real (en Aceleracion bajar el tiempo es mejora; en Fuerza/Potencia subir la marca).
function CambioBadge({ curr, prev, lowerIsBetter, className = "" }) {
  if (prev == null || curr == null) return null;
  const diff = curr - prev;
  const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : 0;
  const neutro = Math.abs(pct) < 0.05;
  const mejora = lowerIsBetter ? diff < 0 : diff > 0;
  const cls = neutro ? "text-zinc-500" : mejora ? "text-emerald-400" : "text-red-400";
  return (
    <span className={`text-[10px] font-bold ${cls} ${className}`}>
      {neutro ? "▬" : diff > 0 ? "▲" : "▼"} {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

// Tile de un ejercicio individual del protocolo del PF, con el % de cambio vs. la toma anterior.
function CampoEvaluacionTile({ jugador, grupo, campo, label, unidad, lowerIsBetter }) {
  const evals = jugador.evaluaciones_pfs || [];
  const ultimo = ultimoValorEjercicio(evals, grupo, campo);
  if (!ultimo) {
    return (
      <div className="bg-zinc-950/40 border border-zinc-800 rounded-lg py-2.5 px-2 text-center">
        <p className="text-lg font-extrabold text-zinc-600">—</p>
        <p className="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">{label}</p>
      </div>
    );
  }
  const anterior = valorAnteriorEjercicio(evals, grupo, campo, ultimo.idx);
  return (
    <div className="bg-zinc-950/40 border border-zinc-800 rounded-lg py-2.5 px-2 text-center">
      <p className="text-lg font-extrabold text-zinc-100">{ultimo.valor}<small className="text-xs text-zinc-500 ml-0.5">{unidad}</small></p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">{label}</p>
      <CambioBadge curr={ultimo.valor} prev={anterior} lowerIsBetter={lowerIsBetter} className="block mt-0.5" />
    </div>
  );
}

// Comparacion Derecha vs Izquierda con alerta de riesgo si la asimetria supera el 10% -- umbral
// consensuado con los PFs del club.
function ParUnilateral({ jugador, label, grupo, campoDer, campoIzq, unidad }) {
  const evals = jugador.evaluaciones_pfs || [];
  const der = ultimoValorEjercicio(evals, grupo, campoDer);
  const izq = ultimoValorEjercicio(evals, grupo, campoIzq);
  if (!der || !izq) return null;
  const max = Math.max(der.valor, izq.valor), min = Math.min(der.valor, izq.valor);
  const diffPct = max ? ((max - min) / max) * 100 : 0;
  const alerta = diffPct > 10;
  const scale = max * 1.15 || 1;
  return (
    <div className={`border rounded-lg p-3 mb-2 ${alerta ? "bg-red-500/5 border-red-500/40" : "bg-zinc-950/40 border-zinc-800"}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">{label}</span>
        {alerta ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5 shrink-0">
            <AlertTriangle size={10} /> Asimetría {diffPct.toFixed(1)}%
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-emerald-400 shrink-0">Simétrico ({diffPct.toFixed(1)}%)</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-center">
          <p className="text-base font-extrabold">{izq.valor}<span className="text-[10px] text-zinc-500"> {unidad}</span></p>
          <p className="text-[9px] text-zinc-500 uppercase tracking-wide mt-0.5">Izquierda</p>
        </div>
        <div className="flex-[2] flex items-center h-4">
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full relative overflow-hidden" style={{ transform: "scaleX(-1)" }}>
            <div className={`absolute inset-y-0 left-0 rounded-full ${alerta ? "bg-red-400" : "bg-brand-400"}`} style={{ width: `${(izq.valor / scale) * 100}%` }} />
          </div>
          <div className="w-0.5 h-4 bg-zinc-700 shrink-0" />
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full relative overflow-hidden">
            <div className={`absolute inset-y-0 left-0 rounded-full ${alerta ? "bg-red-400" : "bg-brand-400"}`} style={{ width: `${(der.valor / scale) * 100}%` }} />
          </div>
        </div>
        <div className="flex-1 text-center">
          <p className="text-base font-extrabold">{der.valor}<span className="text-[10px] text-zinc-500"> {unidad}</span></p>
          <p className="text-[9px] text-zinc-500 uppercase tracking-wide mt-0.5">Derecha</p>
        </div>
      </div>
    </div>
  );
}

// Historial compacto de 3 ejercicios de referencia (uno por grupo) -- no los 14 completos, para
// que quede legible dentro de la ficha.
function HistorialEvaluacionesCompacto({ jugador }) {
  const evals = (jugador.evaluaciones_pfs || []).filter((e) => e.fuerza?.sentadilla != null || e.potencia?.cmj != null || e.aceleracion?.m10 != null);
  if (evals.length < 2) return null;
  const filas = [...evals].reverse();
  return (
    <div className="mt-4 pt-3 border-t border-zinc-800">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Historial (Sentadilla · CMJ · 10m)</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-500">
              <th className="text-left font-normal pb-1">Fecha</th>
              <th className="text-right font-normal pb-1">Sentadilla</th>
              <th className="text-right font-normal pb-1">CMJ</th>
              <th className="text-right font-normal pb-1">10m</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((e, i) => {
              const prev = filas[i + 1];
              return (
                <tr key={i} className="border-t border-zinc-800/60">
                  <td className={`py-1 whitespace-nowrap ${i === 0 ? "text-zinc-100 font-semibold" : "text-zinc-400"}`}>{e.fecha}</td>
                  <td className="py-1 text-right whitespace-nowrap">
                    {e.fuerza?.sentadilla != null ? <>{e.fuerza.sentadilla}kg <CambioBadge curr={e.fuerza.sentadilla} prev={prev?.fuerza?.sentadilla} /></> : "—"}
                  </td>
                  <td className="py-1 text-right whitespace-nowrap">
                    {e.potencia?.cmj != null ? <>{e.potencia.cmj}cm <CambioBadge curr={e.potencia.cmj} prev={prev?.potencia?.cmj} /></> : "—"}
                  </td>
                  <td className="py-1 text-right whitespace-nowrap">
                    {e.aceleracion?.m10 != null ? <>{e.aceleracion.m10}s <CambioBadge curr={e.aceleracion.m10} prev={prev?.aceleracion?.m10} lowerIsBetter /></> : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Fase 2 de Jugador 360: consulta de solo lectura del protocolo de evaluaciones fisicas del PF
// (se carga desde Plantel, ver EvaluacionFisicaModal) -- Fuerza/Potencia/Aceleracion por
// pestanas, alerta de asimetria en los saltos unilaterales, e historial compacto. Diseno
// validado antes en un prototipo de Claude Artifacts con datos mockeados.
function EvaluacionesFisicasPanel({ jugador }) {
  const [tab, setTab] = useState("fuerza");
  const evals = jugador.evaluaciones_pfs || [];
  const conDatos = [...evals].reverse().find((e) => e.fuerza || e.potencia || e.aceleracion);

  if (!conDatos) {
    return (
      <PlaceholderFase360
        titulo="Evaluaciones físicas (PF)"
        fase="Fase 2"
        texto="Todavía no se cargó ninguna evaluación física para este jugador. Se carga desde la ficha del jugador en Plantel."
      />
    );
  }

  return (
    <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Evaluaciones físicas (PF)</p>
        <span className="text-[10px] text-zinc-500 shrink-0">Última toma: {conDatos.fecha}</span>
      </div>

      <div className="flex bg-zinc-950 border border-zinc-800 rounded-lg p-1 mb-3 gap-1">
        {TABS_EVALUACION.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 text-xs font-semibold py-1.5 rounded-md ${tab === k ? "bg-brand-500 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>{l}</button>
        ))}
      </div>

      {tab === "fuerza" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CAMPOS_FUERZA.map((c) => <CampoEvaluacionTile key={c.k} jugador={jugador} grupo="fuerza" campo={c.k} label={c.l} unidad={c.u} />)}
        </div>
      )}

      {tab === "potencia" && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <CampoEvaluacionTile jugador={jugador} grupo="potencia" campo="cmj" label="CMJ" unidad="cm" />
            <CampoEvaluacionTile jugador={jugador} grupo="potencia" campo="squatJump" label="Squat Jump" unidad="cm" />
            <CampoEvaluacionTile jugador={jugador} grupo="potencia" campo="saltoLargo" label="Salto en largo" unidad="cm" />
          </div>
          <ParUnilateral jugador={jugador} label="CMJ Unilateral" grupo="potencia" campoDer="cmjDer" campoIzq="cmjIzq" unidad="cm" />
          <ParUnilateral jugador={jugador} label="Salto en Largo Unilateral" grupo="potencia" campoDer="saltoLargoDer" campoIzq="saltoLargoIzq" unidad="cm" />
        </>
      )}

      {tab === "aceleracion" && (
        <div className="grid grid-cols-3 gap-2">
          {CAMPOS_ACELERACION.map((c) => <CampoEvaluacionTile key={c.k} jugador={jugador} grupo="aceleracion" campo={c.k} label={c.l} unidad={c.u} lowerIsBetter />)}
        </div>
      )}

      <HistorialEvaluacionesCompacto jugador={jugador} />
    </div>
  );
}

function VolTile({ valor, label, decimales = 0, rango }) {
  const v = Number(valor) || 0;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg py-2.5 text-center">
      <p className="text-lg font-extrabold">{decimales ? v.toFixed(decimales) : Math.round(v)}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</p>
      {rango && <p className="text-[10px] font-bold text-brand-300 mt-0.5">{rango}</p>}
    </div>
  );
}

// Barrita comparativa compartida por MetricaComparada/TiroComparado: relleno = el jugador
// (verde si mejor que la media de equipo, rojo si peor), 2 marcas finas = media de equipo y de
// posicion. Mismo lenguaje visual validado en el prototipo de Artifact.
function BarraComparada({ valor, mediaEquipo, mediaPosicion, esMejor }) {
  const max = Math.max(valor, mediaEquipo, mediaPosicion) * 1.2 || 1;
  const w = (n) => `${Math.min(100, (n / max) * 100)}%`;
  return (
    <div className="relative h-1.5 bg-zinc-800 rounded mb-1.5">
      <div className={`absolute left-0 top-0 h-full rounded ${esMejor ? "bg-emerald-400" : "bg-red-400"}`} style={{ width: w(valor) }} />
      <div className="absolute -top-0.5 w-0.5 h-2.5 bg-zinc-500 rounded-sm" style={{ left: w(mediaEquipo) }} />
      <div className="absolute -top-0.5 w-0.5 h-2.5 bg-brand-300 rounded-sm" style={{ left: w(mediaPosicion) }} />
    </div>
  );
}

function MetricaComparada({ label, valor, mediaEquipo, mediaPosicion, mejorMayor = true, decimales = 1, formato }) {
  const v = Number(valor) || 0;
  const eq = Number(mediaEquipo) || 0;
  const pos = Number(mediaPosicion) || 0;
  const delta = v - eq;
  const neutro = Math.abs(delta) < Math.max(eq * 0.04, 0.05);
  const esMejor = mejorMayor ? delta >= 0 : delta <= 0;
  const colorTexto = neutro ? "text-amber-400 bg-amber-500/10" : esMejor ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10";
  const fmt = formato || ((n) => n.toFixed(decimales));
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] font-bold text-zinc-400 tracking-wide">{label}</span>
        <span className="text-lg font-extrabold">{fmt(v)}</span>
      </div>
      <BarraComparada valor={v} mediaEquipo={eq} mediaPosicion={pos} esMejor={esMejor} />
      <div className="flex items-center justify-between text-[9px] text-zinc-500">
        <span>Equipo <b className="text-zinc-400">{fmt(eq)}</b></span>
        <span className={`font-bold px-1.5 rounded-full ${colorTexto}`}>{delta >= 0 ? "+" : ""}{fmt(delta)}</span>
        <span>Posición <b className="text-zinc-400">{fmt(pos)}</b></span>
      </div>
    </div>
  );
}

function TiroComparado({ label, hechos, intentos, pctEquipo, pctPosicion }) {
  const h = Number(hechos) || 0;
  const i = Number(intentos) || 0;
  const p = i > 0 ? h / i : 0;
  const eq = Number(pctEquipo) || 0;
  const pos = Number(pctPosicion) || 0;
  const delta = p - eq;
  const esMejor = delta >= 0;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
      <p className="text-[10px] font-bold text-zinc-400 tracking-wide mb-1">{label}</p>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-zinc-400">{h.toFixed(1)} / {i.toFixed(1)} por partido</span>
        <span className="text-lg font-extrabold">{Math.round(p * 100)}%</span>
      </div>
      <BarraComparada valor={p} mediaEquipo={eq} mediaPosicion={pos} esMejor={esMejor} />
      <div className="flex items-center justify-between text-[9px] text-zinc-500">
        <span>Equipo <b className="text-zinc-400">{Math.round(eq * 100)}%</b></span>
        <span className={`font-bold px-1.5 rounded-full ${esMejor ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>{delta >= 0 ? "+" : ""}{Math.round(delta * 100)}%</span>
        <span>Posición <b className="text-zinc-400">{Math.round(pos * 100)}%</b></span>
      </div>
    </div>
  );
}

const METRICAS_BASE_360 = [
  { campo: "pts_prom", label: "PTS", mejorMayor: true },
  { campo: "ast_prom", label: "AST", mejorMayor: true },
  { campo: "rdef_prom", label: "RD", mejorMayor: true },
  { campo: "rof_prom", label: "RO", mejorMayor: true },
];
const METRICAS_CONTROL_360 = [
  { campo: "per_prom", label: "PER", mejorMayor: false },
  { campo: "rec_prom", label: "ROB", mejorMayor: true },
];
const ORDINALES_360 = ["1°", "2°", "3°", "4°", "5°", "6°", "7°", "8°", "9°", "10°", "11°", "12°"];

// Fase 3: promedios del jugador de ESTA temporada (vista_promedios_jugador, ya trae todo lo
// necesario -- ver supabase/schema_estadisticas_temporadas.sql) comparados contra la media del
// equipo y de su posicion, calculadas en el cliente sobre el plantel activo (mismo criterio que
// el resto de la app: traer el dataset chico del equipo y promediar ahi, sin vistas SQL nuevas).
function AnaliticaComparada360({ equipo, seleccionado, temporadaId }) {
  const [porJugador, setPorJugador] = useState({});
  const [loading, setLoading] = useState(true);
  const idsEquipo = equipo.map((j) => j.id).join(",");

  useEffect(() => {
    if (!temporadaId || !idsEquipo) { setPorJugador({}); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("vista_promedios_jugador")
        .select("*")
        .in("jugador_id", idsEquipo.split(","))
        .eq("temporada_id", temporadaId);
      if (cancelled) return;
      if (!error) setPorJugador(Object.fromEntries((data || []).map((p) => [p.jugador_id, p])));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [idsEquipo, temporadaId]);

  if (loading) return <p className="text-sm text-zinc-500">Cargando estadísticas…</p>;

  const misProm = porJugador[seleccionado.id];
  if (!misProm) {
    return <p className="text-sm text-zinc-500">Todavía no hay partidos cargados para {seleccionado.nombre_apellido} en esta temporada.</p>;
  }

  const filasEquipo = Object.values(porJugador);
  const posicionesDe = (j) => [j.posicion, j.posicion_secundaria].filter(Boolean);
  const misPosiciones = posicionesDe(seleccionado);
  const filasPosicion = equipo.filter((j) => posicionesDe(j).some((p) => misPosiciones.includes(p))).map((j) => porJugador[j.id]).filter(Boolean);
  const avg = (filas, campo) => {
    const vals = filas.map((f) => Number(f[campo]) || 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };
  const pctProm = (filas, campoM, campoI) => {
    const i = avg(filas, campoI);
    return i > 0 ? avg(filas, campoM) / i : 0;
  };
  const ranking = [...filasEquipo].sort((a, b) => (Number(b.play_prom) || 0) - (Number(a.play_prom) || 0));
  const puesto = ranking.findIndex((f) => f.jugador_id === misProm.jugador_id) + 1;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <VolTile valor={misProm.pj} label="Partidos jugados" />
        <VolTile valor={misProm.min_prom} label="Min. promedio" decimales={1} />
        <VolTile valor={misProm.play_prom} label="Plays / partido" decimales={1} rango={puesto ? `${ORDINALES_360[puesto - 1] || puesto + "°"} del equipo` : null} />
      </div>

      <SeccionMini>Métricas base</SeccionMini>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {METRICAS_BASE_360.map((m) => (
          <MetricaComparada key={m.campo} label={m.label} mejorMayor={m.mejorMayor}
            valor={misProm[m.campo]} mediaEquipo={avg(filasEquipo, m.campo)} mediaPosicion={avg(filasPosicion, m.campo)} />
        ))}
      </div>

      <SeccionMini>Control de balón</SeccionMini>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {METRICAS_CONTROL_360.map((m) => (
          <MetricaComparada key={m.campo} label={m.label} mejorMayor={m.mejorMayor}
            valor={misProm[m.campo]} mediaEquipo={avg(filasEquipo, m.campo)} mediaPosicion={avg(filasPosicion, m.campo)} />
        ))}
      </div>

      <SeccionMini>Eficiencia</SeccionMini>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <MetricaComparada label="PTS / PLAY" decimales={2}
          valor={misProm.pplay_prom} mediaEquipo={avg(filasEquipo, "pplay_prom")} mediaPosicion={avg(filasPosicion, "pplay_prom")} />
        <MetricaComparada label="eFG%" mejorMayor formato={(n) => `${Math.round(n * 100)}%`}
          valor={misProm.efg_pct_prom} mediaEquipo={avg(filasEquipo, "efg_pct_prom")} mediaPosicion={avg(filasPosicion, "efg_pct_prom")} />
        <MetricaComparada label="%TOV (Pérdidas/Plays)" mejorMayor={false} formato={(n) => `${Math.round(n * 100)}%`}
          valor={misProm.tov_pct_prom} mediaEquipo={avg(filasEquipo, "tov_pct_prom")} mediaPosicion={avg(filasPosicion, "tov_pct_prom")} />
        <MetricaComparada label="AST / TOV" decimales={2}
          valor={pctProm([misProm], "ast_prom", "per_prom")} mediaEquipo={pctProm(filasEquipo, "ast_prom", "per_prom")} mediaPosicion={pctProm(filasPosicion, "ast_prom", "per_prom")} />
      </div>

      <SeccionMini>Efectividad de tiro</SeccionMini>
      <div className="grid sm:grid-cols-3 gap-2 mb-3">
        <TiroComparado label="Tiros de 2 (T2)" hechos={misProm.t2a_prom} intentos={misProm.t2i_prom}
          pctEquipo={pctProm(filasEquipo, "t2a_prom", "t2i_prom")} pctPosicion={pctProm(filasPosicion, "t2a_prom", "t2i_prom")} />
        <TiroComparado label="Tiros de 3 (T3)" hechos={misProm.t3a_prom} intentos={misProm.t3i_prom}
          pctEquipo={pctProm(filasEquipo, "t3a_prom", "t3i_prom")} pctPosicion={pctProm(filasPosicion, "t3a_prom", "t3i_prom")} />
        <TiroComparado label="Tiros libres (TL)" hechos={misProm.t1a_prom} intentos={misProm.t1i_prom}
          pctEquipo={pctProm(filasEquipo, "t1a_prom", "t1i_prom")} pctPosicion={pctProm(filasPosicion, "t1a_prom", "t1i_prom")} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-sm bg-zinc-500 inline-block" /> Media del equipo</span>
        <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-sm bg-brand-300 inline-block" /> Media de su posición</span>
      </div>
    </div>
  );
}

// Vista 360° del jugador (Fase 1): buscador/selector scopeado a Categoria/Tira/Temporada activa
// (useTeam(), mismo criterio que Plantel) + ficha base, con los espacios de las Fases 2-4
// reservados como placeholders explicitos.
function Jugador360View({ jugadores }) {
  const {
    categoria, tira, setCategoria, setTira,
    temporadasDelEquipo, temporadaId, temporadaSeleccionada, esTemporadaActiva, setTemporadaId,
  } = useTeam();
  const [busqueda, setBusqueda] = useState("");
  const [seleccionadoId, setSeleccionadoId] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const buscadorRef = useRef(null);

  // Cierra el desplegable del buscador al tocar fuera, como cualquier combobox -- antes la
  // lista de jugadores quedaba siempre fija en pantalla ocupando lugar innecesariamente.
  useEffect(() => {
    const onClickFuera = (e) => {
      if (buscadorRef.current && !buscadorRef.current.contains(e.target)) setBuscadorAbierto(false);
    };
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, []);

  // "jugadores" (prop) solo trae la temporada ACTIVA de cada equipo (igual que en Plantel) --
  // mirar una temporada pasada de este equipo puntual es un fetch aparte, acotado a esa
  // temporada_id, que no reemplaza el estado global.
  useEffect(() => {
    if (esTemporadaActiva || !temporadaId) { setHistorico([]); return; }
    let cancelled = false;
    setLoadingHistorico(true);
    (async () => {
      const { data, error } = await supabase
        .from("vista_plantel_temporada")
        .select("*")
        .eq("temporada_id", temporadaId)
        .eq("estado", "activo")
        .order("nombre_apellido", { ascending: true });
      if (cancelled) return;
      if (!error) setHistorico(data || []);
      setLoadingHistorico(false);
    })();
    return () => { cancelled = true; };
  }, [esTemporadaActiva, temporadaId]);

  const delEquipo = esTemporadaActiva ? jugadores.filter((j) => jugadorEnEquipo(j, categoria, tira)) : historico;
  const filtrados = busqueda.trim()
    ? delEquipo.filter((j) => j.nombre_apellido.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : delEquipo;
  const seleccionado = delEquipo.find((j) => j.id === seleccionadoId) || null;

  return (
    <div className="max-w-5xl mx-auto text-zinc-100">
      <div className="flex items-center gap-2 mb-1 text-zinc-400">
        <Target size={18} />
        <span className="text-xs font-bold uppercase tracking-widest">Vista 360°</span>
      </div>
      <h1 className="text-2xl font-bold mb-3">Rendimiento integral del jugador</h1>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <select value={categoria} onChange={(e) => { setCategoria(e.target.value); setSeleccionadoId(null); }} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={tira} onChange={(e) => { setTira(e.target.value); setSeleccionadoId(null); }} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
          {TIRAS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {temporadasDelEquipo.length > 1 && (
          <select value={temporadaId ?? ""} onChange={(e) => { setTemporadaId(e.target.value); setSeleccionadoId(null); }} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
            {temporadasDelEquipo.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre_competencia} {t.anio}{t.activa ? " (activa)" : ""}</option>
            ))}
          </select>
        )}
      </div>

      {!esTemporadaActiva && temporadaSeleccionada && (
        <p className="text-xs text-amber-400 mb-3">
          Estás viendo {temporadaSeleccionada.nombre_competencia} {temporadaSeleccionada.anio} (no es la temporada activa) — datos históricos.
        </p>
      )}

      <div className="relative mb-6 max-w-sm" ref={buscadorRef}>
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setBuscadorAbierto(true); }} onFocus={() => setBuscadorAbierto(true)}
          placeholder={seleccionado ? `#${seleccionado.dorsal ?? "-"} ${seleccionado.nombre_apellido}` : "Buscar jugador por nombre…"}
          className="w-full bg-zinc-900 border border-zinc-700 rounded pl-8 pr-2 py-1.5 text-sm text-zinc-100" />

        {buscadorAbierto && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 border border-zinc-700 rounded-lg overflow-y-auto max-h-72 bg-zinc-900 shadow-xl">
            {loadingHistorico ? (
              <p className="text-sm text-zinc-500 px-3 py-2">Cargando…</p>
            ) : filtrados.length === 0 ? (
              <p className="text-sm text-zinc-500 px-3 py-2">No hay jugadores para {categoria} · {tira}.</p>
            ) : (
              filtrados.map((j) => (
                <button key={j.id} onClick={() => { setSeleccionadoId(j.id); setBusqueda(""); setBuscadorAbierto(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm border-t border-zinc-800 first:border-t-0 ${seleccionado?.id === j.id ? "bg-brand-500/15 text-brand-300" : "text-zinc-300 hover:bg-zinc-800"}`}>
                  <FotoJugadorMini url={j.foto_url} size={22} />
                  <span className="flex-1 text-left truncate">#{j.dorsal ?? "-"} {j.nombre_apellido}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {seleccionado && (
        <>
          <div className="grid lg:grid-cols-[280px_1fr] gap-4">
            <FichaBaseJugador jugador={seleccionado} />
            <div className="flex flex-col gap-4">
              <EvaluacionesFisicasPanel jugador={seleccionado} />
              <div className="bg-zinc-950/40 border border-zinc-800 rounded-xl p-3">
                <AnaliticaComparada360 equipo={delEquipo} seleccionado={seleccionado} temporadaId={temporadaSeleccionada?.id} />
              </div>
            </div>
          </div>
          <div className="mt-4 border border-dashed border-zinc-700 rounded-xl px-4 py-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm text-zinc-400 font-medium"><GitCompare size={15} /> Comparar con otro jugador (modo espejo)</span>
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full shrink-0">Fase 4 · próximamente</span>
          </div>
        </>
      )}
    </div>
  );
}

// Cambio de contraseña de la cuenta logueada (supabase.auth.updateUser) -- no hace falta
// reingresar la contraseña actual, Supabase alcanza con la sesion activa.
function CambiarPasswordModal({ onCancel }) {
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const submit = async () => {
    setError("");
    if (pass1.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (pass1 !== pass2) { setError("Las contraseñas no coinciden."); return; }
    setSaving(true);
    const { error: errUpdate } = await supabase.auth.updateUser({ password: pass1 });
    setSaving(false);
    if (errUpdate) { setError(errUpdate.message); return; }
    setOk(true);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-sm w-full text-zinc-100" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-sm mb-3">Cambiar contraseña</h3>
        {ok ? (
          <>
            <p className="text-sm text-emerald-400 mb-3">Contraseña actualizada correctamente.</p>
            <button onClick={onCancel} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm px-3 py-1.5 rounded">Cerrar</button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <input type="password" placeholder="Nueva contraseña" value={pass1} onChange={(e) => setPass1(e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
              <input type="password" placeholder="Repetir contraseña" value={pass2} onChange={(e) => setPass2(e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
            </div>
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            <div className="flex gap-2 mt-3">
              <button disabled={!pass1 || !pass2 || saving} onClick={submit} className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded">{saving ? "Guardando…" : "Guardar"}</button>
              <button onClick={onCancel} className="text-zinc-400 text-sm px-3 py-1.5">Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Alta de una competencia nueva para CUALQUIER equipo (categoria/tira elegidos a mano, no
// fijos al filtro activo como en NuevaTemporadaModal) -- arranca inactiva a proposito: crear y
// activar son 2 acciones separadas en este panel, para poder precargar una competencia futura
// sin tocar todavia la temporada que esta corriendo.
function NuevaCompetenciaModal({ onCancel, onCreada }) {
  const [nombreCompetencia, setNombreCompetencia] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [tira, setTira] = useState(TIRAS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const crear = async () => {
    if (!nombreCompetencia.trim()) return;
    setSaving(true);
    setError("");
    const { error: errCrear } = await supabase.from("temporadas").insert({
      nombre_competencia: nombreCompetencia.trim(), anio: Number(anio), categoria, tira, activa: false,
    });
    setSaving(false);
    if (errCrear) {
      setError(errCrear.code === "23505" ? "Ya existe una competencia con ese nombre/año para esa categoría y tira." : errCrear.message);
      return;
    }
    onCreada();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-md w-full text-zinc-100" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-sm mb-3">Crear nueva competencia</h3>
        <div className="space-y-2">
          <input placeholder="Nombre (ej: Liga Metropolitana)" value={nombreCompetencia} onChange={(e) => setNombreCompetencia(e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          <div className="flex gap-2">
            <input type="number" placeholder="Año" value={anio} onChange={(e) => setAnio(e.target.value)} className="w-24 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={tira} onChange={(e) => setTira(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
              {TIRAS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        <div className="flex gap-2 mt-3">
          <button disabled={!nombreCompetencia.trim() || saving} onClick={crear} className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded">{saving ? "Creando…" : "Crear"}</button>
          <button onClick={onCancel} className="text-zinc-400 text-sm px-3 py-1.5">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// Listado global de todas las competencias del club (todos los equipos, no solo el filtro
// activo) + alta + "establecer como activa". Usa temporadas/refrescarTemporadas de useTeam()
// directamente -- no hace falta ningun fetch propio, ya estan cargadas ahi.
function GestionTemporadas() {
  const { temporadas, refrescarTemporadas } = useTeam();
  const [showNueva, setShowNueva] = useState(false);
  const [actualizando, setActualizando] = useState(null);
  const [errorActivar, setErrorActivar] = useState("");

  const ordenadas = [...temporadas].sort((a, b) =>
    a.categoria.localeCompare(b.categoria) || a.tira.localeCompare(b.tira) || b.anio - a.anio
  );

  // El indice unico de la base solo permite una fila activa por categoria+tira -- primero hay
  // que desactivar la que este activa hoy para ese mismo equipo, si no es esta misma.
  const establecerActiva = async (temporada) => {
    setActualizando(temporada.id);
    setErrorActivar("");
    const actualActiva = temporadas.find((t) => t.categoria === temporada.categoria && t.tira === temporada.tira && t.activa && t.id !== temporada.id);
    if (actualActiva) {
      const { error } = await supabase.from("temporadas").update({ activa: false }).eq("id", actualActiva.id);
      if (error) { setErrorActivar(error.message); setActualizando(null); return; }
    }
    const { error } = await supabase.from("temporadas").update({ activa: true }).eq("id", temporada.id);
    if (error) { setErrorActivar(error.message); setActualizando(null); return; }
    await refrescarTemporadas();
    setActualizando(null);
  };

  return (
    <Section icon={Trophy} title="Temporadas y competencias" accent="text-brand-400">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <p className="text-xs text-zinc-500">Un torneo activo por equipo (Categoría + Tira) a la vez.</p>
        <button onClick={() => setShowNueva(true)} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm px-3 py-1.5 rounded shrink-0">
          <Plus size={15} /> Crear nueva competencia
        </button>
      </div>

      {errorActivar && <p className="text-xs text-red-400 mb-2">{errorActivar}</p>}

      {ordenadas.length === 0 ? (
        <p className="text-sm text-zinc-500">Todavía no hay ninguna competencia creada.</p>
      ) : (
        <div className="space-y-1.5">
          {ordenadas.map((t) => (
            <div key={t.id} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 flex-wrap">
              <span className="text-sm font-medium flex-1 min-w-0 truncate">{t.nombre_competencia} {t.anio}</span>
              <Chip>{t.categoria} · {t.tira}</Chip>
              {t.activa ? (
                <Chip tone="brand">Activa</Chip>
              ) : (
                <button disabled={actualizando === t.id} onClick={() => establecerActiva(t)} className="text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50 shrink-0">
                  {actualizando === t.id ? "Activando…" : "Establecer como activa"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showNueva && (
        <NuevaCompetenciaModal onCancel={() => setShowNueva(false)} onCreada={async () => { await refrescarTemporadas(); setShowNueva(false); }} />
      )}
    </Section>
  );
}

// Panel de Configuracion (Fase 1): datos de la cuenta + cambio de contraseña para cualquier rol
// que entra aca, y gestion de Temporadas/Competencias oculta por completo salvo para staff
// completo (Head Coach/Asistente Tecnico) -- mismo criterio que el resto de la app, un booleano
// ya resuelto en vez de comparar el rol adentro de cada bloque.
function ConfiguracionView() {
  const { session, rol } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="max-w-3xl mx-auto text-zinc-100">
      <div className="flex items-center gap-2 mb-1 text-zinc-400">
        <Settings size={18} />
        <span className="text-xs font-bold uppercase tracking-widest">Configuración</span>
      </div>
      <h1 className="text-2xl font-bold mb-4">Ajustes de la cuenta</h1>

      <Section icon={UserCircle2} title="Mi cuenta" accent="text-brand-400">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Email</span>
            <span className="text-sm">{session?.user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Rol</span>
            <Chip tone="brand">{ROL_LABELS[rol] || rol}</Chip>
          </div>
          <div className="pt-2.5 border-t border-zinc-800">
            <button onClick={() => setShowPassword(true)} className="flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300">
              <KeyRound size={14} /> Cambiar contraseña
            </button>
          </div>
        </div>
      </Section>

      {esStaffCompleto(rol) && <GestionTemporadas />}

      {showPassword && <CambiarPasswordModal onCancel={() => setShowPassword(false)} />}
    </div>
  );
}

// Vista general de todos los bloques de entrenamiento programados (Entrenamiento, Individual y
// Optativo) de una categoría/tira, para entrar directo a cualquiera sin ir mes a mes en el
// calendario. Optativo no tiene ficha propia todavía, así que se lista pero no es clickeable.
const ENTRENAMIENTOS_TIPOS = ["entrenamiento", "individual", "optativo"];

function EntrenamientosView({ events, onSelectEvent }) {
  const { categoria, tira, setCategoria, setTira } = useTeam();
  const todayKey = todayKeyBA();

  const filtered = events
    .filter((e) => ENTRENAMIENTOS_TIPOS.includes(e.type) && e.categoria === categoria && e.tira === tira && e.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="max-w-3xl mx-auto text-zinc-100">
      <div className="flex items-center gap-2 mb-1 text-zinc-400">
        <Dumbbell size={18} />
        <span className="text-xs font-bold uppercase tracking-widest">Entrenamientos</span>
      </div>
      <h1 className="text-2xl font-bold mb-4">Bloques programados</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={tira} onChange={(e) => setTira(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
          {TIRAS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay entrenamientos, individuales ni optativos programados de hoy en adelante para {categoria} · {tira}.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => {
            const st = TIPO_ESTILO[e.type];
            const clickable = e.type === "entrenamiento" || e.type === "individual";
            const content = (
              <>
                <span className={`w-2 h-2 rounded-full ${st.dot} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${st.text} truncate`}>{e.title}</p>
                  <p className="text-xs text-zinc-500">{e.date} · {st.label}</p>
                </div>
              </>
            );
            return clickable ? (
              <button
                key={e.id}
                onClick={() => onSelectEvent(e)}
                className="w-full text-left rounded-lg border border-zinc-800 px-3 py-2.5 flex items-center gap-3 hover:border-zinc-600 transition"
              >
                {content}
              </button>
            ) : (
              <div key={e.id} className="rounded-lg border border-zinc-800 px-3 py-2.5 flex items-center gap-3">
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Alta y edición de un equipo rival (nombre, escudo, notas colectivas, video de partido).
function EquipoRivalFormModal({ equipo, defaultCategoria, defaultTira, onCancel, onSave }) {
  const [form, setForm] = useState({
    nombre_club: equipo?.nombre_club ?? "",
    logo_url: equipo?.logo_url ?? "",
    notas_colectivas: equipo?.notas_colectivas ?? "",
    video_colectivo_url: equipo?.video_colectivo_url ?? "",
    categoria: equipo?.categoria ?? defaultCategoria ?? "",
    tira: equipo?.tira ?? defaultTira ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.nombre_club) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto text-zinc-100" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-sm mb-3">{equipo ? "Editar equipo rival" : "Agregar equipo rival"}</h3>
        <div className="space-y-2">
          <input placeholder="Nombre del club" value={form.nombre_club} onChange={(e) => set("nombre_club", e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          <div className="flex gap-2">
            <select value={form.categoria} onChange={(e) => set("categoria", e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
              <option value="">— Sin asignar —</option>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.tira} onChange={(e) => set("tira", e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
              <option value="">— Sin asignar —</option>
              {TIRAS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <input placeholder="Link del escudo (logo_url, opcional)" value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          <textarea placeholder="Notas colectivas (fortalezas / debilidades del equipo)" value={form.notas_colectivas} onChange={(e) => set("notas_colectivas", e.target.value)} rows={3} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          <div className="flex items-center gap-2">
            <Youtube size={14} className="text-zinc-500 shrink-0" />
            <input placeholder="Link de YouTube — video colectivo" value={form.video_colectivo_url} onChange={(e) => set("video_colectivo_url", e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button disabled={!form.nombre_club || saving} onClick={submit} className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded">{equipo ? "Guardar cambios" : "Guardar equipo"}</button>
          <button onClick={onCancel} className="text-zinc-400 text-sm px-3 py-1.5">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// Alta y edición de un jugador rival dentro de la ficha de un equipo.
function JugadorRivalFormModal({ jugadorRival, onCancel, onSave }) {
  const [form, setForm] = useState({
    dorsal: jugadorRival?.dorsal ?? "",
    nombre_apellido: jugadorRival?.nombre_apellido ?? "",
    posicion: jugadorRival?.posicion ?? POSICIONES[0],
    posicion_secundaria: jugadorRival?.posicion_secundaria ?? "",
    categoria: jugadorRival?.categoria ?? "",
    cualidades_ataque: jugadorRival?.cualidades_ataque ?? "",
    cualidades_defensa: jugadorRival?.cualidades_defensa ?? "",
    debilidades: jugadorRival?.debilidades ?? "",
    video_individual_url: jugadorRival?.video_individual_url ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.nombre_apellido) return;
    setSaving(true);
    await onSave({ ...form, dorsal: form.dorsal ? Number(form.dorsal) : null, posicion_secundaria: form.posicion_secundaria || null });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto text-zinc-100" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-sm mb-3">{jugadorRival ? "Editar jugador rival" : "Agregar jugador rival"}</h3>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input placeholder="Dorsal" type="number" value={form.dorsal} onChange={(e) => set("dorsal", e.target.value)} className="w-20 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
            <input placeholder="Nombre y apellido" value={form.nombre_apellido} onChange={(e) => set("nombre_apellido", e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          </div>
          <div className="flex gap-2">
            <select value={form.posicion} onChange={(e) => {
              const nueva = e.target.value;
              set("posicion", nueva);
              if (nueva === form.posicion_secundaria) set("posicion_secundaria", "");
            }} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
              {POSICIONES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={form.posicion_secundaria} onChange={(e) => set("posicion_secundaria", e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
              <option value="">— Sin 2da posición —</option>
              {POSICIONES.filter((p) => p !== form.posicion).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <input placeholder="Categoría (Mayor, U21...)" value={form.categoria} onChange={(e) => set("categoria", e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          <textarea placeholder="Cualidades de ataque" value={form.cualidades_ataque} onChange={(e) => set("cualidades_ataque", e.target.value)} rows={2} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          <textarea placeholder="Cualidades de defensa" value={form.cualidades_defensa} onChange={(e) => set("cualidades_defensa", e.target.value)} rows={2} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          <textarea placeholder="Debilidades" value={form.debilidades} onChange={(e) => set("debilidades", e.target.value)} rows={2} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          <div className="flex items-center gap-2">
            <Youtube size={14} className="text-zinc-500 shrink-0" />
            <input placeholder="Link de YouTube — jugadas individuales" value={form.video_individual_url} onChange={(e) => set("video_individual_url", e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button disabled={!form.nombre_apellido || saving} onClick={submit} className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded">{jugadorRival ? "Guardar cambios" : "Guardar jugador"}</button>
          <button onClick={onCancel} className="text-zinc-400 text-sm px-3 py-1.5">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// Resumen compacto de promedios (de vista_promedios_jugador / vista_promedios_equipo) para
// mostrar dentro de una fila de jugador o de la ficha de un equipo. "null" si todavía no hay
// partidos cargados en Estadísticas para ese jugador/equipo.
function PromedioMiniStats({ p }) {
  if (!p) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      <Chip tone="blue">{p.pj} PJ</Chip>
      <Chip tone="blue">{p.pts_prom} PTS</Chip>
      <Chip tone="blue">{p.rtot_prom} RT</Chip>
      <Chip tone="blue">{p.ast_prom} AST</Chip>
      <Chip tone="blue">{p.rec_prom} REC</Chip>
      <Chip tone="blue">{Math.round((p.efg_pct_prom || 0) * 100)}% eFG</Chip>
    </div>
  );
}

// Ficha completa de un equipo rival: notas/video colectivo editable + plantel de jugadores
// rivales (propia tabla relacional, se reusa desde cualquier partido contra este equipo).
function EquipoRivalFicha({ equipo, onBack, onUpdateEquipo, soloLectura }) {
  const [jugadoresRivales, setJugadoresRivales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notas, setNotas] = useState(equipo.notas_colectivas || "");
  const [videoUrl, setVideoUrl] = useState(equipo.video_colectivo_url || "");
  const [showAddJugador, setShowAddJugador] = useState(false);
  const [showImportJugadores, setShowImportJugadores] = useState(false);
  const [editJugador, setEditJugador] = useState(null);
  const [deleteJugador, setDeleteJugador] = useState(null);
  const [showEditEquipo, setShowEditEquipo] = useState(false);
  const [promedioEquipo, setPromedioEquipo] = useState(null);
  const [promediosJugadores, setPromediosJugadores] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("jugadores_rivales").select("*").eq("equipo_rival_id", equipo.id).order("dorsal", { ascending: true });
      if (cancelled) return;
      if (!error) setJugadoresRivales(data);
      setLoading(false);

      if (!error && data.length > 0 && equipo.temporada_id) {
        const { data: proms, error: errProms } = await supabase
          .from("vista_promedios_jugador")
          .select("*")
          .in("jugador_rival_id", data.map((j) => j.id))
          .eq("temporada_id", equipo.temporada_id);
        if (!cancelled && !errProms && proms) {
          setPromediosJugadores(Object.fromEntries(proms.map((p) => [p.jugador_rival_id, p])));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [equipo.id]);

  // Promedios de ESTA temporada del rival, no de todos los partidos historicos que se le hayan
  // cargado alguna vez.
  useEffect(() => {
    if (!equipo.temporada_id) { setPromedioEquipo(null); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("vista_promedios_equipo").select("*").eq("equipo_rival_id", equipo.id).eq("temporada_id", equipo.temporada_id).maybeSingle();
      if (!cancelled && !error) setPromedioEquipo(data);
    })();
    return () => { cancelled = true; };
  }, [equipo.id]);

  const addJugadorRival = async (data) => {
    const { data: row, error } = await supabase.from("jugadores_rivales").insert({ ...data, equipo_rival_id: equipo.id }).select().single();
    if (!error) setJugadoresRivales((prev) => [...prev, row]);
    setShowAddJugador(false);
  };
  const updateJugadorRival = async (id, patch) => {
    const { data: row, error } = await supabase.from("jugadores_rivales").update(patch).eq("id", id).select().single();
    if (!error) setJugadoresRivales((prev) => prev.map((j) => (j.id === id ? row : j)));
    setEditJugador(null);
  };
  const removeJugadorRival = async (id) => {
    const { error } = await supabase.from("jugadores_rivales").delete().eq("id", id);
    if (!error) setJugadoresRivales((prev) => prev.filter((j) => j.id !== id));
    setDeleteJugador(null);
  };
  const importJugadoresRivales = (nuevos) => {
    setJugadoresRivales((prev) => [...prev, ...nuevos]);
    setShowImportJugadores(false);
  };

  return (
    <div className="max-w-2xl mx-auto text-zinc-100">
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm">
          <ArrowLeft size={15} /> Volver a Scouting Hub
        </button>
        {!soloLectura && (
          <button onClick={() => setShowEditEquipo(true)} className="flex items-center gap-1.5 text-zinc-500 hover:text-blue-400 text-xs">
            <PenLine size={13} /> Editar equipo
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-brand-400 mb-1">
        <Shield size={18} />
        <span className="text-xs font-bold uppercase tracking-widest">Ficha de rival</span>
      </div>
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold">{equipo.nombre_club}</h1>
        {equipo.categoria && equipo.tira ? (
          <Chip tone="brand">{equipo.categoria} · {equipo.tira}{equipo.nombre_competencia ? ` — ${equipo.nombre_competencia} ${equipo.anio}` : ""}</Chip>
        ) : (
          <Chip tone="amber">Sin temporada asignada</Chip>
        )}
      </div>

      <EditableField label="Notas colectivas" icon={Shield} accent="text-brand-400" value={notas} onSave={(v) => { setNotas(v); onUpdateEquipo({ notas_colectivas: v }); }} multiline soloLectura={soloLectura} />

      <Section icon={BarChart3} title="Promedios (Estadísticas)" accent="text-brand-400">
        {promedioEquipo ? (
          <PromedioMiniStats p={promedioEquipo} />
        ) : (
          <p className="text-sm text-zinc-500">Todavía no hay partidos de este equipo vinculados en Estadísticas.</p>
        )}
      </Section>

      <Section icon={Youtube} title="Video colectivo" accent="text-brand-400">
        <div className="flex items-center gap-2 mb-2">
          <Youtube size={14} className="text-zinc-500 shrink-0" />
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} onBlur={() => onUpdateEquipo({ video_colectivo_url: videoUrl })} disabled={soloLectura} placeholder="Link de YouTube — video colectivo" className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-100 disabled:opacity-80" />
        </div>
        <VideoLinkButton url={videoUrl} label="Ver Video de Partido" />
      </Section>

      <Section icon={Users} title="Plantel rival" accent="text-brand-400">
        {loading ? (
          <p className="text-sm text-zinc-500">Cargando plantel…</p>
        ) : (
          <div className="space-y-2 mb-3">
            {jugadoresRivales.map((j) => (
              <div key={j.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-brand-300 font-mono text-xs">#{j.dorsal ?? "-"}</span>
                  <span className="font-medium text-sm">{j.nombre_apellido}</span>
                  <VideoLinkButton url={j.video_individual_url} size={13} />
                  <span className="text-zinc-500 text-xs ml-auto">{formatPosicion(j)}{j.categoria ? ` · ${j.categoria}` : ""}</span>
                  {!soloLectura && (
                    <>
                      <button onClick={() => setEditJugador(j)} title="Editar" className="text-zinc-600 hover:text-blue-400 p-1"><PenLine size={12} /></button>
                      <button onClick={() => setDeleteJugador(j)} title="Eliminar" className="text-zinc-600 hover:text-red-400 p-1"><Trash2 size={12} /></button>
                    </>
                  )}
                </div>
                {j.cualidades_ataque && <p className="text-sm text-zinc-400"><span className="text-zinc-500">Ataque:</span> {j.cualidades_ataque}</p>}
                {j.cualidades_defensa && <p className="text-sm text-zinc-400"><span className="text-zinc-500">Defensa:</span> {j.cualidades_defensa}</p>}
                {j.debilidades && <p className="text-sm text-zinc-400"><span className="text-zinc-500">Debilidades:</span> {j.debilidades}</p>}
                <PromedioMiniStats p={promediosJugadores[j.id]} />
              </div>
            ))}
          </div>
        )}
        {!soloLectura && (
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAddJugador(true)} className="flex items-center gap-1.5 text-brand-400 text-sm hover:text-brand-300">
              <Plus size={15} /> Agregar jugador rival
            </button>
            <button onClick={() => setShowImportJugadores(true)} className="flex items-center gap-1.5 text-zinc-500 text-sm hover:text-zinc-300">
              <Upload size={13} /> Importar CSV
            </button>
          </div>
        )}
      </Section>

      {showAddJugador && (
        <JugadorRivalFormModal onCancel={() => setShowAddJugador(false)} onSave={addJugadorRival} />
      )}
      {editJugador && (
        <JugadorRivalFormModal jugadorRival={editJugador} onCancel={() => setEditJugador(null)} onSave={(data) => updateJugadorRival(editJugador.id, data)} />
      )}
      {showImportJugadores && (
        <ImportadorCSVRival
          equipoRivalId={equipo.id}
          onCancel={() => setShowImportJugadores(false)}
          onImported={importJugadoresRivales}
        />
      )}
      {deleteJugador && (
        <ConfirmDeleteModal itemLabel={deleteJugador.nombre_apellido} subject="jugador rival" onCancel={() => setDeleteJugador(null)} onConfirm={() => removeJugadorRival(deleteJugador.id)} />
      )}
      {showEditEquipo && (
        <EquipoRivalFormModal
          equipo={equipo}
          onCancel={() => setShowEditEquipo(false)}
          onSave={async (data) => { await onUpdateEquipo(data); setShowEditEquipo(false); }}
        />
      )}
    </div>
  );
}

function ScoutingHubView({ equiposRivales, onAddEquipo, onUpdateEquipo, onDeleteEquipo, soloLectura, rol }) {
  const [selectedId, setSelectedId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showNuevaTemporada, setShowNuevaTemporada] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const {
    categoria, tira, setCategoria, setTira,
    temporadasDelEquipo, temporadaId, temporadaSeleccionada, esTemporadaActiva,
    setTemporadaId, refrescarTemporadas,
  } = useTeam();
  const [verSinAsignar, setVerSinAsignar] = useState(false);
  const [sinAsignar, setSinAsignar] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [loadingSecundario, setLoadingSecundario] = useState(false);
  const esJugador = rol === ROLES.JUGADOR;

  // Igual que en Calendario: un Jugador no elige categoria/tira, queda fijo a la suya.
  useEffect(() => {
    if (!esJugador) return;
    let cancelled = false;
    (async () => {
      const [{ data: cat }, { data: tir }] = await Promise.all([
        supabase.rpc("mi_categoria"),
        supabase.rpc("mi_tira"),
      ]);
      if (cancelled) return;
      if (cat) setCategoria(cat);
      if (tir) setTira(tir);
    })();
    return () => { cancelled = true; };
  }, [esJugador]);

  // "equiposRivales" (prop) solo trae la temporada ACTIVA de cada equipo -- mirar una temporada
  // pasada de este equipo puntual, o los equipos sin temporada asignada, son fetchs aparte.
  useEffect(() => {
    if (esJugador || esTemporadaActiva || !temporadaId) { setHistorico([]); return; }
    let cancelled = false;
    setLoadingSecundario(true);
    (async () => {
      const { data, error } = await supabase
        .from("vista_equipos_rivales_temporada")
        .select("*")
        .eq("temporada_id", temporadaId)
        .order("nombre_club", { ascending: true });
      if (cancelled) return;
      if (!error) setHistorico(data || []);
      setLoadingSecundario(false);
    })();
    return () => { cancelled = true; };
  }, [esJugador, esTemporadaActiva, temporadaId]);

  useEffect(() => {
    if (!verSinAsignar) return;
    let cancelled = false;
    setLoadingSecundario(true);
    (async () => {
      const { data, error } = await supabase
        .from("vista_equipos_rivales_temporada")
        .select("*")
        .is("temporada_id", null)
        .order("nombre_club", { ascending: true });
      if (cancelled) return;
      if (!error) setSinAsignar(data || []);
      setLoadingSecundario(false);
    })();
    return () => { cancelled = true; };
  }, [verSinAsignar]);

  const selected = (verSinAsignar ? sinAsignar : esTemporadaActiva ? equiposRivales : historico).find((e) => e.id === selectedId) || null;

  if (selected) {
    return (
      <EquipoRivalFicha
        equipo={selected}
        onBack={() => setSelectedId(null)}
        onUpdateEquipo={(patch) => onUpdateEquipo(selected.id, patch)}
        soloLectura={soloLectura || !esTemporadaActiva}
      />
    );
  }

  const equiposMostrados = verSinAsignar
    ? sinAsignar
    : esTemporadaActiva
      ? equiposRivales.filter((eq) => eq.categoria === categoria && eq.tira === tira)
      : historico;

  return (
    <div className="max-w-3xl mx-auto text-zinc-100">
      <div className="flex items-center gap-2 mb-1 text-zinc-400">
        <Shield size={18} />
        <span className="text-xs font-bold uppercase tracking-widest">Scouting Hub</span>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-4">
        <h1 className="text-2xl font-bold">Equipos rivales</h1>
        {!soloLectura && esTemporadaActiva && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm px-3 py-1.5 rounded">
            <Plus size={15} /> Agregar equipo rival
          </button>
        )}
      </div>

      {esJugador ? (
        <p className="text-sm text-zinc-400 mb-4">{categoria} · {tira}</p>
      ) : verSinAsignar ? (
        <div className="flex items-center justify-between flex-wrap gap-y-2 mb-4">
          <p className="text-sm text-zinc-400">Equipos sin temporada asignada</p>
          <button onClick={() => setVerSinAsignar(false)} className="text-xs text-brand-400 hover:text-brand-300">Volver al filtro</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={tira} onChange={(e) => setTira(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
            {TIRAS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {temporadasDelEquipo.length > 1 && (
            <select value={temporadaId ?? ""} onChange={(e) => setTemporadaId(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
              {temporadasDelEquipo.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre_competencia} {t.anio}{t.activa ? " (activa)" : ""}</option>
              ))}
            </select>
          )}
          {esStaffCompleto(rol) && esTemporadaActiva && (
            <button onClick={() => setShowNuevaTemporada(true)} className="text-xs text-brand-400 hover:text-brand-300">+ Nueva temporada</button>
          )}
          <button onClick={() => setVerSinAsignar(true)} className="text-xs text-zinc-500 hover:text-zinc-300 ml-auto">Ver sin asignar</button>
        </div>
      )}

      {!esJugador && !verSinAsignar && !esTemporadaActiva && temporadaSeleccionada && (
        <p className="text-xs text-amber-400 mb-3">
          Estás viendo {temporadaSeleccionada.nombre_competencia} {temporadaSeleccionada.anio} (no es la temporada activa) — solo lectura.
        </p>
      )}

      {!esJugador && !verSinAsignar && !temporadaId && (
        <p className="text-sm text-amber-400 mb-3">
          Todavía no hay ninguna temporada creada para {categoria} · {tira}.
          {esStaffCompleto(rol) && (
            <button onClick={() => setShowNuevaTemporada(true)} className="ml-1 text-brand-400 hover:text-brand-300 underline">Creá la primera</button>
          )}
        </p>
      )}

      {loadingSecundario && <p className="text-sm text-zinc-500 mb-2">Cargando…</p>}

      {!loadingSecundario && equiposMostrados.length === 0 && (
        <p className="text-sm text-zinc-500">
          {verSinAsignar ? "No hay equipos sin temporada asignada." : "Todavía no cargaste ningún equipo rival para esta temporada."}
        </p>
      )}

      <div className="space-y-2">
        {equiposMostrados.map((eq) => (
          <div key={eq.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center gap-3">
            <button onClick={() => setSelectedId(eq.id)} className="flex-1 min-w-0 text-left">
              <p className="font-medium text-sm text-zinc-100 truncate">{eq.nombre_club}</p>
              {eq.notas_colectivas && <p className="text-xs text-zinc-500 line-clamp-1">{eq.notas_colectivas}</p>}
            </button>
            <VideoLinkButton url={eq.video_colectivo_url} size={14} />
            {!soloLectura && esTemporadaActiva && !verSinAsignar && (
              <button onClick={() => setDeleteTarget(eq)} title="Eliminar equipo" className="text-zinc-600 hover:text-red-400 p-1">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {showAdd && (
        <EquipoRivalFormModal
          defaultCategoria={categoria}
          defaultTira={tira}
          onCancel={() => setShowAdd(false)}
          onSave={async (data) => { await onAddEquipo(data); setShowAdd(false); }}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteModal
          itemLabel={deleteTarget.nombre_club}
          subject="equipo rival"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { onDeleteEquipo(deleteTarget.id); setDeleteTarget(null); }}
        />
      )}
      {showNuevaTemporada && (
        <NuevaTemporadaModal
          categoria={categoria}
          tira={tira}
          temporadaActivaActual={temporadasDelEquipo.find((t) => t.activa) || null}
          onCancel={() => setShowNuevaTemporada(false)}
          onCreada={async (nuevaId) => {
            await refrescarTemporadas();
            setTemporadaId(nuevaId);
            setShowNuevaTemporada(false);
          }}
        />
      )}
    </div>
  );
}

// Columnas crudas editables de la vista previa (todas numéricas salvo el nombre y el vínculo).
const STATS_COLS = [
  ["dorsal", "Dorsal"], ["minutos", "Min"], ["pts", "PTS"],
  ["t2a", "T2A"], ["t2i", "T2I"], ["t3a", "T3A"], ["t3i", "T3I"], ["t1a", "T1A"], ["t1i", "T1I"],
  ["rdef", "RD"], ["rof", "RO"], ["rtot", "RT"],
  ["ast", "AST"], ["rec", "REC"], ["per", "PER"],
  ["tc", "TC"], ["tr", "TR"], ["fc", "FC"], ["fr", "FR"],
  ["val", "VAL"], ["plusminus", "+/-"],
];

// Tabla editable de un equipo dentro de la vista previa: todas las columnas crudas del PDF
// como inputs chicos (estilo planilla), más un select para vincular con un jugador propio ya
// cargado en Plantel.
function StatsPreviewTable({ label, rows, onChangeField, onLinkChange, jugadoresPropios, jugadoresRivales, equipoRivalId }) {
  return (
    <div className="mb-4">
      <p className="text-xs text-zinc-400 mb-1">{label} ({rows.length} jugadores)</p>
      <div className="overflow-x-auto border border-zinc-800 rounded-lg">
        <table className="text-xs text-zinc-200 border-collapse w-full">
          <thead>
            <tr className="bg-zinc-900 text-zinc-500">
              <th className="px-1.5 py-1 text-left sticky left-0 bg-zinc-900 z-10">Jugador</th>
              {STATS_COLS.map(([key, lbl]) => <th key={key} className="px-1 py-1 font-normal">{lbl}</th>)}
              <th className="px-1 py-1 font-normal">PLAY</th>
              <th className="px-1 py-1 font-normal">eFG%</th>
              <th className="px-1.5 py-1 font-normal">Vincular</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const linkValue = r.jugador_id ? `own:${r.jugador_id}` : r.jugador_rival_id ? `rival:${r.jugador_rival_id}` : "";
              return (
                <tr key={idx} className="border-t border-zinc-800">
                  <td className="px-1.5 py-1 sticky left-0 bg-zinc-950">
                    <input value={r.nombre_jugador} onChange={(e) => onChangeField(idx, "nombre_jugador", e.target.value)}
                      className="w-36 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-xs" />
                  </td>
                  {STATS_COLS.map(([key]) => (
                    <td key={key} className="px-1 py-1">
                      <input type="number" value={r[key] ?? ""} onChange={(e) => onChangeField(idx, key, e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-12 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-xs" />
                    </td>
                  ))}
                  <td className="px-1 py-1 text-zinc-500 whitespace-nowrap">{r.play}</td>
                  <td className="px-1 py-1 text-zinc-500 whitespace-nowrap">{Math.round((r.efg_pct || 0) * 100)}%</td>
                  <td className="px-1.5 py-1">
                    <select value={linkValue} onChange={(e) => onLinkChange(idx, e.target.value)}
                      className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-xs max-w-[140px]">
                      <option value="">—</option>
                      {jugadoresPropios.length > 0 && (
                        <optgroup label="Plantel propio">
                          {jugadoresPropios.map((j) => <option key={j.id} value={`own:${j.id}`}>{j.nombre_apellido}</option>)}
                        </optgroup>
                      )}
                      {jugadoresRivales.length > 0 && (
                        <optgroup label="Plantel rival">
                          {jugadoresRivales.map((j) => <option key={j.id} value={`rival:${j.id}`}>{j.nombre_apellido}</option>)}
                        </optgroup>
                      )}
                      {equipoRivalId && <option value="new-rival">+ Crear jugador rival nuevo</option>}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Fila (única) de totales oficiales del equipo, editable, tal cual la fila TOTALES del PDF.
function EquipoTotalsRow({ label, totales, onChange }) {
  if (!totales) return null;
  const cols = STATS_COLS.filter(([k]) => k !== "dorsal" && k !== "minutos" && k !== "plusminus");
  return (
    <div className="mb-3">
      <p className="text-xs text-zinc-400 mb-1">Totales oficiales — {label}</p>
      <div className="overflow-x-auto border border-zinc-800 rounded-lg">
        <table className="text-xs text-zinc-200 border-collapse w-full">
          <thead>
            <tr className="bg-zinc-900 text-zinc-500">
              {cols.map(([key, lbl]) => <th key={key} className="px-1 py-1 font-normal">{lbl}</th>)}
              <th className="px-1 py-1 font-normal">eFG%</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-zinc-800">
              {cols.map(([key]) => (
                <td key={key} className="px-1 py-1">
                  <input type="number" value={totales[key] ?? ""} onChange={(e) => onChange(key, e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-12 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-xs" />
                </td>
              ))}
              <td className="px-1 py-1 text-zinc-500 whitespace-nowrap">{Math.round((totales.efg_pct || 0) * 100)}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Selects compactos para asignar a mano la Categoria/Tira de un partido viejo (cargado antes de
// que existiera la matriz), directamente en la fila del historial.
function AsignarMatrizPartido({ partido, temporadas, defaultTemporadaId, onAsignar }) {
  const [temporadaId, setTemporadaIdLocal] = useState(partido.temporada_id || defaultTemporadaId || "");
  return (
    <div className="flex items-center gap-1">
      <select value={temporadaId} onChange={(e) => setTemporadaIdLocal(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-1 py-0.5 text-xs text-zinc-100">
        <option value="">— Elegir temporada —</option>
        {temporadas.map((t) => (
          <option key={t.id} value={t.id}>{t.categoria} · {t.tira} — {t.nombre_competencia} {t.anio}</option>
        ))}
      </select>
      <button disabled={!temporadaId} onClick={() => onAsignar(partido.id, temporadaId)} className="text-xs text-brand-400 hover:text-brand-300 px-1 disabled:opacity-40">Asignar</button>
    </div>
  );
}

function EstadisticasView({ jugadores, equiposRivales, soloLectura }) {
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(true);
  const {
    categoria, tira, setCategoria, setTira,
    temporadas, temporadasDelEquipo, temporadaId, temporadaSeleccionada, esTemporadaActiva,
    setTemporadaId, refrescarTemporadas,
  } = useTeam();
  const [showNuevaTemporada, setShowNuevaTemporada] = useState(false);
  const [verSinAsignar, setVerSinAsignar] = useState(false);
  const [sinAsignar, setSinAsignar] = useState([]);
  const [jugadoresRivalesLocal, setJugadoresRivalesLocal] = useState([]);
  const [jugadoresRivalesVisitante, setJugadoresRivalesVisitante] = useState([]);
  const [historicoJugadores, setHistoricoJugadores] = useState([]);

  // Temporada "en juego" para el formulario: por defecto la seleccionada arriba, pero al cargar
  // un partido NUEVO el propio campo "Torneo" puede apuntar a otra (ver mas abajo) -- asi se
  // puede armar historial de una temporada pasada sin salir del formulario a cambiar el filtro.
  const temporadaIdForm = preview?.temporadaId ?? temporadaId;
  const temporadaFormActiva = temporadasDelEquipo.find((t) => t.id === temporadaIdForm)?.activa ?? false;

  // "jugadores" (prop) solo trae la temporada ACTIVA de cada equipo -- para poder cargar un
  // partido de una temporada PASADA (y vincular sus jugadores) hace falta el plantel de ESA
  // temporada puntual, mismo criterio que ya usan PlantelView/Jugador360View.
  useEffect(() => {
    if (temporadaFormActiva || !temporadaIdForm) { setHistoricoJugadores([]); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("vista_plantel_temporada")
        .select("*")
        .eq("temporada_id", temporadaIdForm)
        .eq("estado", "activo")
        .order("nombre_apellido", { ascending: true });
      if (cancelled) return;
      if (!error) setHistoricoJugadores(data || []);
    })();
    return () => { cancelled = true; };
  }, [temporadaFormActiva, temporadaIdForm]);

  // Acotado a la categoria/tira del filtro activo -- sin esto, "Plantel propio" en el vinculador
  // mostraba el plantel entero del club (todas las categorias), una lista interminable para
  // encontrar un jugador puntual.
  const jugadoresPropiosDelEquipo = temporadaFormActiva
    ? jugadores.filter((j) => jugadorEnEquipo(j, categoria, tira))
    : historicoJugadores;
  const [aliasEquipo, setAliasEquipo] = useState({});
  const [aliasJugador, setAliasJugador] = useState({});
  const [aliasJugadorRival, setAliasJugadorRival] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [eq, ju, jr] = await Promise.all([
        supabase.from("alias_equipo").select("*"),
        supabase.from("alias_jugador").select("*"),
        supabase.from("alias_jugador_rival").select("*"),
      ]);
      if (cancelled) return;
      if (!eq.error && eq.data) setAliasEquipo(Object.fromEntries(eq.data.map((a) => [a.nombre_pdf, a.equipo_rival_id])));
      if (!ju.error && ju.data) setAliasJugador(Object.fromEntries(ju.data.map((a) => [a.nombre_pdf, a.jugador_id])));
      if (!jr.error && jr.data) setAliasJugadorRival(Object.fromEntries(jr.data.map((a) => [`${a.equipo_rival_id}::${a.nombre_pdf}`, a.jugador_rival_id])));
    })();
    return () => { cancelled = true; };
  }, []);

  const persistAliasEquipo = async (nombrePdf, equipoRivalId) => {
    const norm = normalizeName(nombrePdf);
    if (!norm || !equipoRivalId) return;
    setAliasEquipo((prev) => ({ ...prev, [norm]: equipoRivalId }));
    await supabase.from("alias_equipo").upsert({ nombre_pdf: norm, equipo_rival_id: equipoRivalId }, { onConflict: "nombre_pdf" });
  };

  const persistAliasJugador = async (nombrePdf, jugadorId) => {
    const norm = normalizeName(nombrePdf);
    if (!norm || !jugadorId) return;
    setAliasJugador((prev) => ({ ...prev, [norm]: jugadorId }));
    await supabase.from("alias_jugador").upsert({ nombre_pdf: norm, jugador_id: jugadorId }, { onConflict: "nombre_pdf" });
  };

  const persistAliasJugadorRival = async (nombrePdf, equipoRivalId, jugadorRivalId) => {
    const norm = normalizeName(nombrePdf);
    if (!norm || !equipoRivalId || !jugadorRivalId) return;
    setAliasJugadorRival((prev) => ({ ...prev, [`${equipoRivalId}::${norm}`]: jugadorRivalId }));
    await supabase.from("alias_jugador_rival").upsert({ nombre_pdf: norm, equipo_rival_id: equipoRivalId, jugador_rival_id: jugadorRivalId }, { onConflict: "nombre_pdf,equipo_rival_id" });
  };

  // Trae solo los partidos de la temporada actualmente seleccionada (no todo el club) -- a
  // diferencia de jugadores/equiposRivales, nada mas en la app necesita ver el historial de
  // otro equipo al mismo tiempo, asi que alcanza con un fetch acotado que se repite cuando
  // cambia la temporada.
  const fetchHistorial = async (idTemporada) => {
    if (!idTemporada) { setHistorial([]); setLoadingHistorial(false); return; }
    setLoadingHistorial(true);
    const { data, error } = await supabase.from("partidos_stats").select("*").eq("temporada_id", idTemporada).order("fecha", { ascending: false });
    if (!error) setHistorial(data);
    setLoadingHistorial(false);
  };

  useEffect(() => { fetchHistorial(temporadaId); }, [temporadaId]);

  useEffect(() => {
    if (!verSinAsignar) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("partidos_stats").select("*").is("temporada_id", null).order("fecha", { ascending: false });
      if (!cancelled && !error) setSinAsignar(data || []);
    })();
    return () => { cancelled = true; };
  }, [verSinAsignar]);

  useEffect(() => {
    const id = preview?.equipoLocalRivalId;
    if (!id) { setJugadoresRivalesLocal([]); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("jugadores_rivales").select("*").eq("equipo_rival_id", id).order("nombre_apellido", { ascending: true });
      if (!cancelled && !error) setJugadoresRivalesLocal(data);
    })();
    return () => { cancelled = true; };
  }, [preview?.equipoLocalRivalId]);

  useEffect(() => {
    const id = preview?.equipoVisitanteRivalId;
    if (!id) { setJugadoresRivalesVisitante([]); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("jugadores_rivales").select("*").eq("equipo_rival_id", id).order("nombre_apellido", { ascending: true });
      if (!cancelled && !error) setJugadoresRivalesVisitante(data);
    })();
    return () => { cancelled = true; };
  }, [preview?.equipoVisitanteRivalId]);

  const linkJugadorPorNombre = (nombre) => {
    const norm = normalizeName(nombre);
    if (aliasJugador[norm]) return aliasJugador[norm];
    const match = jugadoresPropiosDelEquipo.find((j) => normalizeName(j.nombre_apellido) === norm);
    return match ? match.id : null;
  };

  const handleFile = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setParsing(true);
    setParseError("");
    setPreview(null);
    setSaveMsg("");
    try {
      const result = await parseCabbPdf(f);
      if (!result.equipoLocal || !result.equipoVisitante) {
        setParseError('No pude leer el encabezado del PDF (equipos/torneo). Revisá que sea un PDF de estadísticas de la CABB (Gesdeportiva) y que tenga texto seleccionable, no un escaneo.');
      }
      const equipoLocalRivalId = aliasEquipo[normalizeName(result.equipoLocal)] || "";
      const equipoVisitanteRivalId = aliasEquipo[normalizeName(result.equipoVisitante)] || "";
      const mapJugador = (j, equipoRivalId) => {
        const jugadorId = linkJugadorPorNombre(j.nombre_jugador);
        const jugadorRivalId = !jugadorId && equipoRivalId
          ? aliasJugadorRival[`${equipoRivalId}::${normalizeName(j.nombre_jugador)}`] || null
          : null;
        return { ...j, jugador_id: jugadorId, jugador_rival_id: jugadorRivalId };
      };
      setPreview({
        fecha: todayKeyBA(),
        torneo: result.torneo,
        // Temporada destino elegible desde el propio campo "Torneo" (ver render mas abajo);
        // arranca en la seleccionada arriba pero se puede cambiar antes de guardar. El nombre
        // de esa temporada es mas confiable que el texto tal cual del PDF para "categoria".
        temporadaId: temporadaId || "",
        categoria: temporadaSeleccionada?.nombre_competencia || result.categoria,
        equipoLocal: result.equipoLocal,
        equipoVisitante: result.equipoVisitante,
        equipoLocalRivalId,
        equipoVisitanteRivalId,
        equipoPropio: detectarEquipoPropio(result.equipoLocal, result.equipoVisitante),
        resultadoLocal: result.equipos[0].totales?.pts ?? "",
        resultadoVisitante: result.equipos[1].totales?.pts ?? "",
        totalesLocal: result.equipos[0].totales,
        totalesVisitante: result.equipos[1].totales,
        jugadoresLocal: result.equipos[0].jugadores.map((j) => mapJugador(j, equipoLocalRivalId)),
        jugadoresVisitante: result.equipos[1].jugadores.map((j) => mapJugador(j, equipoVisitanteRivalId)),
      });
      if (!result.equipos[0].jugadores.length && !result.equipos[1].jugadores.length) {
        setParseError("No encontré filas de jugadores en el PDF. Podés cargar los datos a mano abajo, o revisar que el PDF no esté escaneado como imagen.");
      }
    } catch (err) {
      setParseError("Error al leer el PDF: " + err.message);
    }
    setParsing(false);
  };

  const updateField = (lado, idx, field, value) => {
    setPreview((prev) => {
      const key = lado === "local" ? "jugadoresLocal" : "jugadoresVisitante";
      const next = [...prev[key]];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, [key]: next };
    });
  };

  const updateLink = (lado, idx, value) => {
    if (value === "new-rival") { crearYVincularJugadorRival(lado, idx); return; }
    setPreview((prev) => {
      const key = lado === "local" ? "jugadoresLocal" : "jugadoresVisitante";
      const next = [...prev[key]];
      const row = next[idx];
      const [tipo, id] = value ? value.split(":") : [null, null];
      next[idx] = { ...row, jugador_id: tipo === "own" ? id : null, jugador_rival_id: tipo === "rival" ? id : null };

      if (tipo === "own" && id) {
        persistAliasJugador(row.nombre_jugador, id);
      } else if (tipo === "rival" && id) {
        const equipoRivalId = lado === "local" ? prev.equipoLocalRivalId : prev.equipoVisitanteRivalId;
        if (equipoRivalId) persistAliasJugadorRival(row.nombre_jugador, equipoRivalId, id);
      }

      return { ...prev, [key]: next };
    });
  };

  // Crea el jugador rival al vuelo (nombre tomado del PDF) en el equipo rival ya vinculado de
  // ese lado, y lo deja vinculado en la fila -- para no tener que ir a cargarlo a mano en
  // Scouting Hub antes de poder asociar sus estadisticas.
  const crearYVincularJugadorRival = async (lado, idx) => {
    const key = lado === "local" ? "jugadoresLocal" : "jugadoresVisitante";
    const equipoRivalId = lado === "local" ? preview.equipoLocalRivalId : preview.equipoVisitanteRivalId;
    if (!equipoRivalId) return;
    const row = preview[key][idx];
    const { data, error } = await supabase.from("jugadores_rivales")
      .insert({ equipo_rival_id: equipoRivalId, nombre_apellido: row.nombre_jugador, dorsal: row.dorsal === "" ? null : row.dorsal })
      .select().single();
    if (error) { setSaveMsg("Error al crear el jugador rival: " + error.message); return; }
    if (lado === "local") setJugadoresRivalesLocal((prev) => [...prev, data]);
    else setJugadoresRivalesVisitante((prev) => [...prev, data]);
    setPreview((prev) => {
      const next = [...prev[key]];
      next[idx] = { ...next[idx], jugador_id: null, jugador_rival_id: data.id };
      return { ...prev, [key]: next };
    });
    persistAliasJugadorRival(row.nombre_jugador, equipoRivalId, data.id);
  };

  const updateTotales = (lado, field, value) => {
    setPreview((prev) => {
      const key = lado === "local" ? "totalesLocal" : "totalesVisitante";
      return { ...prev, [key]: { ...prev[key], [field]: value } };
    });
  };

  const recalcularMetricas = () => {
    const recompute = (r) => ({
      ...r,
      ...computeAdvancedStats({
        t2a: Number(r.t2a) || 0, t2i: Number(r.t2i) || 0,
        t3a: Number(r.t3a) || 0, t3i: Number(r.t3i) || 0,
        t1i: Number(r.t1i) || 0, per: Number(r.per) || 0,
        rof: Number(r.rof) || 0, pts: Number(r.pts) || 0,
      }),
    });
    const recomputeEfg = (t) => t && {
      ...t,
      efg_pct: (Number(t.t2i) || 0) + (Number(t.t3i) || 0)
        ? round3(((Number(t.t2a) || 0) + 1.5 * (Number(t.t3a) || 0)) / ((Number(t.t2i) || 0) + (Number(t.t3i) || 0)))
        : 0,
    };
    setPreview((prev) => prev && ({
      ...prev,
      jugadoresLocal: prev.jugadoresLocal.map(recompute),
      jugadoresVisitante: prev.jugadoresVisitante.map(recompute),
      totalesLocal: recomputeEfg(prev.totalesLocal),
      totalesVisitante: recomputeEfg(prev.totalesVisitante),
    }));
  };

  const guardar = async () => {
    if (!preview) return;
    const isEdit = !!preview.id;
    if (!isEdit && !preview.temporadaId) { setSaveMsg("Error: elegí a qué temporada pertenece este partido (campo \"Torneo\")."); return; }
    setSaving(true);
    setSaveMsg("");

    const partidoPatch = {
      fecha: preview.fecha,
      torneo: preview.torneo || null,
      categoria: preview.categoria || null,
      equipo_local: preview.equipoLocal,
      equipo_visitante: preview.equipoVisitante,
      resultado_local: preview.resultadoLocal === "" ? null : Number(preview.resultadoLocal),
      resultado_visitante: preview.resultadoVisitante === "" ? null : Number(preview.resultadoVisitante),
      equipo_propio: preview.equipoPropio || null,
    };

    let partidoId = preview.id;
    if (isEdit) {
      const { error: errPartido } = await supabase.from("partidos_stats").update(partidoPatch).eq("id", partidoId);
      if (errPartido) { setSaveMsg("Error al guardar el partido: " + errPartido.message); setSaving(false); return; }
      // Se reemplazan los hijos entero (en vez de tratar de mergear fila por fila) porque la
      // vista previa no arrastra los ids originales de jugador_partido_stats/equipo_partido_stats.
      await supabase.from("jugador_partido_stats").delete().eq("partido_id", partidoId);
      await supabase.from("equipo_partido_stats").delete().eq("partido_id", partidoId);
    } else {
      const { data: partido, error: errPartido } = await supabase.from("partidos_stats").insert({ ...partidoPatch, temporada_id: preview.temporadaId }).select().single();
      if (errPartido) { setSaveMsg("Error al guardar el partido: " + errPartido.message); setSaving(false); return; }
      partidoId = partido.id;
    }

    const jugadorRows = [
      ...preview.jugadoresLocal.map((j) => ({ ...j, equipo: preview.equipoLocal })),
      ...preview.jugadoresVisitante.map((j) => ({ ...j, equipo: preview.equipoVisitante })),
    ].map((j) => ({
      partido_id: partidoId,
      jugador_id: j.jugador_id || null,
      jugador_rival_id: j.jugador_rival_id || null,
      nombre_jugador: j.nombre_jugador,
      equipo: j.equipo,
      dorsal: j.dorsal === "" ? null : j.dorsal,
      minutos: j.minutos === "" ? null : j.minutos,
      pts: j.pts, t2a: j.t2a, t2i: j.t2i, t3a: j.t3a, t3i: j.t3i, t1a: j.t1a, t1i: j.t1i,
      rdef: j.rdef, rof: j.rof, rtot: j.rtot, ast: j.ast, rec: j.rec, per: j.per,
      tc: j.tc, tr: j.tr, fc: j.fc, fr: j.fr, val: j.val, plusminus: j.plusminus,
      play: j.play, pos: j.pos, pplay: j.pplay, ppos: j.ppos, tov_pct: j.tov_pct, efg_pct: j.efg_pct,
    }));

    if (jugadorRows.length > 0) {
      const { error: errJug } = await supabase.from("jugador_partido_stats").insert(jugadorRows);
      if (errJug) { setSaveMsg("El partido se guardó, pero hubo un error con los jugadores: " + errJug.message); setSaving(false); return; }
    }

    const toEquipoRow = (totales, equipo, condicion, equipoRivalId) => totales && {
      partido_id: partidoId, equipo, condicion, equipo_rival_id: equipoRivalId || null,
      pts: totales.pts, t2a: totales.t2a, t2i: totales.t2i, t3a: totales.t3a, t3i: totales.t3i, t1a: totales.t1a, t1i: totales.t1i,
      rdef: totales.rdef, rof: totales.rof, rtot: totales.rtot, ast: totales.ast, rec: totales.rec, per: totales.per,
      tc: totales.tc, tr: totales.tr, fc: totales.fc, fr: totales.fr, val: totales.val, efg_pct: totales.efg_pct,
    };
    const equipoRows = [
      toEquipoRow(preview.totalesLocal, preview.equipoLocal, "LOCAL", preview.equipoLocalRivalId),
      toEquipoRow(preview.totalesVisitante, preview.equipoVisitante, "VISITANTE", preview.equipoVisitanteRivalId),
    ].filter(Boolean);

    if (equipoRows.length > 0) {
      const { error: errEquipo } = await supabase.from("equipo_partido_stats").insert(equipoRows);
      if (errEquipo) { setSaveMsg("Los jugadores se guardaron, pero hubo un error con los totales de equipo: " + errEquipo.message); setSaving(false); return; }
    }

    setSaveMsg("Guardado ✓");
    setPreview(null);
    setHistorial((prev) => prev.map((h) => (h.id === partidoId ? { ...h, ...partidoPatch } : h)));
    setSinAsignar((prev) => prev.map((h) => (h.id === partidoId ? { ...h, ...partidoPatch } : h)));
    // Si el partido nuevo quedo en una temporada distinta a la que se esta viendo (se cambio el
    // "Torneo" del formulario a otra), la lista visible no necesita tocarse -- se va a traer
    // sola cuando el staff navegue a esa temporada (el efecto de "temporadaId" ya la refresca).
    if (!isEdit && preview.temporadaId === temporadaId) fetchHistorial(temporadaId);
    setSaving(false);
  };

  // Trae un partido ya guardado (header + jugadores + totales de equipo) de vuelta a la misma
  // vista previa editable que usa la carga por PDF, para corregir una carga mal hecha o un
  // vinculo de jugador equivocado sin tener que borrar y recargar el PDF entero.
  const editarPartido = async (p) => {
    setVerSinAsignar(false);
    setSaveMsg("");
    setParseError("");
    const [{ data: equipoRows }, { data: jugadorRows }] = await Promise.all([
      supabase.from("equipo_partido_stats").select("*").eq("partido_id", p.id),
      supabase.from("jugador_partido_stats").select("*").eq("partido_id", p.id),
    ]);
    const totalesLocalRow = (equipoRows || []).find((r) => r.condicion === "LOCAL");
    const totalesVisitanteRow = (equipoRows || []).find((r) => r.condicion === "VISITANTE");
    setPreview({
      id: p.id,
      fecha: p.fecha,
      torneo: p.torneo || "",
      categoria: p.categoria || temporadaSeleccionada?.nombre_competencia || "",
      equipoLocal: p.equipo_local,
      equipoVisitante: p.equipo_visitante,
      equipoLocalRivalId: totalesLocalRow?.equipo_rival_id || "",
      equipoVisitanteRivalId: totalesVisitanteRow?.equipo_rival_id || "",
      equipoPropio: p.equipo_propio || null,
      resultadoLocal: p.resultado_local ?? "",
      resultadoVisitante: p.resultado_visitante ?? "",
      totalesLocal: totalesLocalRow || null,
      totalesVisitante: totalesVisitanteRow || null,
      jugadoresLocal: (jugadorRows || []).filter((j) => j.equipo === p.equipo_local),
      jugadoresVisitante: (jugadorRows || []).filter((j) => j.equipo === p.equipo_visitante),
    });
  };

  const eliminarPartido = async (id) => {
    const { error } = await supabase.from("partidos_stats").delete().eq("id", id);
    if (!error) setHistorial((prev) => prev.filter((p) => p.id !== id));
  };

  const asignarTemporadaPartido = async (id, idTemporada) => {
    const { error } = await supabase.from("partidos_stats").update({ temporada_id: idTemporada }).eq("id", id);
    if (!error) setSinAsignar((prev) => prev.filter((p) => p.id !== id));
  };

  const equiposRivalesFiltrados = equiposRivales.filter((eq) => eq.temporada_id === temporadaIdForm);
  const historialMostrado = verSinAsignar ? sinAsignar : historial;
  // Cargar un partido NUEVO se permite en cualquier temporada (activa o pasada), para poder ir
  // completando el historial de años anteriores. Editar/eliminar uno YA guardado sigue
  // restringido a la temporada activa, para no tocar por accidente un archivo histórico.
  const puedeCargarPartido = !soloLectura;
  const puedeEditar = !soloLectura && (verSinAsignar || esTemporadaActiva);

  return (
    <div className="max-w-5xl mx-auto text-zinc-100">
      <div className="flex items-center gap-2 mb-1 text-zinc-400">
        <BarChart3 size={18} />
        <span className="text-xs font-bold uppercase tracking-widest">Estadísticas</span>
      </div>
      <h1 className="text-2xl font-bold mb-3">Cargar partido (PDF de la CABB)</h1>

      {verSinAsignar ? (
        <div className="flex items-center justify-between flex-wrap gap-y-2 mb-4">
          <p className="text-sm text-zinc-400">Partidos sin temporada asignada</p>
          <button onClick={() => setVerSinAsignar(false)} className="text-xs text-brand-400 hover:text-brand-300">Volver al filtro</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={tira} onChange={(e) => setTira(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
            {TIRAS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {temporadasDelEquipo.length > 1 && (
            <select value={temporadaId ?? ""} onChange={(e) => setTemporadaId(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
              {temporadasDelEquipo.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre_competencia} {t.anio}{t.activa ? " (activa)" : ""}</option>
              ))}
            </select>
          )}
          {!soloLectura && esTemporadaActiva && (
            <button onClick={() => setShowNuevaTemporada(true)} className="text-xs text-brand-400 hover:text-brand-300">+ Nueva temporada</button>
          )}
          <button onClick={() => setVerSinAsignar(true)} className="text-xs text-zinc-500 hover:text-zinc-300 ml-auto">Ver sin asignar</button>
        </div>
      )}

      {!verSinAsignar && !esTemporadaActiva && temporadaSeleccionada && (
        <p className="text-xs text-amber-400 mb-3">
          Estás viendo {temporadaSeleccionada.nombre_competencia} {temporadaSeleccionada.anio} (no es la temporada activa).
          {soloLectura ? " Solo lectura." : " Podés cargar partidos nuevos para completar el historial, pero no editar ni eliminar los que ya están guardados."}
        </p>
      )}

      {!verSinAsignar && !temporadaId && (
        <p className="text-sm text-amber-400 mb-3">
          Todavía no hay ninguna temporada creada para {categoria} · {tira}.
          {!soloLectura && (
            <button onClick={() => setShowNuevaTemporada(true)} className="ml-1 text-brand-400 hover:text-brand-300 underline">Creá la primera</button>
          )}
        </p>
      )}

      {puedeCargarPartido && !verSinAsignar && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
          <label className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm px-3 py-2 rounded cursor-pointer w-fit">
            <Upload size={15} /> Elegir PDF de estadísticas
            <input type="file" accept="application/pdf" onChange={handleFile} className="hidden" />
          </label>
          {parsing && <p className="text-sm text-zinc-500 mt-2">Leyendo el PDF…</p>}
          {parseError && <p className="text-sm text-amber-400 mt-2">{parseError}</p>}
        </div>
      )}

      {puedeCargarPartido && !verSinAsignar && preview && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-bold text-zinc-100 mb-3">{preview.id ? "Editando partido cargado" : "Vista previa — revisá y corregí antes de guardar"}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Fecha</p>
              <input type="date" value={preview.fecha} onChange={(e) => setPreview({ ...preview, fecha: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Torneo</p>
              {preview.id ? (
                <input value={preview.categoria} onChange={(e) => setPreview({ ...preview, categoria: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
              ) : (
                <select value={preview.temporadaId || ""} onChange={(e) => {
                  const id = e.target.value;
                  const t = temporadasDelEquipo.find((x) => x.id === id);
                  setPreview((prev) => ({
                    ...prev,
                    temporadaId: id,
                    categoria: t?.nombre_competencia || prev.categoria,
                    // Los rivales cargados en Scouting Hub son por temporada -- si se cambia de
                    // temporada, el vinculo anterior (de otra competencia) ya no corresponde.
                    equipoLocalRivalId: "",
                    equipoVisitanteRivalId: "",
                  }));
                }}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
                  <option value="">Elegir temporada…</option>
                  {temporadasDelEquipo.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre_competencia} {t.anio}{t.activa ? " (activa)" : ""}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Jornada / Fase</p>
              <input value={preview.torneo} onChange={(e) => setPreview({ ...preview, torneo: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-xs text-zinc-500 mb-1">Res. local</p>
                <input type="number" value={preview.resultadoLocal} onChange={(e) => setPreview({ ...preview, resultadoLocal: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-zinc-500 mb-1">Res. visitante</p>
                <input type="number" value={preview.resultadoVisitante} onChange={(e) => setPreview({ ...preview, resultadoVisitante: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs text-zinc-500 mb-1">¿Cuál de los dos somos nosotros? (para el Dashboard)</p>
            <select value={preview.equipoPropio || ""} onChange={(e) => {
              const value = e.target.value || null;
              setPreview((prev) => ({
                ...prev,
                equipoPropio: value,
                // Si este lado pasa a ser "nosotros", se limpia cualquier vinculo con Scouting Hub
                // que hubiera quedado de antes -- el propio club no es un "rival" para vincular.
                equipoLocalRivalId: value === "LOCAL" ? "" : prev.equipoLocalRivalId,
                equipoVisitanteRivalId: value === "VISITANTE" ? "" : prev.equipoVisitanteRivalId,
              }));
            }}
              className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
              <option value="">No se detectó — elegir</option>
              <option value="LOCAL">Local ({preview.equipoLocal})</option>
              <option value="VISITANTE">Visitante ({preview.equipoVisitante})</option>
            </select>
          </div>

          <div className="border-t border-zinc-800 pt-3 mb-5">
            <h3 className="text-sm font-bold text-blue-300 mb-2">Equipo Local{preview.equipoPropio === "LOCAL" ? " (nosotros)" : ""}</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              <input value={preview.equipoLocal} onChange={(e) => setPreview({ ...preview, equipoLocal: e.target.value })}
                className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
              {preview.equipoPropio !== "LOCAL" && (
                <select value={preview.equipoLocalRivalId} onChange={(e) => {
                  const value = e.target.value;
                  setPreview((prev) => ({ ...prev, equipoLocalRivalId: value }));
                  if (value) persistAliasEquipo(preview.equipoLocal, value);
                }}
                  className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100">
                  <option value="">Vincular equipo (Scouting Hub)…</option>
                  {equiposRivalesFiltrados.map((eq) => <option key={eq.id} value={eq.id}>{eq.nombre_club}</option>)}
                </select>
              )}
            </div>
            <StatsPreviewTable label="Jugadores" rows={preview.jugadoresLocal} jugadoresPropios={preview.equipoPropio === "LOCAL" ? jugadoresPropiosDelEquipo : []} jugadoresRivales={jugadoresRivalesLocal} equipoRivalId={preview.equipoLocalRivalId}
              onChangeField={(idx, field, value) => updateField("local", idx, field, value)}
              onLinkChange={(idx, value) => updateLink("local", idx, value)} />
            <EquipoTotalsRow label={preview.equipoLocal} totales={preview.totalesLocal} onChange={(field, value) => updateTotales("local", field, value)} />
          </div>

          <div className="border-t border-zinc-800 pt-3 mb-5">
            <h3 className="text-sm font-bold text-zinc-300 mb-2">Equipo Visitante{preview.equipoPropio === "VISITANTE" ? " (nosotros)" : ""}</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              <input value={preview.equipoVisitante} onChange={(e) => setPreview({ ...preview, equipoVisitante: e.target.value })}
                className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
              {preview.equipoPropio !== "VISITANTE" && (
                <select value={preview.equipoVisitanteRivalId} onChange={(e) => {
                  const value = e.target.value;
                  setPreview((prev) => ({ ...prev, equipoVisitanteRivalId: value }));
                  if (value) persistAliasEquipo(preview.equipoVisitante, value);
                }}
                  className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100">
                  <option value="">Vincular equipo (Scouting Hub)…</option>
                  {equiposRivalesFiltrados.map((eq) => <option key={eq.id} value={eq.id}>{eq.nombre_club}</option>)}
                </select>
              )}
            </div>
            <StatsPreviewTable label="Jugadores" rows={preview.jugadoresVisitante} jugadoresPropios={preview.equipoPropio === "VISITANTE" ? jugadoresPropiosDelEquipo : []} jugadoresRivales={jugadoresRivalesVisitante} equipoRivalId={preview.equipoVisitanteRivalId}
              onChangeField={(idx, field, value) => updateField("visitante", idx, field, value)}
              onLinkChange={(idx, value) => updateLink("visitante", idx, value)} />
            <EquipoTotalsRow label={preview.equipoVisitante} totales={preview.totalesVisitante} onChange={(field, value) => updateTotales("visitante", field, value)} />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={recalcularMetricas} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm px-3 py-1.5 rounded">
              Recalcular métricas
            </button>
            <button onClick={guardar} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded">
              {saving ? "Guardando…" : preview.id ? "Guardar cambios" : "Guardar estadísticas"}
            </button>
            <button onClick={() => setPreview(null)} className="text-zinc-400 text-sm px-3 py-1.5">{preview.id ? "Cancelar edición" : "Descartar"}</button>
            {saveMsg && <span className={saveMsg.startsWith("Error") ? "text-red-400 text-xs" : "text-emerald-400 text-xs"}>{saveMsg}</span>}
          </div>
        </div>
      )}

      <Section icon={Trophy} title="Partidos cargados" accent="text-blue-400">
        {loadingHistorial ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : historialMostrado.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {verSinAsignar ? "No hay partidos sin temporada asignada." : "Todavía no cargaste ningún partido para esta temporada."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {historialMostrado.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 flex-wrap">
                <span className="text-xs text-zinc-500 w-24 shrink-0">{p.fecha}</span>
                <span className="text-sm text-zinc-200 flex-1 truncate">
                  {p.equipo_local} {p.resultado_local ?? "-"} vs {p.resultado_visitante ?? "-"} {p.equipo_visitante}
                </span>
                {p.categoria && <Chip>{p.categoria}</Chip>}
                {verSinAsignar && !soloLectura && (
                  <AsignarMatrizPartido partido={p} temporadas={temporadas} defaultTemporadaId={temporadaId} onAsignar={asignarTemporadaPartido} />
                )}
                {puedeEditar && (
                  <>
                    <button onClick={() => editarPartido(p)} title="Editar partido" className="text-zinc-600 hover:text-cyan-400 p-1"><PenLine size={13} /></button>
                    <button onClick={() => eliminarPartido(p.id)} title="Eliminar" className="text-zinc-600 hover:text-red-400 p-1"><Trash2 size={13} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {showNuevaTemporada && (
        <NuevaTemporadaModal
          categoria={categoria}
          tira={tira}
          temporadaActivaActual={temporadasDelEquipo.find((t) => t.activa) || null}
          onCancel={() => setShowNuevaTemporada(false)}
          onCreada={async (nuevaId) => {
            await refrescarTemporadas();
            setTemporadaId(nuevaId);
            setShowNuevaTemporada(false);
          }}
        />
      )}
    </div>
  );
}

// Podio de 3 de una metrica del ultimo partido (sin emojis, solo numero + nombre + valor).
function PodioMini({ titulo, filas, campo, formato }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-1.5">{titulo}</p>
      {filas.length === 0 ? (
        <p className="text-xs text-zinc-600">-</p>
      ) : (
        <div className="space-y-1">
          {filas.map((f, i) => (
            <div key={f.id}>
              <p className="text-xs text-zinc-200 truncate">{i + 1}. {f.nombre_jugador}</p>
              <p className="text-xs text-zinc-500">{formato ? formato(f[campo]) : f[campo] ?? "-"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Tile de una metrica del Panel de Rendimiento Colectivo (mismo lenguaje visual que VolTile,
// con soporte de sufijo "%" y color por tono -- good/bad/brand son deltas de significado, no de
// marca, mismo criterio que el semaforo de RPE/disponibilidad.
function StatTile({ value, label, decimales = 0, suf = "", tone, className = "" }) {
  const v = Number(value) || 0;
  const toneCls = tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : tone === "brand" ? "text-brand-300" : "text-zinc-100";
  return (
    <div className={`bg-zinc-950/40 border border-zinc-800 rounded-lg py-2.5 px-2 text-center ${className}`}>
      <p className={`text-lg font-extrabold ${toneCls}`}>{v.toFixed(decimales)}{suf}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

// Panel de Rendimiento Colectivo: salud tactica del equipo en la temporada activa, calculado en
// el cliente sobre partidos_stats + equipo_partido_stats (sin vistas SQL nuevas, mismo criterio
// que AnaliticaComparada360). Por cada partido con equipo_propio definido, la fila de
// equipo_partido_stats cuya "condicion" coincide con equipo_propio es "nosotros"; la otra es el
// rival de ese partido puntual (de ahi salen PTS Contra y RO Rival).
function PanelRendimientoColectivo({ temporadaId, temporadaSeleccionada }) {
  const [rc, setRc] = useState(null); // null = cargando, false = sin datos
  const [splitOpen, setSplitOpen] = useState(false);

  useEffect(() => {
    if (!temporadaId) { setRc(false); return; }
    let cancelled = false;
    setRc(null);
    (async () => {
      const { data: partidos, error: errP } = await supabase
        .from("partidos_stats").select("id, equipo_propio")
        .eq("temporada_id", temporadaId).not("equipo_propio", "is", null);
      if (cancelled) return;
      if (errP || !partidos || partidos.length === 0) { setRc(false); return; }

      const ids = partidos.map((p) => p.id);
      const { data: filas, error: errF } = await supabase.from("equipo_partido_stats").select("*").in("partido_id", ids);
      if (cancelled) return;
      if (errF || !filas) { setRc(false); return; }

      const propioPorPartido = Object.fromEntries(partidos.map((p) => [p.id, p.equipo_propio]));
      const propias = filas.filter((f) => f.condicion === propioPorPartido[f.partido_id]);
      const rivales = filas.filter((f) => f.condicion !== propioPorPartido[f.partido_id]);
      if (propias.length === 0) { setRc(false); return; }

      const sum = (arr, k) => arr.reduce((s, f) => s + (Number(f[k]) || 0), 0);
      const pj = propias.length;
      const t2i = sum(propias, "t2i"), t3i = sum(propias, "t3i"), t1i = sum(propias, "t1i");
      const t2a = sum(propias, "t2a"), t3a = sum(propias, "t3a"), t1a = sum(propias, "t1a");
      const per = sum(propias, "per");
      const play = t2i + t3i + 0.44 * t1i + per;
      const pts = sum(propias, "pts");
      const ast = sum(propias, "ast");
      const madeFg = t2a + t3a;

      const promPtsDe = (idsCondicion) => {
        const prop = propias.filter((f) => idsCondicion.has(f.partido_id));
        const riv = rivales.filter((f) => idsCondicion.has(f.partido_id));
        if (prop.length === 0) return null;
        return { favor: sum(prop, "pts") / prop.length, contra: sum(riv, "pts") / prop.length };
      };
      const localIds = new Set(partidos.filter((p) => p.equipo_propio === "LOCAL").map((p) => p.id));
      const visitIds = new Set(partidos.filter((p) => p.equipo_propio === "VISITANTE").map((p) => p.id));

      setRc({
        pj,
        pts: {
          general: { favor: pts / pj, contra: sum(rivales, "pts") / pj },
          local: promPtsDe(localIds),
          visitante: promPtsDe(visitIds),
        },
        eficiencia: {
          efgPct: (t2i + t3i) ? ((t2a + 1.5 * t3a) / (t2i + t3i)) * 100 : 0,
          playProm: play / pj,
          ppp: play ? pts / play : 0,
        },
        tiros: [
          { l: "T2", made: t2a / pj, att: t2i / pj, pct: t2i ? (t2a / t2i) * 100 : 0 },
          { l: "T3", made: t3a / pj, att: t3i / pj, pct: t3i ? (t3a / t3i) * 100 : 0 },
          { l: "TL", made: t1a / pj, att: t1i / pj, pct: t1i ? (t1a / t1i) * 100 : 0 },
        ],
        control: {
          rd: sum(propias, "rdef") / pj,
          ro: sum(propias, "rof") / pj,
          roRival: sum(rivales, "rof") / pj,
          ast: ast / pj,
          per: per / pj,
          pctAst: madeFg ? (ast / madeFg) * 100 : 0,
        },
      });
    })();
    return () => { cancelled = true; };
  }, [temporadaId]);

  return (
    <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 text-brand-400">
          <Target size={16} />
          <h3 className="text-xs font-bold uppercase tracking-widest">Rendimiento Colectivo</h3>
        </div>
        {temporadaSeleccionada && (
          <span className="text-[11px] text-zinc-500 text-right shrink-0">
            {temporadaSeleccionada.nombre_competencia} {temporadaSeleccionada.anio}
            {rc && <>{" · "}{rc.pj} PJ</>}
          </span>
        )}
      </div>
      <h2 className="text-lg font-bold text-zinc-100 mb-4">Salud táctica del equipo</h2>

      {rc === null ? (
        <p className="text-sm text-zinc-500">Cargando…</p>
      ) : rc === false ? (
        <p className="text-sm text-zinc-500">Todavía no hay partidos con el lado propio definido en esta temporada.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Puntos por partido</p>
            <div className="flex-1 h-px bg-zinc-800" />
            {rc.pts.local && rc.pts.visitante && (
              <button onClick={() => setSplitOpen((v) => !v)} className="text-[11px] font-semibold text-brand-300 border border-zinc-700 rounded-full px-2.5 py-1 hover:border-zinc-600 shrink-0">
                {splitOpen ? "Ocultar Local / Visitante" : "Local / Visitante"}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <StatTile value={rc.pts.general.favor} label="PTS Favor" tone="good" decimales={1} />
            <StatTile value={rc.pts.general.contra} label="PTS Contra" tone="bad" decimales={1} />
          </div>
          {splitOpen && rc.pts.local && rc.pts.visitante && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              <StatTile value={rc.pts.local.favor} label="Favor · Local" tone="good" decimales={1} />
              <StatTile value={rc.pts.local.contra} label="Contra · Local" tone="bad" decimales={1} />
              <StatTile value={rc.pts.visitante.favor} label="Favor · Visit." tone="good" decimales={1} />
              <StatTile value={rc.pts.visitante.contra} label="Contra · Visit." tone="bad" decimales={1} />
            </div>
          )}

          <SeccionMini>Eficiencia de ejecución</SeccionMini>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <StatTile value={rc.eficiencia.efgPct} label="eFG%" suf="%" decimales={1} />
            <StatTile value={rc.eficiencia.playProm} label="Plays / partido" decimales={1} />
            <StatTile value={rc.eficiencia.ppp} label="PPP" decimales={2} />
          </div>

          <SeccionMini>Efectividad en tiros</SeccionMini>
          <div className="grid sm:grid-cols-3 gap-2 mb-4">
            {rc.tiros.map((t) => (
              <div key={t.l} className="bg-zinc-950/40 border border-zinc-800 rounded-lg px-3 py-2 flex items-center gap-2 sm:flex-col sm:gap-1.5 sm:py-3 sm:text-center">
                <span className="text-xs font-bold text-zinc-400 shrink-0 whitespace-nowrap sm:order-1 sm:text-[10px] sm:uppercase sm:tracking-wide">{t.l}</span>
                <span className="text-base font-extrabold shrink-0 whitespace-nowrap sm:order-2 sm:text-xl">{t.pct.toFixed(1)}%</span>
                <span className="flex-1 min-w-[16px] h-1.5 bg-zinc-800 rounded-full overflow-hidden sm:order-3 sm:w-full">
                  <span className="block h-full bg-gradient-to-r from-brand-500 to-brand-300 rounded-full" style={{ width: `${Math.min(100, t.pct)}%` }} />
                </span>
                <span className="text-xs text-zinc-500 shrink-0 whitespace-nowrap sm:order-4">{t.made.toFixed(1)}/{t.att.toFixed(1)}</span>
              </div>
            ))}
          </div>

          <SeccionMini>Batalla de posesiones y control</SeccionMini>
          <div className="flex flex-wrap gap-2">
            <StatTile value={rc.control.rd} label="RD" decimales={1} className="flex-1 min-w-[90px]" />
            <StatTile value={rc.control.ro} label="RO" decimales={1} className="flex-1 min-w-[90px]" />
            <StatTile value={rc.control.roRival} label="RO Rival" tone="bad" decimales={1} className="flex-1 min-w-[90px]" />
            <StatTile value={rc.control.ast} label="AST" tone="good" decimales={1} className="flex-1 min-w-[90px]" />
            <StatTile value={rc.control.per} label="PER" tone="bad" decimales={1} className="flex-1 min-w-[90px]" />
            <StatTile value={rc.control.pctAst} label="%AST" suf="%" tone="brand" decimales={1} className="flex-1 min-w-[90px]" />
          </div>
        </>
      )}
    </div>
  );
}

// Modulo "Inicio": dashboard que unifica lo mas urgente de cada modulo (Calendario, Plantel,
// Entrenamientos, Scouting, Estadisticas) en una sola pantalla. Todas las tarjetas -- agenda de
// hoy, RPE/asistencia/lesionados, proximo partido, lideres y tendencia -- se filtran por la
// misma matriz Categoria/Tira activa (proximo partido via "eventos", lideres/tendencia via
// partidos_stats.temporada_id resuelto por esa Categoria/Tira); el Panel de Rendimiento
// Colectivo tambien, via el mismo temporada_id.
function InicioView({ events, jugadores, equiposRivales, onSelectEvent }) {
  const { categoria, tira, setCategoria, setTira, temporadaId, temporadaSeleccionada } = useTeam();
  const hoy = todayKeyBA();

  const [notas, setNotas] = useState([]);
  const [loadingNotas, setLoadingNotas] = useState(true);
  const [notaNueva, setNotaNueva] = useState("");
  const [notaAbierta, setNotaAbierta] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingNotas(true);
    (async () => {
      const { data, error } = await supabase.from("notas_staff").select("*")
        .eq("resuelta", false).eq("categoria", categoria).eq("tira", tira)
        .order("created_at", { ascending: false });
      if (!cancelled && !error) setNotas(data);
      setLoadingNotas(false);
    })();
    return () => { cancelled = true; };
  }, [categoria, tira]);

  const agregarNota = async () => {
    const texto = notaNueva.trim();
    if (!texto) return;
    setNotaNueva("");
    const { data, error } = await supabase.from("notas_staff").insert({ texto, categoria, tira }).select().single();
    if (!error) setNotas((prev) => [data, ...prev]);
  };

  const resolverNota = async (id) => {
    setNotas((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notas_staff").update({ resuelta: true }).eq("id", id);
  };

  const [rpeProm, setRpeProm] = useState(null);
  const [asistenciaPct, setAsistenciaPct] = useState(null);
  const [loadingSemana, setLoadingSemana] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSemana(true);
      const desde = new Date();
      desde.setDate(desde.getDate() - 6);
      const desdeKey = desde.toISOString().slice(0, 10);

      const { data: entrenos, error: errEnt } = await supabase
        .from("eventos")
        .select("id")
        .eq("type", "entrenamiento")
        .eq("categoria", categoria)
        .eq("tira", tira)
        .gte("date", desdeKey)
        .lte("date", hoy);

      if (cancelled) return;
      if (errEnt || !entrenos || entrenos.length === 0) {
        setRpeProm(null);
        setAsistenciaPct(null);
        setLoadingSemana(false);
        return;
      }

      const { data: asis, error: errAsis } = await supabase
        .from("asistencias")
        .select("estado, rpe_valor")
        .in("entrenamiento_id", entrenos.map((e) => e.id));

      if (cancelled) return;
      if (!errAsis && asis) {
        const conRpe = asis.filter((a) => a.rpe_valor != null);
        setRpeProm(conRpe.length ? Math.round((conRpe.reduce((s, a) => s + a.rpe_valor, 0) / conRpe.length) * 10) / 10 : null);
        const presentes = asis.filter((a) => a.estado === "Presente").length;
        setAsistenciaPct(asis.length ? Math.round((presentes / asis.length) * 100) : null);
      }
      setLoadingSemana(false);
    })();
    return () => { cancelled = true; };
  }, [categoria, tira, hoy]);

  const [ultimoPartido, setUltimoPartido] = useState(null);
  const [lideres, setLideres] = useState({ puntos: [], eficiencia: [], rebotes: [] });
  const [tendencia, setTendencia] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!temporadaId) {
      setUltimoPartido(null);
      setLideres({ puntos: [], eficiencia: [], rebotes: [] });
      setTendencia([]);
      setLoadingStats(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingStats(true);
      const { data: ultimo } = await supabase.from("partidos_stats").select("*").eq("temporada_id", temporadaId).order("fecha", { ascending: false }).limit(1).maybeSingle();
      if (cancelled) return;
      setUltimoPartido(ultimo);

      if (ultimo?.equipo_propio) {
        const ladoPropio = ultimo.equipo_propio === "VISITANTE" ? ultimo.equipo_visitante : ultimo.equipo_local;
        const { data: filas } = await supabase.from("jugador_partido_stats").select("*").eq("partido_id", ultimo.id).eq("equipo", ladoPropio);
        if (!cancelled && filas) {
          setLideres({
            puntos: [...filas].sort((a, b) => b.pts - a.pts).slice(0, 3),
            eficiencia: [...filas].filter((f) => (f.t2i || 0) + (f.t3i || 0) > 0).sort((a, b) => (b.efg_pct || 0) - (a.efg_pct || 0)).slice(0, 3),
            rebotes: [...filas].sort((a, b) => b.rtot - a.rtot).slice(0, 3),
          });
        }
      } else {
        setLideres({ puntos: [], eficiencia: [], rebotes: [] });
      }

      const { data: ultimos3 } = await supabase.from("partidos_stats").select("*").eq("temporada_id", temporadaId).not("equipo_propio", "is", null).order("fecha", { ascending: false }).limit(3);
      if (!cancelled) {
        setTendencia(
          (ultimos3 || [])
            .map((p) => ({
              fecha: p.fecha,
              rival: p.equipo_propio === "LOCAL" ? p.equipo_visitante : p.equipo_local,
              favor: p.equipo_propio === "LOCAL" ? p.resultado_local : p.resultado_visitante,
              contra: p.equipo_propio === "LOCAL" ? p.resultado_visitante : p.resultado_local,
            }))
            .reverse()
        );
      }
      setLoadingStats(false);
    })();
    return () => { cancelled = true; };
  }, [temporadaId]);

  const lesionados = jugadores.filter((j) => jugadorEnEquipo(j, categoria, tira) && j.disponibilidad && j.disponibilidad !== "Disponible");

  const proximoPartido = events.filter((e) => e.type === "partido" && e.date >= hoy && e.categoria === categoria && e.tira === tira).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  const rivalProximo = proximoPartido ? equiposRivales.find((eq) => eq.id === proximoPartido.rival_id) : null;
  const diasParaPartido = proximoPartido ? Math.round((new Date(proximoPartido.date) - new Date(hoy)) / 86400000) : null;

  const en7dias = (() => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  const agenda = events
    .filter((e) => e.categoria === categoria && e.tira === tira && e.date >= hoy && e.date <= en7dias)
    .sort((a, b) => a.date.localeCompare(b.date));

  const entrenoHoy = events.find((e) => e.type === "entrenamiento" && e.categoria === categoria && e.tira === tira && e.date === hoy) || null;

  const semaforoRpe = (v) => (v == null ? "text-zinc-500" : v <= 3 ? "text-emerald-400" : v <= 6 ? "text-yellow-400" : v <= 8 ? "text-orange-400" : "text-red-400");

  return (
    <div className="max-w-6xl mx-auto text-zinc-100">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2 text-zinc-400">
          <Home size={18} />
          <span className="text-xs font-bold uppercase tracking-widest">Inicio</span>
        </div>
        <div className="flex gap-2">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={tira} onChange={(e) => setTira(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
            {TIRAS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* 1. Banner de cuenta regresiva */}
      <div className="bg-gradient-to-r from-brand-600/20 to-zinc-900 border border-brand-500/30 rounded-xl p-4 mb-6 flex items-center justify-between gap-3 flex-wrap">
        {proximoPartido ? (
          <>
            <div className="min-w-0">
              <p className="text-xs text-brand-300 font-bold uppercase tracking-wide mb-1">
                {diasParaPartido === 0 ? "Partido hoy" : diasParaPartido === 1 ? "Partido mañana" : `Faltan ${diasParaPartido} días`}
              </p>
              <p className="text-lg font-bold truncate">vs {rivalProximo?.nombre_club || proximoPartido.rival || "Rival a definir"}</p>
              <p className="text-sm text-zinc-400">
                {proximoPartido.date}
                {proximoPartido.horario ? ` · ${proximoPartido.horario}` : ""}
                {proximoPartido.condicion ? ` · ${proximoPartido.condicion}` : ""}
              </p>
            </div>
            <button onClick={() => onSelectEvent(proximoPartido)} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm px-3 py-2 rounded shrink-0">
              <Swords size={14} /> Ver informe táctico
            </button>
          </>
        ) : (
          <p className="text-sm text-zinc-400">No hay ningún partido próximo cargado en el calendario.</p>
        )}
      </div>

      {/* 2. Indicadores clave */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
          <p className="text-xs text-zinc-500 mb-1">RPE promedio semanal</p>
          <p className={`text-2xl font-bold ${semaforoRpe(rpeProm)}`}>{loadingSemana ? "…" : rpeProm ?? "-"}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
          <p className="text-xs text-zinc-500 mb-1">Lesionados / enfermería</p>
          <p className={`text-2xl font-bold ${lesionados.length > 0 ? "text-red-400" : "text-zinc-100"}`}>{lesionados.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
          <p className="text-xs text-zinc-500 mb-1">% Asistencia (última semana)</p>
          <p className="text-2xl font-bold text-zinc-100">{loadingSemana ? "…" : asistenciaPct != null ? `${asistenciaPct}%` : "-"}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
          <p className="text-xs text-zinc-500 mb-1.5 flex items-center gap-1"><MessageSquare size={12} /> Notas del staff</p>
          <div className="flex gap-1 mb-1.5">
            <input
              value={notaNueva}
              onChange={(e) => setNotaNueva(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") agregarNota(); }}
              placeholder="Nueva alerta…"
              className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100"
            />
            <button onClick={agregarNota} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2 rounded shrink-0"><Plus size={13} /></button>
          </div>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {loadingNotas ? (
              <p className="text-xs text-zinc-600">Cargando…</p>
            ) : notas.length === 0 ? (
              <p className="text-xs text-zinc-600">Sin alertas pendientes.</p>
            ) : (
              notas.map((n) => (
                <div key={n.id} className="flex items-center gap-1.5 text-xs text-zinc-300">
                  <button onClick={() => resolverNota(n.id)} title="Marcar resuelta" className="text-zinc-600 hover:text-emerald-400 shrink-0"><X size={11} /></button>
                  <button onClick={() => setNotaAbierta(n)} className="flex-1 min-w-0 truncate text-left hover:text-zinc-100">{n.texto}</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3. Bloque central: agenda 7 dias + cronograma de hoy */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 text-zinc-400">
            <Calendar size={16} />
            <h3 className="text-xs font-bold uppercase tracking-widest">Próximos 7 días — {categoria} · {tira}</h3>
          </div>
          {agenda.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay eventos programados para {categoria} · {tira} en los próximos 7 días.</p>
          ) : (
            <div className="space-y-1">
              {agenda.map((e) => {
                const st = TIPO_ESTILO[e.type];
                const clickable = e.type === "entrenamiento" || e.type === "individual" || e.type === "partido";
                const row = (
                  <>
                    <span className={`w-2 h-2 rounded-full ${st.dot} shrink-0`} />
                    <span className="text-xs text-zinc-500 w-16 shrink-0">{e.date}</span>
                    <span className={`text-sm ${st.text} truncate flex-1`}>{e.title}</span>
                  </>
                );
                return clickable ? (
                  <button key={e.id} onClick={() => onSelectEvent(e)} className="w-full flex items-center gap-2 text-left hover:bg-zinc-800/60 rounded px-1.5 py-1">
                    {row}
                  </button>
                ) : (
                  <div key={e.id} className="flex items-center gap-2 px-1.5 py-1">{row}</div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 text-cyan-400">
            <Clock size={16} />
            <h3 className="text-xs font-bold uppercase tracking-widest">Entrenamiento de hoy</h3>
          </div>
          {!entrenoHoy ? (
            <p className="text-sm text-zinc-500">No hay entrenamiento cargado hoy para {categoria} · {tira}.</p>
          ) : (
            <>
              <button onClick={() => onSelectEvent(entrenoHoy)} className="text-sm font-medium text-cyan-300 hover:text-cyan-200 mb-2 block truncate text-left">
                {entrenoHoy.title}
              </button>
              {(entrenoHoy.bloques || []).length === 0 ? (
                <p className="text-sm text-zinc-500">Todavía no tiene bloques cargados.</p>
              ) : (
                <div className="space-y-1.5">
                  {entrenoHoy.bloques.map((b) => (
                    <div key={b.id} className="flex gap-2 text-sm">
                      <span className="text-cyan-300 font-mono text-xs whitespace-nowrap w-16 shrink-0 pt-0.5">{b.inicio}–{b.fin}</span>
                      <span className="text-zinc-300 truncate">{b.titulo}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 4. Bloque inferior analitico: lideres del ultimo partido + tendencia */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 text-brand-400">
            <Trophy size={16} />
            <h3 className="text-xs font-bold uppercase tracking-widest">Líderes — último partido</h3>
          </div>
          {loadingStats ? (
            <p className="text-sm text-zinc-500">Cargando…</p>
          ) : !ultimoPartido ? (
            <p className="text-sm text-zinc-500">Todavía no hay partidos cargados en Estadísticas.</p>
          ) : !ultimoPartido.equipo_propio ? (
            <p className="text-sm text-amber-400">Este partido no tiene definido qué lado somos nosotros — corregilo en Estadísticas para ver los líderes.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <PodioMini titulo="Puntos" filas={lideres.puntos} campo="pts" />
              <PodioMini titulo="Eficiencia (eFG%)" filas={lideres.eficiencia} campo="efg_pct" formato={(v) => `${Math.round((v || 0) * 100)}%`} />
              <PodioMini titulo="Rebotes" filas={lideres.rebotes} campo="rtot" />
            </div>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 text-brand-400">
            <BarChart3 size={16} />
            <h3 className="text-xs font-bold uppercase tracking-widest">Tendencia — últimos 3 partidos</h3>
          </div>
          {loadingStats ? (
            <p className="text-sm text-zinc-500">Cargando…</p>
          ) : tendencia.length === 0 ? (
            <p className="text-sm text-zinc-500">Todavía no hay partidos con el lado propio definido.</p>
          ) : (
            <div className="space-y-2">
              {tendencia.map((t, i) => {
                const max = Math.max(t.favor || 0, t.contra || 0, 1);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-0.5 gap-2">
                      <span className="truncate">{t.fecha} vs {t.rival}</span>
                      <span className={`shrink-0 ${t.favor > t.contra ? "text-emerald-400" : "text-red-400"}`}>{t.favor ?? "-"} - {t.contra ?? "-"}</span>
                    </div>
                    <div className="flex gap-1 h-1.5">
                      <div className="bg-emerald-500 rounded" style={{ width: `${((t.favor || 0) / max) * 50}%` }} />
                      <div className="bg-red-500 rounded" style={{ width: `${((t.contra || 0) / max) * 50}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <PanelRendimientoColectivo temporadaId={temporadaId} temporadaSeleccionada={temporadaSeleccionada} />

      {notaAbierta && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setNotaAbierta(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto text-zinc-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm flex items-center gap-1.5"><MessageSquare size={14} /> Nota del staff</h3>
              <button onClick={() => setNotaAbierta(null)} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
            </div>
            <p className="text-sm text-zinc-200 whitespace-pre-wrap">{notaAbierta.texto}</p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { resolverNota(notaAbierta.id); setNotaAbierta(null); }}
                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-3 py-1.5 rounded"
              >
                <X size={12} /> Marcar resuelta
              </button>
              <button onClick={() => setNotaAbierta(null)} className="text-zinc-400 text-xs px-3 py-1.5">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const NAV_ITEMS = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "calendario", label: "Calendario", icon: Calendar },
  { id: "plantel", label: "Plantel", icon: Users },
  { id: "jugador360", label: "Jugador 360°", labelMobile: "360°", icon: Target },
  { id: "entrenamientos", label: "Entrenamientos", icon: Dumbbell },
  { id: "scouting", label: "Scouting", icon: Swords },
  { id: "estadisticas", label: "Estadísticas", icon: BarChart3 },
  { id: "configuracion", label: "Configuración", icon: Settings },
];

export default function App() {
  const { session, rol, loading: authLoading, signOut } = useAuth();
  const { temporadaId, temporadas } = useTeam();
  const navigate = useNavigate();
  const location = useLocation();

  const [events, setEvents] = useState([]);
  const [jugadores, setJugadores] = useState([]);
  const [equiposRivales, setEquiposRivales] = useState([]);
  const [active, setActive] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebarCollapsed") === "1"; } catch { return false; }
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // "inicio" vive en "/", el resto de las secciones son "/<id>" (ver rutaDeSeccion en permisos.js).
  const seccionActiva = location.pathname === "/" ? "inicio" : location.pathname.slice(1);
  const irASeccion = (id) => { setActive(null); navigate(rutaDeSeccion(id)); };
  const bottomNavRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem("sidebarCollapsed", sidebarCollapsed ? "1" : "0"); } catch {}
  }, [sidebarCollapsed]);

  // La bottom-nav de celular scrollea horizontal (ver mas abajo) -- si el tab activo queda
  // fuera de la parte visible, lo traemos a la vista solo, para que nunca "desaparezca".
  useEffect(() => {
    const el = bottomNavRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [seccionActiva]);

  useEffect(() => {
    if (!session) { setEvents([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("eventos").select("*").order("date", { ascending: true });
      if (cancelled) return;
      if (error) setErrorMsg(error.message);
      else setEvents(data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session]);

  // Trae el plantel ACTUAL de todo el club (la temporada activa de cada equipo, no una sola),
  // igual de amplio que el viejo "select * from jugadores" -- necesario para que jugadorEnEquipo()
  // seguir viendo, al mirar el equipo A, a jugadores cuyo equipo de origen es otro (B) pero que
  // tienen A en su equipos_adicionales (jugador que juega en dos categorias a la vez). Mirar una
  // temporada PASADA de un equipo puntual es un fetch aparte, propio de PlantelView (no reemplaza
  // este estado global, que alimenta Asistencia/RPE/Individual/Inicio con el presente).
  useEffect(() => {
    if (!session) { setJugadores([]); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("vista_plantel_temporada")
        .select("*")
        .eq("estado", "activo")
        .eq("temporada_activa", true)
        .order("nombre_apellido", { ascending: true });
      if (cancelled) return;
      if (!error) setJugadores(data);
    })();
    return () => { cancelled = true; };
  }, [session]);

  // Mismo criterio que "jugadores": trae los equipos rivales de la temporada ACTIVA de cada
  // equipo propio (todo el club, no solo el filtro actual), para que Estadisticas siga pudiendo
  // vincular un PDF con cualquier rival vigente sin importar que categoria/tira este seleccionada
  // en Scouting. Mirar una temporada pasada de un equipo puntual es un fetch aparte, de
  // ScoutingHubView, que no reemplaza este estado global.
  useEffect(() => {
    if (!session) { setEquiposRivales([]); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("vista_equipos_rivales_temporada")
        .select("*")
        .eq("temporada_activa", true)
        .order("nombre_club", { ascending: true });
      if (cancelled) return;
      if (!error) setEquiposRivales(data);
    })();
    return () => { cancelled = true; };
  }, [session]);

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

  const deleteEvent = async (id) => {
    const { error } = await supabase.from("eventos").delete().eq("id", id);
    if (error) { setErrorMsg(error.message); return; }
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setActive((prev) => (prev && prev.id === id ? null : prev));
  };

  // Duplica un evento completo (entrenamiento, con bloques/diagramas y prep. física incluidos)
  // para no tener que recrear una sesión parecida desde cero. Queda en el mismo día que el
  // original; el staff lo renombra/mueve de fecha desde el Calendario, igual que cualquier evento.
  const duplicateEvent = async (event) => {
    const { id, createdAt, updatedAt, ...rest } = event;
    const copy = { ...rest, title: rest.title + " (copia)", bloques: clonarBloques(rest.bloques || []) };
    const { data, error } = await supabase.from("eventos").insert(copy).select().single();
    if (error) { setErrorMsg(error.message); return; }
    setEvents((prev) => [...prev, data]);
    setActive(null);
  };

  // "jugadores" en el estado de React tiene la forma de vista_plantel_temporada (bio de
  // "jugadores" + membresia de "jugador_temporada" aplanadas en un solo objeto). Estos 3
  // helpers arman/actualizan esa forma a mano despues de cada insert/update, para no tener que
  // re-pedir la vista completa cada vez.
  const CAMPOS_TEMPORADA = ["dorsal", "equipos_adicionales", "estado"];

  const aplanarJugador = (jugadorRow, jtRow, temporadaRow) => ({
    id: jugadorRow.id,
    jugador_temporada_id: jtRow.id,
    nombre_apellido: jugadorRow.nombre_apellido,
    posicion: jugadorRow.posicion,
    posicion_secundaria: jugadorRow.posicion_secundaria,
    altura: jugadorRow.altura,
    peso: jugadorRow.peso,
    fecha_nacimiento: jugadorRow.fecha_nacimiento,
    notas_comentarios: jugadorRow.notas_comentarios,
    disponibilidad: jugadorRow.disponibilidad,
    lesion_detalle: jugadorRow.lesion_detalle,
    lesion_desde: jugadorRow.lesion_desde,
    evaluaciones_pfs: jugadorRow.evaluaciones_pfs,
    temporada_id: jtRow.temporada_id,
    nombre_competencia: temporadaRow?.nombre_competencia,
    anio: temporadaRow?.anio,
    temporada_activa: temporadaRow?.activa,
    categoria_origen: temporadaRow?.categoria,
    tira: temporadaRow?.tira,
    dorsal: jtRow.dorsal,
    estado: jtRow.estado,
    equipos_adicionales: jtRow.equipos_adicionales,
  });

  const addJugador = async (j) => {
    const temporadaDestino = temporadas.find((t) => t.categoria === j.categoria_origen && t.tira === j.tira && t.activa);
    if (!temporadaDestino) {
      setErrorMsg(`No hay una temporada activa para ${j.categoria_origen} · ${j.tira}. Creala primero desde Plantel.`);
      return;
    }
    const { dorsal, categoria_origen, tira, equipos_adicionales, ...bio } = j;
    const { data: jugadorRow, error: errJugador } = await supabase.from("jugadores").insert(bio).select().single();
    if (errJugador) { setErrorMsg(errJugador.message); return; }
    const { data: jtRow, error: errJt } = await supabase
      .from("jugador_temporada")
      .insert({ jugador_id: jugadorRow.id, temporada_id: temporadaDestino.id, dorsal: dorsal || null, equipos_adicionales: equipos_adicionales || [] })
      .select()
      .single();
    if (errJt) { setErrorMsg(errJt.message); return; }
    setJugadores((prev) => [...prev, aplanarJugador(jugadorRow, jtRow, temporadaDestino)]);
  };

  // "Eliminar" pasa a ser dar de baja de la temporada activa (no se borra a la persona ni su
  // historial): marca estado='baja' en jugador_temporada, y como el fetch de "jugadores" solo
  // trae estado='activo', alcanza con sacarlo del estado local.
  const deleteJugador = async (id) => {
    const actual = jugadores.find((j) => j.id === id);
    if (!actual) return;
    const { error } = await supabase.from("jugador_temporada").update({ estado: "baja" }).eq("id", actual.jugador_temporada_id);
    if (error) { setErrorMsg(error.message); return; }
    setJugadores((prev) => prev.filter((j) => j.id !== id));
  };

  const updateJugador = async (id, patch) => {
    const actual = jugadores.find((j) => j.id === id);
    if (!actual) return;

    const patchTemporada = {};
    const patchBio = {};
    Object.entries(patch).forEach(([key, value]) => {
      if (CAMPOS_TEMPORADA.includes(key)) patchTemporada[key] = value;
      else if (key !== "categoria_origen" && key !== "tira") patchBio[key] = value;
    });

    // Cambio de equipo (categoria_origen/tira, ej. una promocion): resolver la temporada activa
    // del equipo destino y mover ahi la fila de jugador_temporada -- no hace falta borrar/recrear.
    if (patch.categoria_origen !== undefined || patch.tira !== undefined) {
      const nuevaCategoria = patch.categoria_origen ?? actual.categoria_origen;
      const nuevaTira = patch.tira ?? actual.tira;
      const temporadaDestino = temporadas.find((t) => t.categoria === nuevaCategoria && t.tira === nuevaTira && t.activa);
      if (!temporadaDestino) {
        setErrorMsg(`No hay una temporada activa para ${nuevaCategoria} · ${nuevaTira}. Creala primero desde Plantel.`);
        return;
      }
      patchTemporada.temporada_id = temporadaDestino.id;
    }

    let jugadorRow = null;
    if (Object.keys(patchBio).length > 0) {
      const { data, error } = await supabase.from("jugadores").update(patchBio).eq("id", id).select().single();
      if (error) { setErrorMsg(error.message); return; }
      jugadorRow = data;
    }

    let jtRow = null;
    if (Object.keys(patchTemporada).length > 0) {
      const { data, error } = await supabase.from("jugador_temporada").update(patchTemporada).eq("id", actual.jugador_temporada_id).select().single();
      if (error) { setErrorMsg(error.message); return; }
      jtRow = data;
    }

    const temporadaRow = jtRow ? temporadas.find((t) => t.id === jtRow.temporada_id) : null;

    // El estado global de "jugadores" solo trae la temporada ACTIVA de cada equipo (ver el
    // fetch de arriba) -- si por algun motivo la fila termino apuntando a una temporada que no
    // es la activa de su equipo, no corresponde que siga en esta lista.
    if (jtRow && temporadaRow && !temporadaRow.activa) {
      setJugadores((prev) => prev.filter((j) => j.id !== id));
      return;
    }

    setJugadores((prev) => prev.map((j) => {
      if (j.id !== id) return j;
      // jugadorRow trae TODAS las columnas de "jugadores", incluidas las viejas
      // categoria_origen/tira/dorsal/equipos_adicionales que quedaron sin uso desde que se
      // movieron a jugador_temporada (ver seccion "Temporadas" en CLAUDE.md) -- nunca hay que
      // pisar con esos valores stale lo que ya resolvio vista_plantel_temporada, o el jugador
      // deja de matchear el filtro de Categoria/Tira y desaparece del Plantel.
      let next = jugadorRow ? (() => {
        const { categoria_origen, tira, dorsal, equipos_adicionales, ...bioLimpio } = jugadorRow;
        return { ...j, ...bioLimpio };
      })() : { ...j };
      if (jtRow) {
        next = { ...next, dorsal: jtRow.dorsal, estado: jtRow.estado, equipos_adicionales: jtRow.equipos_adicionales, temporada_id: jtRow.temporada_id };
        if (temporadaRow) {
          next.categoria_origen = temporadaRow.categoria;
          next.tira = temporadaRow.tira;
          next.nombre_competencia = temporadaRow.nombre_competencia;
          next.anio = temporadaRow.anio;
          next.temporada_activa = temporadaRow.activa;
        }
      }
      return next;
    }));
  };

  // Vuelve a poner activo a un jugador dado de baja (usado desde el toggle "Ver dados de baja"
  // de PlantelView). jugadorTemporadaId es el id de la fila de jugador_temporada, no el del
  // jugador -- PlantelView lo trae directo de su propio fetch de dados de baja.
  const reactivarJugador = async (jugadorTemporadaId) => {
    const { error } = await supabase.from("jugador_temporada").update({ estado: "activo" }).eq("id", jugadorTemporadaId);
    if (error) { setErrorMsg(error.message); return; }
    const { data, error: errFetch } = await supabase
      .from("vista_plantel_temporada")
      .select("*")
      .eq("jugador_temporada_id", jugadorTemporadaId)
      .single();
    if (!errFetch && data) setJugadores((prev) => [...prev, data]);
  };

  const importJugadores = (nuevos, actualizados) => {
    const porId = Object.fromEntries((actualizados || []).map((a) => [a.id, a]));
    setJugadores((prev) => [...prev.map((j) => porId[j.id] || j), ...nuevos]);
  };

  // "equiposRivales" en el estado de React tiene la forma de vista_equipos_rivales_temporada
  // (bio de equipos_rivales + categoria/tira/nombre_competencia/anio derivados de la temporada
  // vinculada, aplanados en un solo objeto) -- mismo patron que aplanarJugador.
  const aplanarEquipoRival = (equipoRow, temporadaRow) => ({
    id: equipoRow.id,
    nombre_club: equipoRow.nombre_club,
    logo_url: equipoRow.logo_url,
    notas_colectivas: equipoRow.notas_colectivas,
    video_colectivo_url: equipoRow.video_colectivo_url,
    id_estadistico_externo: equipoRow.id_estadistico_externo,
    temporada_id: temporadaRow?.id ?? null,
    nombre_competencia: temporadaRow?.nombre_competencia,
    anio: temporadaRow?.anio,
    temporada_activa: temporadaRow?.activa,
    categoria: temporadaRow?.categoria,
    tira: temporadaRow?.tira,
  });

  const addEquipoRival = async (eq) => {
    const { categoria, tira, ...bio } = eq;
    let temporadaDestino = null;
    if (categoria && tira) {
      temporadaDestino = temporadas.find((t) => t.categoria === categoria && t.tira === tira && t.activa);
      if (!temporadaDestino) {
        setErrorMsg(`No hay una temporada activa para ${categoria} · ${tira}. Creala primero desde Plantel o Scouting.`);
        return;
      }
    }
    const { data, error } = await supabase.from("equipos_rivales").insert({ ...bio, temporada_id: temporadaDestino?.id ?? null }).select().single();
    if (error) { setErrorMsg(error.message); return; }
    setEquiposRivales((prev) => [...prev, aplanarEquipoRival(data, temporadaDestino)]);
  };

  const updateEquipoRival = async (id, patch) => {
    const actual = equiposRivales.find((e) => e.id === id);
    if (!actual) return;

    const { categoria, tira, ...bio } = patch;
    let temporadaId;
    if (categoria !== undefined || tira !== undefined) {
      const nuevaCategoria = categoria ?? actual.categoria;
      const nuevaTira = tira ?? actual.tira;
      const temporadaDestino = temporadas.find((t) => t.categoria === nuevaCategoria && t.tira === nuevaTira && t.activa);
      if (!temporadaDestino) {
        setErrorMsg(`No hay una temporada activa para ${nuevaCategoria} · ${nuevaTira}. Creala primero desde Plantel o Scouting.`);
        return;
      }
      temporadaId = temporadaDestino.id;
    }

    const payload = temporadaId !== undefined ? { ...bio, temporada_id: temporadaId } : bio;
    const { data, error } = await supabase.from("equipos_rivales").update(payload).eq("id", id).select().single();
    if (error) { setErrorMsg(error.message); return; }

    const temporadaRow = temporadas.find((t) => t.id === data.temporada_id) || null;
    if (temporadaRow && !temporadaRow.activa) {
      setEquiposRivales((prev) => prev.filter((e) => e.id !== id));
      return;
    }
    setEquiposRivales((prev) => prev.map((e) => (e.id === id ? aplanarEquipoRival(data, temporadaRow) : e)));
  };

  const deleteEquipoRival = async (id) => {
    const { error } = await supabase.from("equipos_rivales").delete().eq("id", id);
    if (error) { setErrorMsg(error.message); return; }
    setEquiposRivales((prev) => prev.filter((e) => e.id !== id));
  };

  if (location.pathname === "/login") {
    return <LoginView />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-500 text-sm">
        Cargando…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const navItemsVisibles = NAV_ITEMS.filter((item) => puedeVerSeccion(rol, item.id));
  const soloLecturaGeneral = !esStaffCompleto(rol);

  return (
    <div className="bg-zinc-950 min-h-screen font-sans md:flex">
      {/* Sidebar fija — solo escritorio, colapsable a solo íconos */}
      <aside className={`hidden md:flex md:flex-col md:shrink-0 bg-zinc-900 border-r border-zinc-800 min-h-screen p-4 transition-all duration-200 ${sidebarCollapsed ? "md:w-[72px]" : "md:w-56"}`}>
        <div className={`flex items-center gap-2 mb-8 px-1 ${sidebarCollapsed ? "justify-center" : ""}`}>
          <img src="/escudo-hacoaj.png" alt="Náutico Hacoaj" className="h-9 w-auto shrink-0" />
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-zinc-100 leading-tight truncate">Náutico Hacoaj</p>
              <p className="text-xs text-zinc-500">Staff Básquet</p>
            </div>
          )}
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {navItemsVisibles.map((item) => {
            const Icon = item.icon;
            const isActive = !active && seccionActiva === item.id;
            return (
              <button
                key={item.id}
                onClick={() => irASeccion(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${sidebarCollapsed ? "justify-center px-0" : ""} ${
                  isActive ? "bg-brand-500/15 text-brand-300" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                <Icon size={18} />
                {!sidebarCollapsed && item.label}
              </button>
            );
          })}
        </nav>
        {!sidebarCollapsed && <p className="px-3 mb-1 text-[11px] text-zinc-600 truncate">{ROL_LABELS[rol] ?? rol}</p>}
        <button
          onClick={signOut}
          title={sidebarCollapsed ? "Cerrar sesión" : undefined}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:bg-zinc-800 hover:text-red-400 ${sidebarCollapsed ? "justify-center px-0" : ""}`}
        >
          <LogOut size={14} /> {!sidebarCollapsed && "Cerrar sesión"}
        </button>
        <button
          onClick={() => setSidebarCollapsed((v) => !v)}
          title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 ${sidebarCollapsed ? "justify-center px-0" : ""}`}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : (<><ChevronLeft size={16} /> Colapsar</>)}
        </button>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 pb-24 md:pb-6">
        <div className="md:hidden flex items-center gap-2 mb-4">
          <img src="/escudo-hacoaj.png" alt="Náutico Hacoaj" className="h-8 w-auto" />
          <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Náutico Hacoaj · Staff Básquet</span>
        </div>

        {errorMsg && (
          <div className="max-w-3xl mx-auto mb-4 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-3 py-2">
            Error de conexión con Supabase: {errorMsg}
          </div>
        )}

        {!active && (
          loading ? (
            <p className="max-w-3xl mx-auto text-zinc-500 text-sm">Cargando eventos…</p>
          ) : (
            <Routes>
              <Route path="/" element={
                <ProtectedRoute seccionId="inicio">
                  <InicioView events={events} jugadores={jugadores} equiposRivales={equiposRivales} onSelectEvent={setActive} rol={rol} />
                </ProtectedRoute>
              } />
              <Route path="/calendario" element={
                <ProtectedRoute seccionId="calendario">
                  <CalendarView
                    events={events}
                    equiposRivales={equiposRivales}
                    onSelectEvent={setActive}
                    onAddEvent={addEvent}
                    onDeleteEvent={deleteEvent}
                    onMoveEvent={(id, date) => updateEvent(id, { date })}
                    onRenameEvent={(id, title) => updateEvent(id, { title })}
                    onDuplicateEvent={duplicateEvent}
                    rol={rol}
                  />
                </ProtectedRoute>
              } />
              <Route path="/plantel" element={
                <ProtectedRoute seccionId="plantel">
                  <PlantelView jugadores={jugadores} onAddJugador={addJugador} onDeleteJugador={deleteJugador} onUpdateJugador={updateJugador} onImportJugadores={importJugadores} onReactivarJugador={reactivarJugador} rol={rol} />
                </ProtectedRoute>
              } />
              <Route path="/jugador360" element={
                <ProtectedRoute seccionId="jugador360">
                  <Jugador360View jugadores={jugadores} />
                </ProtectedRoute>
              } />
              <Route path="/entrenamientos" element={
                <ProtectedRoute seccionId="entrenamientos">
                  <EntrenamientosView events={events} onSelectEvent={setActive} />
                </ProtectedRoute>
              } />
              <Route path="/scouting" element={
                <ProtectedRoute seccionId="scouting">
                  <ScoutingHubView equiposRivales={equiposRivales} onAddEquipo={addEquipoRival} onUpdateEquipo={updateEquipoRival} onDeleteEquipo={deleteEquipoRival} soloLectura={soloLecturaGeneral} rol={rol} />
                </ProtectedRoute>
              } />
              <Route path="/estadisticas" element={
                <ProtectedRoute seccionId="estadisticas">
                  <EstadisticasView jugadores={jugadores} equiposRivales={equiposRivales} soloLectura={soloLecturaGeneral} />
                </ProtectedRoute>
              } />
              <Route path="/configuracion" element={
                <ProtectedRoute seccionId="configuracion">
                  <ConfiguracionView />
                </ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to={rutaDeSeccion(seccionInicialDe(rol))} replace />} />
            </Routes>
          )
        )}
        {active?.type === "entrenamiento" && (
          <EntrenamientoView event={active} jugadores={jugadores} rol={rol} onBack={() => setActive(null)} onUpdate={(patch) => updateEvent(active.id, patch)} onDelete={() => { deleteEvent(active.id); setActive(null); }} onDuplicate={() => duplicateEvent(active)} />
        )}
        {active?.type === "individual" && (
          <IndividualView event={active} jugadores={jugadores} rol={rol} onBack={() => setActive(null)} onUpdate={(patch) => updateEvent(active.id, patch)} onDelete={() => { deleteEvent(active.id); setActive(null); }} />
        )}
        {active?.type === "partido" && (
          <PartidoView event={active} equiposRivales={equiposRivales} rol={rol} onBack={() => setActive(null)} onUpdate={(patch) => updateEvent(active.id, patch)} onDelete={() => { deleteEvent(active.id); setActive(null); }} />
        )}
      </main>

      {/* Bottom nav fija — solo celular. Con muchas secciones no entran todas repartiendo el
          ancho a partes iguales (los labels se pisan) -- cada item tiene un ancho fijo y la
          barra scrollea horizontal en vez de comprimirse; el tab activo se autoscrollea a la
          vista al navegar, para que nunca quede fuera de pantalla sin avisar. */}
      <nav
        ref={bottomNavRef}
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-900 border-t border-zinc-800 flex items-stretch overflow-x-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {navItemsVisibles.map((item) => {
          const Icon = item.icon;
          const isActive = !active && seccionActiva === item.id;
          return (
            <button
              key={item.id}
              data-active={isActive}
              onClick={() => irASeccion(item.id)}
              className={`w-[72px] shrink-0 flex flex-col items-center justify-center gap-1 py-2.5 ${isActive ? "text-brand-300" : "text-zinc-500"}`}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium leading-tight text-center">{item.labelMobile || item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
