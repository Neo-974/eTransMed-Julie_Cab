"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Mode = "create" | "join";

export default function RegisterForm() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("create");
  const [cabinet, setCabinet] = useState("");
  const [code, setCode] = useState("");
  const [role, setRole] = useState("collaborateur");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let { data: auth, error: signErr } = await supabase.auth.signUp({ email, password });

    // Compte déjà créé lors d'une tentative précédente : on se connecte.
    if (signErr) {
      const { data: signIn, error: inErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (inErr) {
        setLoading(false);
        setError(inErr.message);
        return;
      }
      auth = signIn;
    }

    if (!auth.session) {
      setLoading(false);
      setError(
        "Confirmation email requise. Pour la version test, désactivez « Confirm email » dans Supabase (Authentication → Providers → Email)."
      );
      return;
    }

    // Fonctions SECURITY DEFINER : évitent le blocage RLS à l'inscription.
    const { error: rpcErr } =
      mode === "create"
        ? await supabase.rpc("create_cabinet_and_join", {
            cabinet_nom: cabinet,
            membre_nom: nom,
          })
        : await supabase.rpc("join_cabinet_with_code", {
            p_code: code,
            membre_nom: nom,
            p_role: role,
          });

    setLoading(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }

    router.push("/accueil");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold text-brand-dark">eTransMed</h1>
      <p className="mb-4 text-sm text-slate-500">Inscription (version test)</p>

      <div className="mb-4 flex rounded-lg border p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`flex-1 rounded-md py-1.5 ${
            mode === "create" ? "bg-brand font-medium text-white" : "text-slate-500"
          }`}
        >
          Créer un cabinet
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`flex-1 rounded-md py-1.5 ${
            mode === "join" ? "bg-brand font-medium text-white" : "text-slate-500"
          }`}
        >
          Rejoindre un cabinet
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === "create" ? (
          <input required placeholder="Nom du cabinet" value={cabinet}
            onChange={(e) => setCabinet(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        ) : (
          <>
            <input required placeholder="Code du cabinet" value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase tracking-widest" />
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="collaborateur">Collaborateur</option>
              <option value="remplacant">Remplaçant</option>
            </select>
          </>
        )}
        <input required placeholder="Votre nom" value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        <input type="email" required placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        <input type="password" required placeholder="Mot de passe (min. 6)" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full rounded-lg bg-brand py-2 font-medium text-white disabled:opacity-50">
          {loading
            ? "…"
            : mode === "create"
            ? "Créer le cabinet"
            : "Rejoindre le cabinet"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Déjà un compte ? <Link href="/login" className="text-brand underline">Se connecter</Link>
      </p>
    </main>
  );
}
