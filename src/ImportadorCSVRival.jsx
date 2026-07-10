import React, { useRef, useState } from "react";
import { Upload, X, Download, CheckCircle2, AlertCircle, Loader2, FileText } from "lucide-react";
import { supabase } from "./supabaseClient";
import { POSICIONES } from "./constants";
import { normalizarHeader, parseCSV, buscarEnLista, descargarCSV } from "./csvUtils";

// Encabezados de columna aceptados en el CSV -> nombre de columna real en la tabla
// "jugadores_rivales". Se normalizan (minúsculas, sin acentos, espacios -> "_") antes de
// buscarlos acá.
const HEADER_ALIASES = {
  dorsal: "dorsal",
  nombre_apellido: "nombre_apellido",
  nombre: "nombre_apellido",
  nombre_y_apellido: "nombre_apellido",
  posicion: "posicion",
  categoria: "categoria",
  cualidades_ataque: "cualidades_ataque",
  ataque: "cualidades_ataque",
  fortalezas: "cualidades_ataque",
  cualidades_defensa: "cualidades_defensa",
  defensa: "cualidades_defensa",
  debilidades: "debilidades",
  video_individual_url: "video_individual_url",
  video: "video_individual_url",
  video_url: "video_individual_url",
  link_video: "video_individual_url",
};

const CSV_HEADERS_TEMPLATE = [
  "dorsal", "nombre_apellido", "posicion", "categoria",
  "cualidades_ataque", "cualidades_defensa", "debilidades", "video_individual_url",
];

// Fila de instrucciones: a propósito no cumple el formato de "posicion" (trae el texto de
// ayuda en vez de un valor real) para que si alguien se olvida de borrarla antes de importar,
// el propio validador la marque como fila con error y no la cargue por accidente.
const CSV_FILA_INSTRUCCIONES = [
  "Nº opcional",
  "▲ BORRAR ESTA FILA (es solo ayuda) ▲",
  POSICIONES.join(" / "),
  "texto libre, ej: Mayor / U21 (opcional)",
  "texto libre, opcional",
  "texto libre, opcional",
  "texto libre, opcional",
  "link de YouTube, opcional",
];

const CSV_FILAS_EJEMPLO = [
  CSV_FILA_INSTRUCCIONES,
  ["4", "Nicolás Gómez", "Base", "Mayor", "Buen manejo de pelota, tira bien de afuera", "Se cierra mucho en pick and roll", "Bajo de estatura para su posición", "https://www.youtube.com/watch?v=ejemplo"],
  ["15", "Tomás Ibarra", "Pivot", "U21", "", "Buen bloqueador y reboteador", "Poca movilidad lateral", ""],
];

function validarFilaRival(raw, numeroFila) {
  const errores = [];
  const warnings = [];
  const data = {};

  const nombre = (raw.nombre_apellido || "").trim();
  if (!nombre) errores.push("falta nombre_apellido (obligatorio)");
  data.nombre_apellido = nombre;

  const dorsalRaw = (raw.dorsal || "").trim();
  if (dorsalRaw) {
    const n = Number(dorsalRaw);
    if (!Number.isInteger(n)) errores.push(`dorsal "${dorsalRaw}" no es un número entero`);
    data.dorsal = Number.isInteger(n) ? n : null;
  } else data.dorsal = null;

  const posicionRaw = (raw.posicion || "").trim();
  if (posicionRaw) {
    const pos = buscarEnLista(posicionRaw, POSICIONES);
    if (!pos) errores.push(`posicion "${posicionRaw}" inválida (usar: ${POSICIONES.join(", ")})`);
    data.posicion = pos || posicionRaw;
  } else data.posicion = null;

  data.categoria = (raw.categoria || "").trim();
  data.cualidades_ataque = (raw.cualidades_ataque || "").trim();
  data.cualidades_defensa = (raw.cualidades_defensa || "").trim();
  data.debilidades = (raw.debilidades || "").trim();

  const video = (raw.video_individual_url || "").trim();
  if (video && !/^https?:\/\//i.test(video)) {
    warnings.push(`video_individual_url "${video}" no empieza con http(s), revisá que sea un link válido`);
  }
  data.video_individual_url = video;

  return { numeroFila, data, errores, warnings, valida: errores.length === 0 };
}

function descargarPlantilla() {
  descargarCSV("plantilla_plantel_rival.csv", [CSV_HEADERS_TEMPLATE, ...CSV_FILAS_EJEMPLO]);
}

// Carga masiva del plantel de un equipo rival desde un .csv: FileReader -> parseo ->
// previsualización con validación fila por fila -> bulk insert a Supabase de solo las
// filas válidas, todas asociadas al mismo equipo_rival_id.
export default function ImportadorCSVRival({ equipoRivalId, onCancel, onImported }) {
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
            return validarFilaRival(raw, idx + 2);
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

  const importar = async () => {
    setFase("importando");
    setErrorImport("");
    const payload = validas.map((f) => ({ ...f.data, equipo_rival_id: equipoRivalId }));
    const { data, error } = await supabase.from("jugadores_rivales").insert(payload).select();
    if (error) {
      setErrorImport(error.message);
      setFase("preview");
      return;
    }
    setResultado({ insertados: data.length, omitidas: invalidas.length });
    onImported(data);
    setFase("listo");
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4" onClick={onCancel}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-3xl max-h-[95vh] flex flex-col text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
          <h3 className="font-bold text-sm flex items-center gap-2"><Upload size={16} /> Importar plantel rival desde CSV</h3>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 p-1"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          {fase === "carga" && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                Los jugadores importados se agregan al plantel de este equipo rival.
              </p>
              <button onClick={descargarPlantilla} className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300">
                <Download size={13} /> Descargar plantilla CSV de ejemplo
              </button>
              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${dragOver ? "border-orange-500 bg-orange-500/5" : "border-zinc-700 hover:border-zinc-600"}`}
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
                <table className="w-full text-xs min-w-[520px]">
                  <thead className="bg-zinc-950 text-zinc-500">
                    <tr>
                      <th className="text-left px-2 py-1.5">Fila</th>
                      <th className="text-left px-2 py-1.5">Nombre</th>
                      <th className="text-left px-2 py-1.5">Dorsal</th>
                      <th className="text-left px-2 py-1.5">Posición</th>
                      <th className="text-left px-2 py-1.5">Categoría</th>
                      <th className="text-left px-2 py-1.5">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.numeroFila} className={`border-t border-zinc-800 ${f.valida ? "" : "bg-red-500/5"}`}>
                        <td className="px-2 py-1.5 text-zinc-500">{f.numeroFila}</td>
                        <td className="px-2 py-1.5">{f.data.nombre_apellido || <span className="text-zinc-600">—</span>}</td>
                        <td className="px-2 py-1.5">{f.data.dorsal ?? "—"}</td>
                        <td className="px-2 py-1.5">{f.data.posicion ?? "—"}</td>
                        <td className="px-2 py-1.5">{f.data.categoria || "—"}</td>
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
              <p className="text-sm">Se importaron <strong>{resultado.insertados}</strong> jugadores rivales.</p>
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
                className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm px-3 py-1.5 rounded"
              >
                Importar {validas.length} jugador{validas.length === 1 ? "" : "es"}
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
