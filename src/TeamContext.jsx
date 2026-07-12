import React, { createContext, useContext, useEffect, useState } from "react";
import { CATEGORIAS, TIRAS } from "./constants";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";

// Filtro matricial Categoria/Tira compartido por toda la app (Calendario, Plantel,
// Entrenamientos, Scouting, Estadisticas, Inicio): se elige una vez y se mantiene al navegar
// entre modulos, y persiste en localStorage para sobrevivir un refresh de pagina.
//
// Ademas resuelve la Temporada activa: no es un anio unico para todo el club, sino una
// competencia puntual POR EQUIPO (categoria+tira) -- ver supabase/schema_temporadas.sql. Cada
// vez que cambia categoria/tira, se busca automaticamente cual es la temporada activa de ESE
// equipo. El coach puede overridear esa seleccion para mirar una temporada pasada del mismo
// equipo; ese override se recuerda por equipo (implicitamente, comparando ids) y persiste en
// localStorage, pero nunca es el default -- el default siempre es "la activa de este equipo".
const STORAGE_KEY = "hacoaj_equipo_activo";
const TeamContext = createContext(null);

function leerGuardado() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { categoria, tira, temporadaIdOverride } = JSON.parse(raw);
    if (CATEGORIAS.includes(categoria) && TIRAS.includes(tira)) {
      return { categoria, tira, temporadaIdOverride: temporadaIdOverride ?? null };
    }
  } catch {
    // localStorage corrupto o inaccesible (modo privado, etc.): se ignora y arranca con default.
  }
  return null;
}

export function TeamProvider({ children }) {
  const { session } = useAuth();
  const guardado = leerGuardado();
  const [categoria, setCategoriaState] = useState(guardado?.categoria ?? CATEGORIAS[0]);
  const [tira, setTiraState] = useState(guardado?.tira ?? TIRAS[0]);
  const [temporadaIdOverride, setTemporadaIdOverride] = useState(guardado?.temporadaIdOverride ?? null);
  const [temporadas, setTemporadas] = useState([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ categoria, tira, temporadaIdOverride }));
    } catch {
      // idem: si falla el guardado, la seleccion sigue funcionando en memoria para esta sesion.
    }
  }, [categoria, tira, temporadaIdOverride]);

  const cargarTemporadas = async () => {
    if (!session) { setTemporadas([]); return; }
    const { data, error } = await supabase.from("temporadas").select("*");
    if (!error) setTemporadas(data || []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session) { setTemporadas([]); return; }
      const { data, error } = await supabase.from("temporadas").select("*");
      if (cancelled) return;
      if (!error) setTemporadas(data || []);
    })();
    return () => { cancelled = true; };
  }, [session]);

  // Todas las temporadas (pasadas y presente) del equipo actualmente seleccionado, mas reciente
  // primero -- para que PlantelView pueda ofrecer "ver una temporada pasada de este equipo" sin
  // pedirle nada nuevo a Supabase.
  const temporadasDelEquipo = temporadas
    .filter((t) => t.categoria === categoria && t.tira === tira)
    .sort((a, b) => b.anio - a.anio || a.nombre_competencia.localeCompare(b.nombre_competencia));

  const activaDelEquipo = temporadasDelEquipo.find((t) => t.activa) || null;
  const overrideValido = temporadaIdOverride && temporadasDelEquipo.some((t) => t.id === temporadaIdOverride)
    ? temporadaIdOverride
    : null;

  const temporadaId = overrideValido ?? activaDelEquipo?.id ?? null;
  const temporadaSeleccionada = temporadasDelEquipo.find((t) => t.id === temporadaId) || null;
  const esTemporadaActiva = temporadaSeleccionada ? temporadaSeleccionada.activa : false;

  const setCategoria = (next) => setCategoriaState(next);
  const setTira = (next) => setTiraState(next);
  const setEquipo = (nextCategoria, nextTira) => {
    setCategoriaState(nextCategoria);
    setTiraState(nextTira);
  };
  // Elegir a mano que temporada de ESTE equipo mirar (ej. una pasada). No hace falta limpiar el
  // override al cambiar de equipo: como el id no va a matchear ninguna temporada del otro
  // equipo, overrideValido lo ignora solo hasta que se vuelva a este mismo equipo.
  const setTemporadaId = (id) => setTemporadaIdOverride(id);

  return (
    <TeamContext.Provider
      value={{
        categoria, tira, setCategoria, setTira, setEquipo,
        temporadas, temporadasDelEquipo,
        temporadaId, temporadaSeleccionada, esTemporadaActiva,
        setTemporadaId, refrescarTemporadas: cargarTemporadas,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  return useContext(TeamContext);
}
