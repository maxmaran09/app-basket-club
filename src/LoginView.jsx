import React, { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function LoginView() {
  const { session, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!loading && session) {
    return <Navigate to={location.state?.from?.pathname ?? "/"} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    const { error: err } = await signIn(email.trim(), password);
    setEnviando(false);
    if (err) { setError("Email o contraseña incorrectos."); return; }
    navigate(location.state?.from?.pathname ?? "/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-6">
          <img src="/escudo-hacoaj.png" alt="Náutico Hacoaj" className="h-16 w-auto" />
          <p className="text-zinc-100 font-bold">Náutico Hacoaj</p>
          <p className="text-zinc-500 text-xs">Staff Básquet</p>
        </div>

        <form onSubmit={submit} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <h1 className="text-zinc-100 font-bold text-sm mb-1">Iniciar sesión</h1>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium px-3 py-2 rounded"
          >
            {enviando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
