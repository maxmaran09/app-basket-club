import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { puedeVerSeccion, seccionInicialDe, rutaDeSeccion } from "./permisos";

// Envuelve una ruta: sin sesión -> /login; con sesión pero sin permiso para esta sección ->
// la pantalla inicial de su rol (evita pantallas en blanco); si no, renderiza la ruta.
export default function ProtectedRoute({ seccionId, children }) {
  const { session, rol, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-500 text-sm">
        Cargando…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (seccionId && !puedeVerSeccion(rol, seccionId)) {
    return <Navigate to={rutaDeSeccion(seccionInicialDe(rol))} replace />;
  }

  return children;
}
