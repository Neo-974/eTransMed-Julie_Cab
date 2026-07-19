"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreateTournee() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { data: profile } = await supabase.from("profiles").select("cabinet_id").single();
    if (!profile?.cabinet_id) {
      setSaving(false);
      setError("Cabinet introuvable.");
      return;
    }
    const { error } = await supabase.from("tournees").insert({
      cabinet_id: profile.cabinet_id,
      nom,
      description: description || null,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNom("");
    setDescription("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-brand py-2 text-sm font-medium text-brand"
      >
        + Créer une tournée
      </button>
    );
  }

  return (
    <form onSubmit={add} className="space-y-2 rounded-lg border bg-slate-50 p-3">
      <input
        required
        placeholder="Nom de la tournée (ex. Tournée Nord — matin)"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        placeholder="Description (optionnel)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded bg-brand py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "…" : "Créer"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border px-3 py-1.5 text-sm">
          Annuler
        </button>
      </div>
    </form>
  );
}
