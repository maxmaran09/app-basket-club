// Utilidades compartidas por los importadores de CSV (Plantel propio, Plantel rival, y los
// que se agreguen a futuro): parseo de archivo, normalización de encabezados, búsqueda
// tolerante a mayúsculas/acentos y generación del archivo de descarga.

export function normalizarHeader(h) {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[áàä]/g, "a")
    .replace(/[éèë]/g, "e")
    .replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o")
    .replace(/[úùü]/g, "u")
    .replace(/ñ/g, "n");
}

// Parser CSV (RFC4180): soporta campos entre comillas con comas/saltos de línea internos
// y comillas escapadas como "" (necesario para notas y textos libres con comas).
export function parseCSV(texto) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (inQuotes) {
      if (c === '"') {
        if (texto[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* ignorado, el salto real lo maneja \n */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

export function buscarEnLista(valor, lista) {
  if (!valor) return null;
  const norm = valor.trim().toLowerCase();
  return lista.find((op) => op.toLowerCase() === norm) || null;
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
export function fechaValida(s) {
  return FECHA_RE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime());
}

// filas: array de arrays (primera fila = encabezados). Dispara la descarga de un .csv.
export function descargarCSV(nombreArchivo, filas) {
  const csv = filas
    .map((fila) => fila.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}
