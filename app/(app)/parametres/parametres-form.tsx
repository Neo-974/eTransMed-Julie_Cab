"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ParametresForm({
  cabinetId,
  nom,
  description,
  codeInvitation,
}: {
  cabinetId: string;
  nom: string;
  description: string;
  codeInvitation: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [n, setN] = useState(nom);
  const [d, setD] = useState(description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [copied, setCopied] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(false);
    const { error } = await supabase
      .from("cabinets")
      .update({ nom: n, description: d || null })
      .eq("id", cabinetId);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setOk(true);
    router.refresh();
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(codeInvitation);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponible */
    }
  }

  return (
    <div className="space-y-5">
      {/* Code d'invitation */}
      <section className="rounded-lg border border-brand bg-teal-50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-dark">
          Code d&apos;invitation du cabinet
        </p>
        <div className="mt-1 flex items-center gap-3">
          <span className="font-mono text-2xl font-bold tracking-widest text-slate-900">
            {codeInvitation}
          </span>
          <button
            onClick={copyCode}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-brand-dark ring-1 ring-brand/30"
          >
            {copied ? "Copié ✓" : "Copier"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Partagez ce code à vos collègues : à l&apos;inscription, ils choisissent
          « Rejoindre un cabinet » et saisissent ce code.
        </p>
      </section>

      {/* Nom + description */}
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Nom du cabinet</label>
          <input
            required
            value={n}
            onChange={(e) => setN(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Description (optionnel)
          </label>
          <textarea
            value={d}
            onChange={(e) => setD(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {ok && <p className="text-sm text-emerald-600">Enregistré ✓</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "…" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
