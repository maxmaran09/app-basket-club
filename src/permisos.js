// Permisos centralizados por rol. Mismo criterio que constants.js (CATEGORIAS/TIRAS/POSICIONES):
// un solo lugar del que todo importa, nada de "if (rol === ...)" repartido por los componentes.

export const ROLES = {
  HEAD_COACH: "head_coach",
  ASISTENTE_TECNICO: "asistente_tecnico",
  PREPARADOR_FISICO: "preparador_fisico",
  JUGADOR: "jugador",
};

export const ROL_LABELS = {
  [ROLES.HEAD_COACH]: "Head Coach",
  [ROLES.ASISTENTE_TECNICO]: "Asistente Técnico",
  [ROLES.PREPARADOR_FISICO]: "Preparador Físico",
  [ROLES.JUGADOR]: "Jugador",
};

// Qué secciones (NAV_ITEMS.id) ve cada rol en el sidebar/bottom nav, y a qué rutas tiene
// acceso. La primera de la lista es también la pantalla a la que se redirige ese rol al
// entrar o si intenta abrir una ruta que no le corresponde.
export const SECCIONES_POR_ROL = {
  [ROLES.HEAD_COACH]: ["inicio", "calendario", "plantel", "jugador360", "entrenamientos", "scouting", "estadisticas"],
  [ROLES.ASISTENTE_TECNICO]: ["inicio", "calendario", "plantel", "jugador360", "entrenamientos", "scouting", "estadisticas"],
  [ROLES.PREPARADOR_FISICO]: ["inicio", "calendario", "plantel", "jugador360", "entrenamientos", "scouting", "estadisticas"],
  [ROLES.JUGADOR]: ["calendario", "scouting"],
};

export const puedeVerSeccion = (rol, seccionId) => (SECCIONES_POR_ROL[rol] || []).includes(seccionId);

export const seccionInicialDe = (rol) => (SECCIONES_POR_ROL[rol] || [])[0] || "calendario";

// "inicio" vive en la raíz ("/"); el resto de las secciones son "/<id>".
export const rutaDeSeccion = (seccionId) => (seccionId === "inicio" ? "/" : `/${seccionId}`);

// Roles con lectura/escritura total (Plantel, Scouting, Calendario sin restricciones, etc.).
export const esStaffCompleto = (rol) => rol === ROLES.HEAD_COACH || rol === ROLES.ASISTENTE_TECNICO;

// Nivel de acceso a un bloque puntual dentro de una ficha de evento: 'rw' | 'ro' | 'none'.
// Roles no listados para un bloque (ej: head_coach/asistente_tecnico) son 'rw' por defecto.
const PERMISOS_BLOQUE_EVENTO = {
  entrenamiento: {
    header: { [ROLES.PREPARADOR_FISICO]: "ro", [ROLES.JUGADOR]: "none" },
    asistenciaRpe: { [ROLES.PREPARADOR_FISICO]: "rw", [ROLES.JUGADOR]: "none" },
    preparacionFisica: { [ROLES.PREPARADOR_FISICO]: "rw", [ROLES.JUGADOR]: "none" },
    bloquesCancha: { [ROLES.PREPARADOR_FISICO]: "ro", [ROLES.JUGADOR]: "none" },
  },
  individual: {
    header: { [ROLES.PREPARADOR_FISICO]: "ro", [ROLES.JUGADOR]: "none" },
    preparacionFisica: { [ROLES.PREPARADOR_FISICO]: "rw", [ROLES.JUGADOR]: "none" },
    bloquesCancha: { [ROLES.PREPARADOR_FISICO]: "ro", [ROLES.JUGADOR]: "none" },
  },
  partido: {
    todo: { [ROLES.PREPARADOR_FISICO]: "ro", [ROLES.JUGADOR]: "ro" },
  },
};

export function nivelBloque(rol, tipoEvento, bloque) {
  if (esStaffCompleto(rol)) return "rw";
  return PERMISOS_BLOQUE_EVENTO[tipoEvento]?.[bloque]?.[rol] ?? "rw";
}

// Tipos de evento que un Jugador puede abrir desde su Calendario (el resto no abre nada).
export const TIPOS_EVENTO_ABRIBLES_JUGADOR = ["partido"];
