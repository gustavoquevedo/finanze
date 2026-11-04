"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { resetRepository } from "@/lib/data";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { inputClass, labelClass } from "./form-styles";

interface Auth {
  email: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<Auth>({ email: null, signOut: async () => {} });
export const useAuth = () => useContext(AuthContext);

/** With Supabase configured, only signed-in users see the app; otherwise it renders as is. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) return <>{children}</>;
  return <SupabaseGate>{children}</SupabaseGate>;
}

function SupabaseGate({ children }: { children: React.ReactNode }) {
  // undefined = still checking.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const userId = useRef<string | null>(null);

  // A different user (or none): drop the previous user's cached data.
  useEffect(() => {
    const next = session?.user.id ?? null;
    if (session !== undefined && next !== userId.current) {
      resetRepository();
      userId.current = next;
    }
  }, [session]);

  useEffect(() => {
    const supabase = getSupabase();
    // Also completes a magic-link sign-in: supabase-js reads the session from the URL.
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <p className="p-8 text-center text-slate-500">Cargando…</p>;
  }
  if (!session) return <Login />;

  const auth: Auth = {
    email: session.user.email ?? null,
    signOut: async () => {
      await getSupabase().auth.signOut();
      resetRepository();
    },
  };
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Indica un email válido.");
    setState("sending");
    setError(null);
    const { error } = await getSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setState("idle");
      setError(
        error.status === 429
          ? "Se han enviado demasiados enlaces. Espera unos minutos y vuelve a intentarlo."
          : /fetch|network/i.test(error.message)
            ? "No hay conexión con el servidor. Comprueba tu conexión e inténtalo de nuevo."
            : `No se pudo enviar el enlace: ${error.message}`,
      );
      return;
    }
    setState("sent");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-bold">Finanzas y pisos</h1>
        <p className="mt-1 text-slate-600">Entra con tu email: te enviaremos un enlace, sin contraseña.</p>
      </div>
      {state === "sent" ? (
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <p className="font-medium">Revisa tu correo</p>
          <p className="text-sm text-slate-600">
            Hemos enviado un enlace a <b>{email.trim()}</b>. Ábrelo en el dispositivo donde quieras entrar; si no llega en un par
            de minutos, mira en spam.
          </p>
          <button type="button" onClick={() => setState("idle")} className="text-sm font-medium text-emerald-700">
            Usar otro email
          </button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
          <div>
            <label htmlFor="login-email" className={labelClass}>Email</label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className={inputClass}
              value={email}
              onChange={(e) => (setEmail(e.target.value), setError(null))}
            />
          </div>
          {error && <p className="text-sm text-rose-700">{error}</p>}
          <button type="submit" disabled={state === "sending"} className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white disabled:opacity-50">
            {state === "sending" ? "Enviando…" : "Enviarme el enlace"}
          </button>
        </form>
      )}
    </main>
  );
}
