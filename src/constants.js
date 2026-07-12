// Listas compartidas entre App.jsx y componentes que no pueden importar de App.jsx
// directamente (evita import circular, ej: ImportadorCSVPropio.jsx).
export const CATEGORIAS = ["Mayores", "Liga Próximo", "Juveniles", "Cadetes", "Infantiles", "Mini", "Pre-Mini", "Mosquitos"];
export const TIRAS = ["Blanca", "Azul", "Celeste", "Femenino"];
export const POSICIONES = ["Base", "Escolta", "Alero", "Ala-Pivot", "Pivot"];

export const formatPosicion = (j) => [j?.posicion, j?.posicion_secundaria].filter(Boolean).join(" · ");
