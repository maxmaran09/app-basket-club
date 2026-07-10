import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

// Sesión de Supabase Auth + fila de "perfiles" (rol, jugador_id) del usuario logueado, en un
// solo lugar: todo lo que necesita saber "quién soy y qué puedo hacer" se lee de useAuth(),
// nadie vuelve a pedirle el perfil a Supabase por su cuenta.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = todavía no se sabe, null = sin sesión
  const [perfil, setPerfil] = useState(null);
  const [loadingPerfil, setLoadingPerfil] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nuevaSession) => {
      setSession(nuevaSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setPerfil(null); return; }
    let cancelled = false;
    setLoadingPerfil(true);
    (async () => {
      const { data, error } = await supabase.from("perfiles").select("*").eq("id", session.user.id).maybeSingle();
      if (cancelled) return;
      setPerfil(error ? null : data);
      setLoadingPerfil(false);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });
  const signOut = () => supabase.auth.signOut();

  const value = {
    session,
    perfil,
    rol: perfil?.rol ?? null,
    loading: session === undefined || (!!session && loadingPerfil),
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
