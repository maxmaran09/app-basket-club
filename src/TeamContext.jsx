import React, { createContext, useContext, useEffect, useState } from "react";
import { CATEGORIAS, TIRAS } from "./constants";

// Filtro matricial Categoria/Tira compartido por toda la app (Calendario, Plantel,
// Entrenamientos, Scouting, Estadisticas, Inicio): se elige una vez y se mantiene al navegar
// entre modulos, y persiste en localStorage para sobrevivir un refresh de pagina.
const STORAGE_KEY = "hacoaj_equipo_activo";
const TeamContext = createContext(null);

function leerGuardado() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { categoria, tira } = JSON.parse(raw);
    if (CATEGORIAS.includes(categoria) && TIRAS.includes(tira)) return { categoria, tira };
  } catch {
    // localStorage corrupto o inaccesible (modo privado, etc.): se ignora y arranca con default.
  }
  return null;
}

export function TeamProvider({ children }) {
  const guardado = leerGuardado();
  const [categoria, setCategoria] = useState(guardado?.categoria ?? CATEGORIAS[0]);
  const [tira, setTira] = useState(guardado?.tira ?? TIRAS[0]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ categoria, tira }));
    } catch {
      // idem: si falla el guardado, la seleccion sigue funcionando en memoria para esta sesion.
    }
  }, [categoria, tira]);

  const setEquipo = (nextCategoria, nextTira) => {
    setCategoria(nextCategoria);
    setTira(nextTira);
  };

  return (
    <TeamContext.Provider value={{ categoria, tira, setCategoria, setTira, setEquipo }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  return useContext(TeamContext);
}
