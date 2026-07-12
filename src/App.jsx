import React, { useState, useRef, useEffect, useId } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Calendar, ChevronLeft, ChevronRight, X, Plus, Users, Shield, Swords, Dumbbell, Trophy, Clock, MapPin, ArrowLeft, Tag, Youtube, PenLine, Eraser, Trash2, CalendarClock, MessageSquare, BarChart3, Upload, Copy, Home, LogOut } from "lucide-react";
import { supabase } from "./supabaseClient";
import { parseCabbPdf, computeAdvancedStats, round3, normalizeName, detectarEquipoPropio } from "./pdfStats";
import { CATEGORIAS, TIRAS, POSICIONES } from "./constants";
import ImportadorCSVPropio from "./ImportadorCSVPropio";
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

function CourtDiagram({ initial, onSave, onCancel }) {
  const [courtType, setCourtType] = useState(initial?.courtType || "half");
  const [players, setPlayers] = useState(initial?.players || []);
  const [lines, setLines] = useState(initial?.lines || []);
  const [ball, setBall] = useState(initial?.ball || null);
  const [shots, setShots] = useState(initial?.shots || []);
  const [shotDraft, setShotDraft] = useState(null);
  const [tool, setTool] = useState("ataque");
  const [drawingPath, setDrawingPath] = useState(null);
  const [previewPt, setPreviewPt] = useState(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const offCount = useRef((initial?.players || []).filter((p) => p.team === "off").reduce((m, p) => Math.max(m, p.num), 0));
  const defCount = useRef((initial?.players || []).filter((p) => p.team === "def").reduce((m, p) => Math.max(m, p.num), 0));
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
            className={`px-2 py-1 rounded text-xs border ${tool === t.id ? "bg-brand-500/20 border-brand-500/50 text-brand-300" : "bg-zinc-900 border-zinc-700 text-zinc-400"}`}>
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
      <p className="hidden sm:block text-xs text-zinc-600 mt-1">
        Mové, agregá jugadores o balón tocando la cancha. Para Pase/Dribbling/Corte/Cortina: cada clic agrega un punto y quiebra la trayectoria — doble clic o "Finalizar trazo" para terminar. Pase = punteada · Dribbling = zigzag · Corte = sólida con flecha · Cortina = sólida con T · Lanzamiento = símbolo fijo, primer clic ubica, segundo clic define la dirección.
      </p>
      <div className="flex gap-2 mt-2">
        <button onClick={() => onSave({ courtType, players, lines, ball, shots })} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded">
          Guardar cancha
        </button>
        <button onClick={onCancel} className="text-zinc-400 text-xs px-3 py-1.5">Cancelar</button>
      </div>
    </div>
  );
}

// Render de solo lectura de una cancha ya guardada (miniatura dentro de la lista de un bloque).
function CourtPreview({ courtType, players = [], lines = [], ball, shots = [] }) {
  const markerId = useId();
  const vbW = 150, vbH = courtType === "half" ? 140 : 280;
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
          <circle cx={p.x} cy={p.y} r="6" fill={p.team === "off" ? "#3b82f6" : "#18181b"} stroke={p.team === "off" ? "#93c5fd" : "#ef4444"} strokeWidth="1.5" />
          <text x={p.x} y={p.y + 2.5} textAnchor="middle" fontSize="6.5" fontWeight="bold" fill={p.team === "off" ? "#ffffff" : "#ef4444"}>
            {p.team === "def" ? "X" + p.num : p.num}
          </text>
        </g>
      ))}
      {ball && <BallIcon x={ball.x} y={ball.y} r={4} />}
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

  const addBloque = () => {
    if (!form.titulo) return;
    onChange([...bloques, { id: "b" + Date.now(), ...form }]);
    setForm({ inicio: "", fin: "", titulo: "", desc: "" });
    setShowForm(false);
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
              <div className="flex gap-3">
                <div className="text-cyan-300 text-xs font-mono whitespace-nowrap pt-0.5 w-16 shrink-0">{b.inicio}–{b.fin}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{b.titulo}</p>
                      <p className="text-sm text-zinc-400 mt-0.5">{b.desc}</p>
                    </div>
                    {!soloLectura && (
                      <button onClick={() => duplicateBloque(b.id)} title="Duplicar bloque" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-cyan-400 shrink-0">
                        <Copy size={13} /> Duplicar
                      </button>
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

function EntrenamientoView({ event, onBack, onUpdate, onDelete, jugadores, rol }) {
  const [bloques, setBloques] = useState(event.bloques || []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [objetivoSemana, setObjetivoSemana] = useState(event.objetivoSemana || "");

  const headerSoloLectura = nivelBloque(rol, "entrenamiento", "header") !== "rw";
  const prepFisicaSoloLectura = nivelBloque(rol, "entrenamiento", "preparacionFisica") !== "rw";
  const bloquesSoloLectura = nivelBloque(rol, "entrenamiento", "bloquesCancha") !== "rw";

  return (
    <div className="max-w-2xl mx-auto text-zinc-100">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm">
          <ArrowLeft size={15} /> Volver al calendario
        </button>
        {!headerSoloLectura && (
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-zinc-500 hover:text-red-400 text-xs">
            <Trash2 size={13} /> Eliminar evento
          </button>
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
      <div className="flex items-center justify-between mb-4">
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
      <div className="flex items-center justify-between mb-4">
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
                  <span className="text-zinc-500 text-xs ml-auto">{j.posicion}{j.categoria ? ` · ${j.categoria}` : ""}</span>
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

function CalendarView({ events, equiposRivales, onSelectEvent, onAddEvent, onDeleteEvent, onMoveEvent, onRenameEvent, rol }) {
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
                      className={`flex-1 text-left px-2 py-2 flex items-center gap-2 ${clickable ? "hover:text-zinc-200 cursor-pointer" : "cursor-default"}`}>
                      <span className={`w-2 h-2 rounded-full ${st.dot} shrink-0`} />
                      <span className={`text-sm ${st.text}`}>{e.title}</span>
                      {e.type === "partido" && <MapPin size={12} className="text-zinc-500 ml-auto" />}
                    </button>
                    {puedeEditarEventos && (
                      <>
                        <button onClick={() => { setRenameTarget(isRenaming ? null : e.id); setRenameValue(e.title); }} title="Editar nombre" className="text-zinc-500 hover:text-blue-400 p-1.5 shrink-0">
                          <PenLine size={14} />
                        </button>
                        <button onClick={() => { setMoveTarget(isMoving ? null : e.id); setMoveDate(e.date); }} title="Cambiar de día" className="text-zinc-500 hover:text-blue-400 p-1.5 shrink-0">
                          <CalendarClock size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(e)} title="Eliminar evento" className="text-zinc-500 hover:text-red-400 p-1.5 shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                  {isRenaming && (
                    <div className="flex items-center gap-2 px-3 pb-2">
                      <input value={renameValue} onChange={(ev) => setRenameValue(ev.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100" />
                      <button onClick={() => { if (renameValue.trim()) { onRenameEvent(e.id, renameValue.trim()); setRenameTarget(null); } }} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-1 rounded">Guardar</button>
                      <button onClick={() => setRenameTarget(null)} className="text-zinc-400 text-xs px-2 py-1">Cancelar</button>
                    </div>
                  )}
                  {isMoving && (
                    <div className="flex items-center gap-2 px-3 pb-2">
                      <input type="date" value={moveDate} onChange={(ev) => setMoveDate(ev.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100" />
                      <button onClick={() => { onMoveEvent(e.id, moveDate); setMoveTarget(null); }} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-1 rounded">Guardar</button>
                      <button onClick={() => setMoveTarget(null)} className="text-zinc-400 text-xs px-2 py-1">Cancelar</button>
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

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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
      altura: form.altura ? Number(form.altura) : null,
      peso: form.peso ? Number(form.peso) : null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      categoria_origen: form.categoria_origen,
      tira: form.tira,
      notas_comentarios: form.notas_comentarios,
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
          {!soloCamposMedicos && (
            <>
              <div className="flex gap-2">
                <input placeholder="Dorsal" type="number" value={form.dorsal} onChange={(e) => set("dorsal", e.target.value)} className="w-20 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
                <input placeholder="Nombre y apellido" value={form.nombre_apellido} onChange={(e) => set("nombre_apellido", e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
              </div>
              <select value={form.posicion} onChange={(e) => set("posicion", e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
                {POSICIONES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
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

function PlantelView({ jugadores, onAddJugador, onDeleteJugador, onUpdateJugador, onImportJugadores, rol }) {
  const puedeAltaBaja = esStaffCompleto(rol);
  const soloCamposMedicos = !esStaffCompleto(rol);
  const { categoria, tira, setCategoria, setTira } = useTeam();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [medidasTarget, setMedidasTarget] = useState(null);
  const [promedios, setPromedios] = useState({});

  const filtered = jugadores.filter((j) => jugadorEnEquipo(j, categoria, tira));

  const eliminarEvaluacion = (jugador, idx) => {
    const next = (jugador.evaluaciones_pfs || []).filter((_, i) => i !== idx);
    onUpdateJugador(jugador.id, { evaluaciones_pfs: next });
  };

  useEffect(() => {
    if (jugadores.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("vista_promedios_jugador")
        .select("*")
        .in("jugador_id", jugadores.map((j) => j.id));
      if (!cancelled && !error && data) {
        setPromedios(Object.fromEntries(data.map((p) => [p.jugador_id, p])));
      }
    })();
    return () => { cancelled = true; };
  }, [jugadores]);

  return (
    <div className="max-w-3xl mx-auto text-zinc-100">
      <div className="flex items-center gap-2 mb-1 text-zinc-400">
        <Users size={18} />
        <span className="text-xs font-bold uppercase tracking-widest">Plantel</span>
      </div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Jugadores</h1>
        {puedeAltaBaja && (
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-sm px-3 py-1.5 rounded">
            <Upload size={15} /> Importar CSV
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm px-3 py-1.5 rounded">
            <Plus size={15} /> Agregar jugador
          </button>
        </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={tira} onChange={(e) => setTira(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
          {TIRAS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {filtered.length === 0 && <p className="text-sm text-zinc-500">No hay jugadores cargados en {categoria} · {tira} todavía.</p>}

      <div className="space-y-2">
        {filtered.map((j) => (
          <div key={j.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
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
              <span className="text-zinc-500 text-xs ml-auto">{j.posicion}</span>
              <button onClick={() => setEditTarget(j)} title="Editar jugador" className="text-zinc-600 hover:text-blue-400 p-1">
                <PenLine size={13} />
              </button>
              {puedeAltaBaja && (
                <button onClick={() => setDeleteTarget(j)} title="Eliminar jugador" className="text-zinc-600 hover:text-red-400 p-1">
                  <Trash2 size={13} />
                </button>
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
            <button onClick={() => setMedidasTarget(j)} className="text-xs text-sky-400 hover:text-sky-300">Actualizar medidas</button>
            {j.evaluaciones_pfs?.length > 0 && (
              <details className="mt-1">
                <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">Ver evolución ({j.evaluaciones_pfs.length})</summary>
                <ul className="mt-1 space-y-0.5">
                  {j.evaluaciones_pfs.map((ev, i) => ({ ev, i })).reverse().map(({ ev, i }) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <span>
                        {ev.fecha}
                        {ev.altura != null ? ` · ${ev.altura} m` : ""}
                        {ev.peso != null ? ` · ${ev.peso} kg` : ""}
                      </span>
                      <button onClick={() => eliminarEvaluacion(j, i)} title="Eliminar este registro" className="text-zinc-600 hover:text-red-400 p-0.5">
                        <Trash2 size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
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
        <ConfirmDeleteModal
          itemLabel={deleteTarget.nombre_apellido}
          subject="jugador"
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

      {showImport && (
        <ImportadorCSVPropio
          categoriaDefault={categoria}
          tiraDefault={tira}
          onCancel={() => setShowImport(false)}
          onImported={(nuevos) => { onImportJugadores(nuevos); setShowImport(false); }}
        />
      )}
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
    await onSave({ ...form, dorsal: form.dorsal ? Number(form.dorsal) : null });
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
            <select value={form.posicion} onChange={(e) => set("posicion", e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
              {POSICIONES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input placeholder="Categoría (Mayor, U21...)" value={form.categoria} onChange={(e) => set("categoria", e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
          </div>
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

      if (!error && data.length > 0) {
        const { data: proms, error: errProms } = await supabase
          .from("vista_promedios_jugador")
          .select("*")
          .in("jugador_rival_id", data.map((j) => j.id));
        if (!cancelled && !errProms && proms) {
          setPromediosJugadores(Object.fromEntries(proms.map((p) => [p.jugador_rival_id, p])));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [equipo.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("vista_promedios_equipo").select("*").eq("equipo_rival_id", equipo.id).maybeSingle();
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
      <div className="flex items-center justify-between mb-4">
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
          <Chip tone="brand">{equipo.categoria} · {equipo.tira}</Chip>
        ) : (
          <Chip tone="amber">Sin categoría/tira asignada</Chip>
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
                  <span className="text-zinc-500 text-xs ml-auto">{j.posicion}{j.categoria ? ` · ${j.categoria}` : ""}</span>
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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { categoria, tira, setCategoria, setTira } = useTeam();
  const [verSinAsignar, setVerSinAsignar] = useState(false);
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

  const selected = equiposRivales.find((e) => e.id === selectedId) || null;

  if (selected) {
    return (
      <EquipoRivalFicha
        equipo={selected}
        onBack={() => setSelectedId(null)}
        onUpdateEquipo={(patch) => onUpdateEquipo(selected.id, patch)}
        soloLectura={soloLectura}
      />
    );
  }

  const sinAsignar = esJugador ? [] : equiposRivales.filter((eq) => !eq.categoria || !eq.tira);
  const equiposMostrados = verSinAsignar ? sinAsignar : equiposRivales.filter((eq) => eq.categoria === categoria && eq.tira === tira);

  return (
    <div className="max-w-3xl mx-auto text-zinc-100">
      <div className="flex items-center gap-2 mb-1 text-zinc-400">
        <Shield size={18} />
        <span className="text-xs font-bold uppercase tracking-widest">Scouting Hub</span>
      </div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Equipos rivales</h1>
        {!soloLectura && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm px-3 py-1.5 rounded">
            <Plus size={15} /> Agregar equipo rival
          </button>
        )}
      </div>

      {esJugador ? (
        <p className="text-sm text-zinc-400 mb-4">{categoria} · {tira}</p>
      ) : verSinAsignar ? (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-zinc-400">Equipos sin categoría/tira asignada</p>
          <button onClick={() => setVerSinAsignar(false)} className="text-xs text-brand-400 hover:text-brand-300">Volver al filtro</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={tira} onChange={(e) => setTira(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
            {TIRAS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {sinAsignar.length > 0 && (
            <button onClick={() => setVerSinAsignar(true)} className="text-xs text-amber-400 hover:text-amber-300">
              Ver sin asignar ({sinAsignar.length})
            </button>
          )}
        </div>
      )}

      {equiposMostrados.length === 0 && (
        <p className="text-sm text-zinc-500">
          {verSinAsignar ? "No hay equipos sin categoría/tira asignada." : "Todavía no cargaste ningún equipo rival para esta categoría/tira."}
        </p>
      )}

      <div className="space-y-2">
        {equiposMostrados.map((eq) => (
          <div key={eq.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center gap-3">
            <button onClick={() => setSelectedId(eq.id)} className="flex-1 text-left">
              <p className="font-medium text-sm text-zinc-100">{eq.nombre_club}</p>
              {eq.notas_colectivas && <p className="text-xs text-zinc-500 line-clamp-1">{eq.notas_colectivas}</p>}
            </button>
            <VideoLinkButton url={eq.video_colectivo_url} size={14} />
            {!soloLectura && (
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
function StatsPreviewTable({ label, rows, onChangeField, onLinkChange, jugadoresPropios, jugadoresRivales }) {
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
function AsignarMatrizPartido({ partido, defaultCategoria, defaultTira, onAsignar }) {
  const [cat, setCat] = useState(partido.categoria_equipo || defaultCategoria);
  const [tir, setTir] = useState(partido.tira_equipo || defaultTira);
  return (
    <div className="flex items-center gap-1">
      <select value={cat} onChange={(e) => setCat(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-1 py-0.5 text-xs text-zinc-100">
        {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={tir} onChange={(e) => setTir(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-1 py-0.5 text-xs text-zinc-100">
        {TIRAS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <button onClick={() => onAsignar(partido.id, cat, tir)} className="text-xs text-brand-400 hover:text-brand-300 px-1">Asignar</button>
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
  const { categoria, tira, setCategoria, setTira } = useTeam();
  const [verSinAsignar, setVerSinAsignar] = useState(false);
  const [jugadoresRivalesLocal, setJugadoresRivalesLocal] = useState([]);
  const [jugadoresRivalesVisitante, setJugadoresRivalesVisitante] = useState([]);
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

  const fetchHistorial = async () => {
    setLoadingHistorial(true);
    const { data, error } = await supabase.from("partidos_stats").select("*").order("fecha", { ascending: false });
    if (!error) setHistorial(data);
    setLoadingHistorial(false);
  };

  useEffect(() => { fetchHistorial(); }, []);

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
    const match = jugadores.find((j) => normalizeName(j.nombre_apellido) === norm);
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
        categoria: result.categoria,
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
    setSaving(true);
    setSaveMsg("");
    const { data: partido, error: errPartido } = await supabase
      .from("partidos_stats")
      .insert({
        fecha: preview.fecha,
        torneo: preview.torneo || null,
        categoria: preview.categoria || null,
        categoria_equipo: categoria,
        tira_equipo: tira,
        equipo_local: preview.equipoLocal,
        equipo_visitante: preview.equipoVisitante,
        resultado_local: preview.resultadoLocal === "" ? null : Number(preview.resultadoLocal),
        resultado_visitante: preview.resultadoVisitante === "" ? null : Number(preview.resultadoVisitante),
        equipo_propio: preview.equipoPropio || null,
      })
      .select()
      .single();
    if (errPartido) { setSaveMsg("Error al guardar el partido: " + errPartido.message); setSaving(false); return; }

    const jugadorRows = [
      ...preview.jugadoresLocal.map((j) => ({ ...j, equipo: preview.equipoLocal })),
      ...preview.jugadoresVisitante.map((j) => ({ ...j, equipo: preview.equipoVisitante })),
    ].map((j) => ({
      partido_id: partido.id,
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
      partido_id: partido.id, equipo, condicion, equipo_rival_id: equipoRivalId || null,
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
    fetchHistorial();
    setSaving(false);
  };

  const eliminarPartido = async (id) => {
    const { error } = await supabase.from("partidos_stats").delete().eq("id", id);
    if (!error) setHistorial((prev) => prev.filter((p) => p.id !== id));
  };

  const asignarMatrizPartido = async (id, cat, tir) => {
    const { data, error } = await supabase.from("partidos_stats").update({ categoria_equipo: cat, tira_equipo: tir }).eq("id", id).select().single();
    if (!error) setHistorial((prev) => prev.map((p) => (p.id === id ? data : p)));
  };

  const equiposRivalesFiltrados = equiposRivales.filter((eq) => eq.categoria === categoria && eq.tira === tira);
  const sinAsignar = historial.filter((p) => !p.categoria_equipo || !p.tira_equipo);
  const historialMostrado = verSinAsignar ? sinAsignar : historial.filter((p) => p.categoria_equipo === categoria && p.tira_equipo === tira);

  return (
    <div className="max-w-5xl mx-auto text-zinc-100">
      <div className="flex items-center gap-2 mb-1 text-zinc-400">
        <BarChart3 size={18} />
        <span className="text-xs font-bold uppercase tracking-widest">Estadísticas</span>
      </div>
      <h1 className="text-2xl font-bold mb-3">Cargar partido (PDF de la CABB)</h1>

      {verSinAsignar ? (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-zinc-400">Partidos sin categoría/tira asignada</p>
          <button onClick={() => setVerSinAsignar(false)} className="text-xs text-brand-400 hover:text-brand-300">Volver al filtro</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={tira} onChange={(e) => setTira(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
            {TIRAS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {sinAsignar.length > 0 && (
            <button onClick={() => setVerSinAsignar(true)} className="text-xs text-amber-400 hover:text-amber-300">
              Ver sin asignar ({sinAsignar.length})
            </button>
          )}
        </div>
      )}

      {!soloLectura && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
          <label className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm px-3 py-2 rounded cursor-pointer w-fit">
            <Upload size={15} /> Elegir PDF de estadísticas
            <input type="file" accept="application/pdf" onChange={handleFile} className="hidden" />
          </label>
          {parsing && <p className="text-sm text-zinc-500 mt-2">Leyendo el PDF…</p>}
          {parseError && <p className="text-sm text-amber-400 mt-2">{parseError}</p>}
        </div>
      )}

      {!soloLectura && preview && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-bold text-zinc-100 mb-3">Vista previa — revisá y corregí antes de guardar</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Fecha</p>
              <input type="date" value={preview.fecha} onChange={(e) => setPreview({ ...preview, fecha: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Torneo / fase</p>
              <input value={preview.torneo} onChange={(e) => setPreview({ ...preview, torneo: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Categoría</p>
              <input value={preview.categoria} onChange={(e) => setPreview({ ...preview, categoria: e.target.value })}
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
            <select value={preview.equipoPropio || ""} onChange={(e) => setPreview({ ...preview, equipoPropio: e.target.value || null })}
              className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100">
              <option value="">No se detectó — elegir</option>
              <option value="LOCAL">Local ({preview.equipoLocal})</option>
              <option value="VISITANTE">Visitante ({preview.equipoVisitante})</option>
            </select>
          </div>

          <div className="border-t border-zinc-800 pt-3 mb-5">
            <h3 className="text-sm font-bold text-blue-300 mb-2">Equipo Local{preview.equipoPropio === "LOCAL" ? " (nosotros)" : ""}</h3>
            <div className="flex gap-2 mb-3">
              <input value={preview.equipoLocal} onChange={(e) => setPreview({ ...preview, equipoLocal: e.target.value })}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
              <select value={preview.equipoLocalRivalId} onChange={(e) => {
                const value = e.target.value;
                setPreview((prev) => ({ ...prev, equipoLocalRivalId: value }));
                if (value) persistAliasEquipo(preview.equipoLocal, value);
              }}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100">
                <option value="">Vincular equipo (Scouting Hub)…</option>
                {equiposRivalesFiltrados.map((eq) => <option key={eq.id} value={eq.id}>{eq.nombre_club}</option>)}
              </select>
            </div>
            <StatsPreviewTable label="Jugadores" rows={preview.jugadoresLocal} jugadoresPropios={jugadores} jugadoresRivales={jugadoresRivalesLocal}
              onChangeField={(idx, field, value) => updateField("local", idx, field, value)}
              onLinkChange={(idx, value) => updateLink("local", idx, value)} />
            <EquipoTotalsRow label={preview.equipoLocal} totales={preview.totalesLocal} onChange={(field, value) => updateTotales("local", field, value)} />
          </div>

          <div className="border-t border-zinc-800 pt-3 mb-5">
            <h3 className="text-sm font-bold text-zinc-300 mb-2">Equipo Visitante{preview.equipoPropio === "VISITANTE" ? " (nosotros)" : ""}</h3>
            <div className="flex gap-2 mb-3">
              <input value={preview.equipoVisitante} onChange={(e) => setPreview({ ...preview, equipoVisitante: e.target.value })}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100" />
              <select value={preview.equipoVisitanteRivalId} onChange={(e) => {
                const value = e.target.value;
                setPreview((prev) => ({ ...prev, equipoVisitanteRivalId: value }));
                if (value) persistAliasEquipo(preview.equipoVisitante, value);
              }}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100">
                <option value="">Vincular equipo (Scouting Hub)…</option>
                {equiposRivalesFiltrados.map((eq) => <option key={eq.id} value={eq.id}>{eq.nombre_club}</option>)}
              </select>
            </div>
            <StatsPreviewTable label="Jugadores" rows={preview.jugadoresVisitante} jugadoresPropios={jugadores} jugadoresRivales={jugadoresRivalesVisitante}
              onChangeField={(idx, field, value) => updateField("visitante", idx, field, value)}
              onLinkChange={(idx, value) => updateLink("visitante", idx, value)} />
            <EquipoTotalsRow label={preview.equipoVisitante} totales={preview.totalesVisitante} onChange={(field, value) => updateTotales("visitante", field, value)} />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={recalcularMetricas} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm px-3 py-1.5 rounded">
              Recalcular métricas
            </button>
            <button onClick={guardar} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded">
              {saving ? "Guardando…" : "Guardar estadísticas"}
            </button>
            <button onClick={() => setPreview(null)} className="text-zinc-400 text-sm px-3 py-1.5">Descartar</button>
            {saveMsg && <span className={saveMsg.startsWith("Error") ? "text-red-400 text-xs" : "text-emerald-400 text-xs"}>{saveMsg}</span>}
          </div>
        </div>
      )}

      <Section icon={Trophy} title="Partidos cargados" accent="text-blue-400">
        {loadingHistorial ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : historialMostrado.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {verSinAsignar ? "No hay partidos sin categoría/tira asignada." : "Todavía no cargaste ningún partido para esta categoría/tira."}
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
                {p.categoria_equipo && p.tira_equipo ? (
                  <Chip tone="brand">{p.categoria_equipo} · {p.tira_equipo}</Chip>
                ) : !soloLectura ? (
                  <AsignarMatrizPartido partido={p} defaultCategoria={categoria} defaultTira={tira} onAsignar={asignarMatrizPartido} />
                ) : (
                  <Chip tone="amber">Sin categoría/tira</Chip>
                )}
                {!soloLectura && (
                  <button onClick={() => eliminarPartido(p.id)} title="Eliminar" className="text-zinc-600 hover:text-red-400 p-1"><Trash2 size={13} /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
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

// Modulo "Inicio": dashboard que unifica lo mas urgente de cada modulo (Calendario, Plantel,
// Entrenamientos, Scouting, Estadisticas) en una sola pantalla. El selector de Categoria/Tira
// scopea agenda/cronograma de hoy/RPE/asistencia/lesionados (igual que Plantel/Entrenamientos);
// proximo partido, lideres y tendencia son a nivel club porque jugador_partido_stats no guarda
// categoria de forma confiable para filtrar por ahi.
function InicioView({ events, jugadores, equiposRivales, onSelectEvent }) {
  const { categoria, tira, setCategoria, setTira } = useTeam();
  const hoy = todayKeyBA();

  const [notas, setNotas] = useState([]);
  const [loadingNotas, setLoadingNotas] = useState(true);
  const [notaNueva, setNotaNueva] = useState("");
  const [notaAbierta, setNotaAbierta] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("notas_staff").select("*").eq("resuelta", false).order("created_at", { ascending: false });
      if (!cancelled && !error) setNotas(data);
      setLoadingNotas(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const agregarNota = async () => {
    const texto = notaNueva.trim();
    if (!texto) return;
    setNotaNueva("");
    const { data, error } = await supabase.from("notas_staff").insert({ texto }).select().single();
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
    let cancelled = false;
    (async () => {
      setLoadingStats(true);
      const { data: ultimo } = await supabase.from("partidos_stats").select("*").order("fecha", { ascending: false }).limit(1).maybeSingle();
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
      }

      const { data: ultimos3 } = await supabase.from("partidos_stats").select("*").not("equipo_propio", "is", null).order("fecha", { ascending: false }).limit(3);
      if (!cancelled && ultimos3) {
        setTendencia(
          ultimos3
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
  }, []);

  const lesionados = jugadores.filter((j) => jugadorEnEquipo(j, categoria, tira) && j.disponibilidad && j.disponibilidad !== "Disponible");

  const proximoPartido = events.filter((e) => e.type === "partido" && e.date >= hoy).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
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
  { id: "entrenamientos", label: "Entrenamientos", icon: Dumbbell },
  { id: "scouting", label: "Scouting", icon: Swords },
  { id: "estadisticas", label: "Estadísticas", icon: BarChart3 },
];

export default function App() {
  const { session, rol, loading: authLoading, signOut } = useAuth();
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

  useEffect(() => {
    try { localStorage.setItem("sidebarCollapsed", sidebarCollapsed ? "1" : "0"); } catch {}
  }, [sidebarCollapsed]);

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

  useEffect(() => {
    if (!session) { setJugadores([]); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("jugadores").select("*").order("nombre_apellido", { ascending: true });
      if (cancelled) return;
      if (!error) setJugadores(data);
    })();
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (!session) { setEquiposRivales([]); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("equipos_rivales").select("*").order("nombre_club", { ascending: true });
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

  const addJugador = async (j) => {
    const { data, error } = await supabase.from("jugadores").insert(j).select().single();
    if (error) { setErrorMsg(error.message); return; }
    setJugadores((prev) => [...prev, data]);
  };

  const deleteJugador = async (id) => {
    const { error } = await supabase.from("jugadores").delete().eq("id", id);
    if (error) { setErrorMsg(error.message); return; }
    setJugadores((prev) => prev.filter((j) => j.id !== id));
  };

  const updateJugador = async (id, patch) => {
    const { data, error } = await supabase.from("jugadores").update(patch).eq("id", id).select().single();
    if (error) { setErrorMsg(error.message); return; }
    setJugadores((prev) => prev.map((j) => (j.id === id ? data : j)));
  };

  const importJugadores = (nuevos) => {
    setJugadores((prev) => [...prev, ...nuevos]);
  };

  const addEquipoRival = async (eq) => {
    const { data, error } = await supabase.from("equipos_rivales").insert(eq).select().single();
    if (error) { setErrorMsg(error.message); return; }
    setEquiposRivales((prev) => [...prev, data]);
  };

  const updateEquipoRival = async (id, patch) => {
    const { data, error } = await supabase.from("equipos_rivales").update(patch).eq("id", id).select().single();
    if (error) { setErrorMsg(error.message); return; }
    setEquiposRivales((prev) => prev.map((e) => (e.id === id ? data : e)));
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
      <main className="flex-1 min-w-0 p-6 pb-24 md:pb-6">
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
                    rol={rol}
                  />
                </ProtectedRoute>
              } />
              <Route path="/plantel" element={
                <ProtectedRoute seccionId="plantel">
                  <PlantelView jugadores={jugadores} onAddJugador={addJugador} onDeleteJugador={deleteJugador} onUpdateJugador={updateJugador} onImportJugadores={importJugadores} rol={rol} />
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
              <Route path="*" element={<Navigate to={rutaDeSeccion(seccionInicialDe(rol))} replace />} />
            </Routes>
          )
        )}
        {active?.type === "entrenamiento" && (
          <EntrenamientoView event={active} jugadores={jugadores} rol={rol} onBack={() => setActive(null)} onUpdate={(patch) => updateEvent(active.id, patch)} onDelete={() => { deleteEvent(active.id); setActive(null); }} />
        )}
        {active?.type === "individual" && (
          <IndividualView event={active} jugadores={jugadores} rol={rol} onBack={() => setActive(null)} onUpdate={(patch) => updateEvent(active.id, patch)} onDelete={() => { deleteEvent(active.id); setActive(null); }} />
        )}
        {active?.type === "partido" && (
          <PartidoView event={active} equiposRivales={equiposRivales} rol={rol} onBack={() => setActive(null)} onUpdate={(patch) => updateEvent(active.id, patch)} onDelete={() => { deleteEvent(active.id); setActive(null); }} />
        )}
      </main>

      {/* Bottom nav fija — solo celular, iconos grandes para tocar con el pulgar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-900 border-t border-zinc-800 flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {navItemsVisibles.map((item) => {
          const Icon = item.icon;
          const isActive = !active && seccionActiva === item.id;
          return (
            <button
              key={item.id}
              onClick={() => irASeccion(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 ${isActive ? "text-brand-300" : "text-zinc-500"}`}
            >
              <Icon size={24} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
