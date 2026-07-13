import React, { useRef, useState } from "react";
import { Upload, X, Download, CheckCircle2, AlertCircle, Loader2, FileText } from "lucide-react";
import { supabase } from "./supabaseClient";
import { CATEGORIAS, TIRAS, POSICIONES } from "./constants";
import { normalizarHeader, parseCSV, buscarEnLista, fechaValida, descargarCSV } from "./csvUtils";
import { normalizeName } from "./pdfStats";

// Fecha de hoy en huso horario de Buenos Aires -- mismo criterio que todayKeyBA() en App.jsx
// (duplicada acá porque ese helper no está exportado y no amerita tocar App.jsx por esto).
function hoyBA() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// Busca, dentro del plantel del club ya cargado, un jugador con el mismo nombre que juegue en
// la categoria/tira de esta fila (equipo principal o adicional) -- para actualizarlo en vez de
// crear un duplicado si el CSV vuelve a traer a alguien que ya está cargado.
function buscarExistente(jugadoresExistentes, nombre, categoria, tira) {
  const norm = normalizeName(nombre);
  return (jugadoresExistentes || []).find((j) => {
    if (normalizeName(j.nombre_apellido) !== norm) return false;
    if (j.categoria_origen === categoria && j.tira === tira) return true;
    return (j.equipos_adicionales || []).some((e) => e.categoria === categoria && e.tira === tira);
  }) || null;
}

// Encabezados de columna aceptados en el CSV -> nombre de columna real en la tabla "jugadores".
// Se normalizan (minúsculas, sin acentos, espacios -> "_") antes de buscarlos acá.
const HEADER_ALIASES = {
  dorsal: "dorsal",
  nombre_apellido: "nombre_apellido",
  nombre: "nombre_apellido",
  nombre_y_apellido: "nombre_apellido",
  posicion: "posicion",
  altura: "altura",
  peso: "peso",
  fecha_medicion: "fecha_medicion",
  fecha_medida: "fecha_medicion",
  fecha_nacimiento: "fecha_nacimiento",
  categoria_principal: "categoria_origen",
  categoria_origen: "categoria_origen",
  tira_principal: "tira",
  tira: "tira",
  notas: "notas_comentarios",
  notas_comentarios: "notas_comentarios",
  disponibilidad: "disponibilidad",
  detalle_lesion: "lesion_detalle",
  lesion_detalle: "lesion_detalle",
  fecha_lesion_desde: "lesion_desde",
  lesion_desde: "lesion_desde",
  equipos_adicionales: "equipos_adicionales",
};

const CSV_HEADERS_TEMPLATE = [
  "dorsal", "nombre_apellido", "posicion", "altura", "peso", "fecha_medicion", "fecha_nacimiento",
  "categoria_principal", "tira_principal", "notas", "disponibilidad",
  "detalle_lesion", "fecha_lesion_desde", "equipos_adicionales",
];

// Fila de instrucciones: a propósito no cumple ningún formato válido (posicion, fechas,
// categoría, etc. traen el texto de ayuda en vez de un valor real) para que si alguien se
// olvida de borrarla antes de importar, el propio validador la marque como fila con error
// y no la cargue por accidente.
const CSV_FILA_INSTRUCCIONES = [
  "Nº opcional",
  "▲ BORRAR ESTA FILA (es solo ayuda) ▲",
  POSICIONES.join(" / "),
  "en metros, ej: 1.90",
  "en kg, entero",
  "AAAA-MM-DD, opcional (vacío = hoy). Fecha real de la toma de altura/peso, si es distinta a cuando cargás el CSV",
  "AAAA-MM-DD",
  `${CATEGORIAS.join(" / ")} (vacío = usa la categoría del filtro activo)`,
  `${TIRAS.join(" / ")} (vacío = usa la tira del filtro activo)`,
  "texto libre, opcional",
  "Disponible / Duda / Lesionado (vacío = Disponible)",
  "obligatorio si disponibilidad no es Disponible",
  "AAAA-MM-DD, obligatorio si disponibilidad no es Disponible",
  "Categoria:Tira|Categoria2:Tira2 (opcional)",
];

const CSV_FILAS_EJEMPLO = [
  CSV_FILA_INSTRUCCIONES,
  ["7", "Juan Pérez", "Base", "1.85", "78", "", "2001-04-12", "Mayores", "Blanca", "Buen tiro exterior, capitán", "Disponible", "", "", "Liga Próximo:Blanca"],
  ["23", "Marcos Díaz", "Pivot", "2.02", "102", "2026-07-01", "1999-11-02", "Mayores", "Blanca", "", "Lesionado", "Esguince de tobillo", "2026-06-30", ""],
];

// Formato simple para equipos_adicionales en la celda: "Categoria:Tira|Categoria2:Tira2"
function parseEquiposAdicionales(raw, principal) {
  const errores = [];
  const lista = [];
  if (!raw || !raw.trim()) return { lista, errores };
  const vistos = new Set();
  for (const par of raw.split("|").map((p) => p.trim()).filter(Boolean)) {
    const [catRaw, tiraRaw] = par.split(":").map((s) => (s ?? "").trim());
    if (!catRaw || !tiraRaw) { errores.push(`equipos_adicionales: "${par}" no tiene el formato Categoría:Tira`); continue; }
    const categoria = buscarEnLista(catRaw, CATEGORIAS);
    const tira = buscarEnLista(tiraRaw, TIRAS);
    if (!categoria) { errores.push(`equipos_adicionales: categoría "${catRaw}" no es válida`); continue; }
    if (!tira) { errores.push(`equipos_adicionales: tira "${tiraRaw}" no es válida`); continue; }
    if (categoria === principal.categoria && tira === principal.tira) {
      errores.push(`equipos_adicionales: ${categoria} · ${tira} duplica el equipo principal`);
      continue;
    }
    const key = `${categoria}|${tira}`;
    if (vistos.has(key)) { errores.push(`equipos_adicionales: ${categoria} · ${tira} está repetido`); continue; }
    vistos.add(key);
    lista.push({ categoria, tira });
  }
  return { lista, errores };
}

function validarFila(raw, numeroFila, categoriaDefault, tiraDefault, temporadas, jugadoresExistentes) {
  const errores = [];
  const warnings = [];
  const data = {};
  // Que campos vinieron con dato en esta fila -- al actualizar un jugador ya existente solo se
  // tocan estos, para no borrar por accidente algo cargado a mano que la fila no repitió.
  const provisto = {};

  const nombre = (raw.nombre_apellido || "").trim();
  if (!nombre) errores.push("falta nombre_apellido (obligatorio)");
  data.nombre_apellido = nombre;

  const dorsalRaw = (raw.dorsal || "").trim();
  provisto.dorsal = !!dorsalRaw;
  if (dorsalRaw) {
    const n = Number(dorsalRaw);
    if (!Number.isInteger(n)) errores.push(`dorsal "${dorsalRaw}" no es un número entero`);
    data.dorsal = Number.isInteger(n) ? n : null;
  } else data.dorsal = null;

  const posicionRaw = (raw.posicion || "").trim();
  provisto.posicion = !!posicionRaw;
  if (posicionRaw) {
    const pos = buscarEnLista(posicionRaw, POSICIONES);
    if (!pos) errores.push(`posicion "${posicionRaw}" inválida (usar: ${POSICIONES.join(", ")})`);
    data.posicion = pos || posicionRaw;
  } else data.posicion = null;

  const alturaRaw = (raw.altura || "").trim();
  provisto.altura = !!alturaRaw;
  if (alturaRaw) {
    const n = Number(alturaRaw.replace(",", "."));
    if (Number.isNaN(n) || n <= 0 || n >= 10) errores.push(`altura "${alturaRaw}" inválida`);
    data.altura = !Number.isNaN(n) ? Math.round(n * 100) / 100 : null;
  } else data.altura = null;

  const pesoRaw = (raw.peso || "").trim();
  provisto.peso = !!pesoRaw;
  if (pesoRaw) {
    const n = Number(pesoRaw.replace(",", "."));
    if (Number.isNaN(n) || n <= 0) errores.push(`peso "${pesoRaw}" inválido`);
    else {
      const entero = Math.round(n);
      if (entero !== n) warnings.push(`peso redondeado de ${n} a ${entero} kg (la columna es entera)`);
      data.peso = entero;
    }
  } else data.peso = null;

  const fechaMedicionRaw = (raw.fecha_medicion || "").trim();
  if (fechaMedicionRaw && !fechaValida(fechaMedicionRaw)) errores.push(`fecha_medicion "${fechaMedicionRaw}" debe tener formato YYYY-MM-DD`);
  data.fecha_medicion = fechaMedicionRaw && fechaValida(fechaMedicionRaw) ? fechaMedicionRaw : null;

  const nacRaw = (raw.fecha_nacimiento || "").trim();
  provisto.fecha_nacimiento = !!nacRaw;
  if (nacRaw) {
    if (!fechaValida(nacRaw)) errores.push(`fecha_nacimiento "${nacRaw}" debe tener formato YYYY-MM-DD`);
    data.fecha_nacimiento = fechaValida(nacRaw) ? nacRaw : null;
  } else data.fecha_nacimiento = null;

  const catRaw = (raw.categoria_origen || "").trim() || categoriaDefault;
  const categoria = buscarEnLista(catRaw, CATEGORIAS);
  if (!categoria) errores.push(`categoria_principal "${catRaw}" inválida`);
  data.categoria_origen = categoria || catRaw;

  const tiraRaw = (raw.tira || "").trim() || tiraDefault;
  const tira = buscarEnLista(tiraRaw, TIRAS);
  if (!tira) errores.push(`tira_principal "${tiraRaw}" inválida`);
  data.tira = tira || tiraRaw;

  if (categoria && tira) {
    const temporadaActiva = (temporadas || []).find((t) => t.categoria === categoria && t.tira === tira && t.activa);
    if (!temporadaActiva) errores.push(`No hay una temporada activa para ${categoria} · ${tira} — creala primero desde Plantel`);
    data.temporada_id = temporadaActiva?.id ?? null;
  } else {
    data.temporada_id = null;
  }

  data.notas_comentarios = (raw.notas_comentarios || "").trim();
  provisto.notas_comentarios = !!data.notas_comentarios;

  const dispRaw = (raw.disponibilidad || "").trim();
  provisto.disponibilidad = !!dispRaw;
  const disponibilidad = dispRaw ? buscarEnLista(dispRaw, ["Disponible", "Duda", "Lesionado"]) : "Disponible";
  if (dispRaw && !disponibilidad) errores.push(`disponibilidad "${dispRaw}" inválida (usar: Disponible, Duda, Lesionado)`);
  data.disponibilidad = disponibilidad || dispRaw || "Disponible";

  const detalle = (raw.lesion_detalle || "").trim();
  const desde = (raw.lesion_desde || "").trim();
  if (data.disponibilidad !== "Disponible") {
    if (!detalle) errores.push("lesion_detalle es obligatorio cuando disponibilidad no es Disponible");
    if (!desde) errores.push("fecha_lesion_desde es obligatoria cuando disponibilidad no es Disponible");
    else if (!fechaValida(desde)) errores.push(`fecha_lesion_desde "${desde}" debe tener formato YYYY-MM-DD`);
    data.lesion_detalle = detalle;
    data.lesion_desde = fechaValida(desde) ? desde : null;
  } else {
    data.lesion_detalle = "";
    data.lesion_desde = null;
  }

  const equiposAdicionalesRaw = (raw.equipos_adicionales || "").trim();
  provisto.equipos_adicionales = !!equiposAdicionalesRaw;
  const { lista: equiposAdicionales, errores: erroresEquipos } = parseEquiposAdicionales(
    raw.equipos_adicionales,
    { categoria: data.categoria_origen, tira: data.tira }
  );
  errores.push(...erroresEquipos);
  data.equipos_adicionales = equiposAdicionales;

  // Si ya hay un jugador con este nombre en este mismo equipo, se actualiza en vez de duplicarlo.
  // Comparacion con Number(...) de los dos lados porque "numeric"/PostgREST a veces vuelve como
  // string -- sin esto, una fila sin cambios reales podria registrarse como cambio igual.
  const existente = buscarExistente(jugadoresExistentes, data.nombre_apellido, data.categoria_origen, data.tira);
  data.alturaCambio = !!existente && provisto.altura && Number(data.altura) !== Number(existente.altura ?? NaN);
  data.pesoCambio = !!existente && provisto.peso && Number(data.peso) !== Number(existente.peso ?? NaN);
  if (data.alturaCambio) warnings.push(`altura cambia de ${existente.altura ?? "—"} a ${data.altura} — se agrega a la evolución con fecha ${data.fecha_medicion || "de hoy"}`);
  if (data.pesoCambio) warnings.push(`peso cambia de ${existente.peso ?? "—"} a ${data.peso} kg — se agrega a la evolución con fecha ${data.fecha_medicion || "de hoy"}`);

  return { numeroFila, data, provisto, existente, errores, warnings, valida: errores.length === 0 };
}

function descargarPlantilla() {
  descargarCSV("plantilla_plantel_propio.csv", [CSV_HEADERS_TEMPLATE, ...CSV_FILAS_EJEMPLO]);
}

// Carga masiva de Plantel propio desde un .csv: FileReader -> parseo -> previsualización
// con validación fila por fila -> bulk insert a Supabase de solo las filas válidas.
export default function ImportadorCSVPropio({ categoriaDefault, tiraDefault, temporadas, jugadoresExistentes, onCancel, onImported }) {
  const [fase, setFase] = useState("carga"); // carga | preview | importando | listo
  const [filas, setFilas] = useState([]);
  const [errorArchivo, setErrorArchivo] = useState("");
  const [errorImport, setErrorImport] = useState("");
  const [resultado, setResultado] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const procesarArchivo = (file) => {
    setErrorArchivo("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorArchivo("El archivo debe ser un .csv");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const texto = String(e.target.result || "").replace(/^﻿/, "");
        const filasCrudas = parseCSV(texto);
        if (filasCrudas.length < 2) {
          setErrorArchivo("El CSV no tiene filas de datos (solo encabezado o vacío)");
          return;
        }
        const [headerRow, ...dataRows] = filasCrudas;
        const campos = headerRow.map((h) => HEADER_ALIASES[normalizarHeader(h)] || null);
        if (!campos.includes("nombre_apellido")) {
          setErrorArchivo('El CSV necesita una columna "nombre_apellido" (o "nombre")');
          return;
        }
        const validadas = dataRows
          .filter((r) => r.some((v) => v && v.trim()))
          .map((r, idx) => {
            const raw = {};
            campos.forEach((campo, i) => { if (campo) raw[campo] = r[i] ?? ""; });
            return validarFila(raw, idx + 2, categoriaDefault, tiraDefault, temporadas, jugadoresExistentes);
          });
        setFilas(validadas);
        setFase("preview");
      } catch (err) {
        setErrorArchivo("No se pudo leer el archivo: " + err.message);
      }
    };
    reader.onerror = () => setErrorArchivo("No se pudo leer el archivo");
    reader.readAsText(file, "utf-8");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    procesarArchivo(e.dataTransfer.files?.[0]);
  };

  const validas = filas.filter((f) => f.valida);
  const invalidas = filas.filter((f) => !f.valida);

  // Altas: insert en 2 fases (identidad en "jugadores", despues membresia de la temporada en
  // "jugador_temporada") -- mismo modelo que usa PlantelView/JugadorFormModal (ver src/App.jsx,
  // addJugador). Actualizaciones: solo se tocan los campos que la fila trajo con dato (ver
  // "provisto" en validarFila), y si altura/peso cambiaron se suma una entrada a
  // evaluaciones_pfs con la fecha real de la medicion (o la de hoy si la fila no la trae) en
  // vez de pisar el historial -- mismo criterio que ActualizarMedidasModal en App.jsx.
  const importar = async () => {
    setFase("importando");
    setErrorImport("");

    const altas = validas.filter((f) => !f.existente);
    const actualizaciones = validas.filter((f) => f.existente);

    let nuevosFlattened = [];
    if (altas.length > 0) {
      const bioPayload = altas.map((f) => ({
        nombre_apellido: f.data.nombre_apellido,
        posicion: f.data.posicion,
        altura: f.data.altura,
        peso: f.data.peso,
        fecha_nacimiento: f.data.fecha_nacimiento,
        notas_comentarios: f.data.notas_comentarios,
        disponibilidad: f.data.disponibilidad,
        lesion_detalle: f.data.lesion_detalle,
        lesion_desde: f.data.lesion_desde,
      }));
      const { data: jugadoresInsertados, error: errJugadores } = await supabase.from("jugadores").insert(bioPayload).select();
      if (errJugadores) {
        setErrorImport(errJugadores.message);
        setFase("preview");
        return;
      }

      const jtPayload = jugadoresInsertados.map((row, i) => ({
        jugador_id: row.id,
        temporada_id: altas[i].data.temporada_id,
        dorsal: altas[i].data.dorsal,
        equipos_adicionales: altas[i].data.equipos_adicionales,
        estado: "activo",
      }));
      const { data: jtInsertados, error: errJt } = await supabase.from("jugador_temporada").insert(jtPayload).select();
      if (errJt) {
        setErrorImport(errJt.message);
        setFase("preview");
        return;
      }

      const temporadasPorId = Object.fromEntries((temporadas || []).map((t) => [t.id, t]));
      nuevosFlattened = jugadoresInsertados.map((row, i) => {
        const jt = jtInsertados[i];
        const t = temporadasPorId[jt.temporada_id];
        return {
          id: row.id,
          jugador_temporada_id: jt.id,
          nombre_apellido: row.nombre_apellido,
          posicion: row.posicion,
          altura: row.altura,
          peso: row.peso,
          fecha_nacimiento: row.fecha_nacimiento,
          notas_comentarios: row.notas_comentarios,
          disponibilidad: row.disponibilidad,
          lesion_detalle: row.lesion_detalle,
          lesion_desde: row.lesion_desde,
          evaluaciones_pfs: row.evaluaciones_pfs,
          temporada_id: jt.temporada_id,
          nombre_competencia: t?.nombre_competencia,
          anio: t?.anio,
          temporada_activa: t?.activa,
          categoria_origen: t?.categoria,
          tira: t?.tira,
          dorsal: jt.dorsal,
          estado: jt.estado,
          equipos_adicionales: jt.equipos_adicionales,
        };
      });
    }

    const hoy = hoyBA();
    const actualizadosFlattened = [];
    for (const f of actualizaciones) {
      const { data: d, existente } = f;
      const bioPatch = {};
      if (d.provisto.posicion) bioPatch.posicion = d.posicion;
      if (d.provisto.fecha_nacimiento) bioPatch.fecha_nacimiento = d.fecha_nacimiento;
      if (d.provisto.notas_comentarios) bioPatch.notas_comentarios = d.notas_comentarios;
      if (d.provisto.disponibilidad) {
        bioPatch.disponibilidad = d.disponibilidad;
        bioPatch.lesion_detalle = d.lesion_detalle;
        bioPatch.lesion_desde = d.lesion_desde;
      }

      if (d.alturaCambio || d.pesoCambio) {
        const entry = { fecha: d.fecha_medicion || hoy };
        if (d.alturaCambio) entry.altura = d.altura;
        if (d.pesoCambio) entry.peso = d.peso;
        bioPatch.evaluaciones_pfs = [...(existente.evaluaciones_pfs || []), entry];
        if (d.alturaCambio) bioPatch.altura = d.altura;
        if (d.pesoCambio) bioPatch.peso = d.peso;
      }

      if (Object.keys(bioPatch).length > 0) {
        const { error } = await supabase.from("jugadores").update(bioPatch).eq("id", existente.id);
        if (error) { setErrorImport(error.message); setFase("preview"); return; }
      }

      const jtPatch = {};
      if (d.provisto.dorsal) jtPatch.dorsal = d.dorsal;
      if (d.provisto.equipos_adicionales) jtPatch.equipos_adicionales = d.equipos_adicionales;
      if (Object.keys(jtPatch).length > 0) {
        const { error } = await supabase.from("jugador_temporada").update(jtPatch).eq("id", existente.jugador_temporada_id);
        if (error) { setErrorImport(error.message); setFase("preview"); return; }
      }

      actualizadosFlattened.push({ ...existente, ...bioPatch, ...jtPatch });
    }

    setResultado({ insertados: nuevosFlattened.length, actualizados: actualizadosFlattened.length, omitidas: invalidas.length });
    onImported(nuevosFlattened, actualizadosFlattened);
    setFase("listo");
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4" onClick={onCancel}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-3xl max-h-[95vh] flex flex-col text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
          <h3 className="font-bold text-sm flex items-center gap-2"><Upload size={16} /> Importar plantel desde CSV</h3>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 p-1"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          {fase === "carga" && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                Las filas que no traigan categoria_principal/tira_principal se cargan con el filtro activo:{" "}
                <strong>{categoriaDefault} · {tiraDefault}</strong>. Si el nombre ya existe en ese equipo, se actualiza
                en vez de duplicarlo (solo se pisan los campos que la fila trae con dato).
              </p>
              <button onClick={descargarPlantilla} className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300">
                <Download size={13} /> Descargar plantilla CSV de ejemplo
              </button>
              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${dragOver ? "border-brand-500 bg-brand-500/5" : "border-zinc-700 hover:border-zinc-600"}`}
              >
                <FileText size={28} className="text-zinc-500" />
                <span className="text-sm text-zinc-300 text-center">Tocá para elegir un archivo .csv o arrastralo acá</span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => procesarArchivo(e.target.files?.[0])}
                />
              </label>
              {errorArchivo && (
                <p className="flex items-center gap-1.5 text-xs text-red-400"><AlertCircle size={13} /> {errorArchivo}</p>
              )}
            </div>
          )}

          {(fase === "preview" || fase === "importando") && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="flex items-center gap-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded px-2 py-1">
                  <CheckCircle2 size={13} /> {validas.length} válidas
                </span>
                {invalidas.length > 0 && (
                  <span className="flex items-center gap-1 bg-red-500/15 text-red-300 border border-red-500/30 rounded px-2 py-1">
                    <AlertCircle size={13} /> {invalidas.length} con errores (no se importan)
                  </span>
                )}
                <button onClick={() => { setFase("carga"); setFilas([]); }} className="ml-auto text-zinc-500 hover:text-zinc-300 underline">
                  Elegir otro archivo
                </button>
              </div>

              <div className="overflow-x-auto border border-zinc-800 rounded-lg">
                <table className="w-full text-xs min-w-[640px]">
                  <thead className="bg-zinc-950 text-zinc-500">
                    <tr>
                      <th className="text-left px-2 py-1.5">Fila</th>
                      <th className="text-left px-2 py-1.5">Plantel</th>
                      <th className="text-left px-2 py-1.5">Nombre</th>
                      <th className="text-left px-2 py-1.5">Dorsal</th>
                      <th className="text-left px-2 py-1.5">Posición</th>
                      <th className="text-left px-2 py-1.5">Categoría · Tira</th>
                      <th className="text-left px-2 py-1.5">Disponibilidad</th>
                      <th className="text-left px-2 py-1.5">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.numeroFila} className={`border-t border-zinc-800 ${f.valida ? "" : "bg-red-500/5"}`}>
                        <td className="px-2 py-1.5 text-zinc-500">{f.numeroFila}</td>
                        <td className="px-2 py-1.5">
                          {f.existente ? (
                            <span className="text-sky-400">Actualiza</span>
                          ) : (
                            <span className="text-emerald-400">Nuevo</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">{f.data.nombre_apellido || <span className="text-zinc-600">—</span>}</td>
                        <td className="px-2 py-1.5">{f.data.dorsal ?? "—"}</td>
                        <td className="px-2 py-1.5">{f.data.posicion ?? "—"}</td>
                        <td className="px-2 py-1.5">{f.data.categoria_origen} · {f.data.tira}</td>
                        <td className="px-2 py-1.5">{f.data.disponibilidad}</td>
                        <td className="px-2 py-1.5">
                          {f.valida ? (
                            <span className="text-emerald-400">OK{f.warnings.length > 0 ? " *" : ""}</span>
                          ) : (
                            <span className="text-red-400" title={f.errores.join(" / ")}>Error</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {invalidas.length > 0 && (
                <details className="text-xs text-red-300/90">
                  <summary className="cursor-pointer text-red-400">Ver detalle de errores</summary>
                  <ul className="mt-1 space-y-1 list-disc list-inside">
                    {invalidas.map((f) => (
                      <li key={f.numeroFila}>Fila {f.numeroFila}: {f.errores.join(" — ")}</li>
                    ))}
                  </ul>
                </details>
              )}

              {filas.some((f) => f.warnings.length > 0) && (
                <details className="text-xs text-amber-300/90">
                  <summary className="cursor-pointer text-amber-400">Ver advertencias (*)</summary>
                  <ul className="mt-1 space-y-1 list-disc list-inside">
                    {filas.filter((f) => f.warnings.length > 0).map((f) => (
                      <li key={f.numeroFila}>Fila {f.numeroFila}: {f.warnings.join(" — ")}</li>
                    ))}
                  </ul>
                </details>
              )}

              {errorImport && (
                <p className="flex items-center gap-1.5 text-xs text-red-400"><AlertCircle size={13} /> {errorImport}</p>
              )}
            </div>
          )}

          {fase === "listo" && resultado && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <CheckCircle2 size={32} className="text-emerald-400" />
              <p className="text-sm">
                Se importaron <strong>{resultado.insertados}</strong> jugadores nuevos
                {resultado.actualizados > 0 && <> y se actualizaron <strong>{resultado.actualizados}</strong> ya existentes</>}.
              </p>
              {resultado.omitidas > 0 && (
                <p className="text-xs text-zinc-500">{resultado.omitidas} filas con errores fueron omitidas.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-zinc-800 shrink-0">
          {fase === "preview" && (
            <>
              <button onClick={onCancel} className="text-sm text-zinc-400 hover:text-zinc-200 px-3 py-1.5">Cancelar</button>
              <button
                onClick={importar}
                disabled={validas.length === 0}
                className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm px-3 py-1.5 rounded"
              >
                {validas.filter((f) => f.existente).length > 0
                  ? `Importar (${validas.filter((f) => !f.existente).length} nuevos, ${validas.filter((f) => f.existente).length} actualizan)`
                  : `Importar ${validas.length} jugador${validas.length === 1 ? "" : "es"}`}
              </button>
            </>
          )}
          {fase === "importando" && (
            <button disabled className="flex items-center gap-1.5 bg-zinc-700 text-zinc-300 text-sm px-3 py-1.5 rounded">
              <Loader2 size={14} className="animate-spin" /> Importando...
            </button>
          )}
          {(fase === "carga" || fase === "listo") && (
            <button onClick={onCancel} className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded">
              {fase === "listo" ? "Cerrar" : "Cancelar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
