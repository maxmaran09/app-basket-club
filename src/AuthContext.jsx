import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

// Sesión de Supabase Auth + fila de "perfiles" (rol, jugador_id) del usuario logueado, en un
// solo lugar: todo lo que necesita saber "quién soy y qué puedo hacer" se lee de useAuth(),
// nadie vuelve a pedirle el perfil a Supabase por su cuenta.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = todavía no se sabe, null = sin sesión
  // undefined = todavía no se resolvió el perfil de ESTA sesión, null = se resolvió y no tiene fila.
  // Antes esto se rastreaba con un booleano "loadingPerfil" aparte, seteado adentro del efecto —
  // pero React confirma "session" en un render y recién en el SIGUIENTE corre el efecto que
  // prende ese booleano, así que había un render intermedio con session ya resuelta pero
  // loadingPerfil todavía en false: loading daba false con rol todavía null, y cualquier
  // ProtectedRoute de por medio te mandaba al fallback (por eso "/" a veces caía en /calendario
  // al recargar la página). Usar "undefined" como valor inicial/de reseteo de perfil hace que
  // ese estado sea imposible de observar desde afuera.
  const [perfil, setPerfil] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nuevaSession) => {
      setSession(nuevaSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setPerfil(undefined); return; }
    setPerfil(undefined);
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("perfiles").select("*").eq("id", session.user.id).maybeSingle();
      if (cancelled) return;
      setPerfil(error ? null : data);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });
  const signOut = () => supabase.auth.signOut();

  const value = {
    session,
    perfil,
    rol: perfil?.rol ?? null,
    loading: session === undefined || (!!session && perfil === undefined),
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
