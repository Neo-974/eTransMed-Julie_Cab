"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Ajout à la volée d'un patient. Date de naissance = clé anti-homonymie.
export default function AddPatientForm() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("cabinet_id")
      .single();
    if (!profile?.cabinet_id) {
      setSaving(false);
      setError("Cabinet introuvable.");
      return;
    }

    // Détection de doublon (même nom/prénom/date de naissance)
    const { data: dup } = await supabase
      .from("patients")
      .select("id")
      .ilike("nom", nom)
      .ilike("prenom", prenom)
      .eq("date_naissance", dob || null as unknown as string)
      .limit(1);
    if (dup && dup.length > 0) {
      setSaving(false);
      setError("Un patient avec ce nom et cette date de naissance existe déjà.");
      return;
    }

    const { error } = await supabase.from("patients").insert({
      cabinet_id: profile.cabinet_id,
      nom,
      prenom,
      date_naissance: dob || null,
      ajout_a_la_volee: true,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNom(""); setPrenom(""); setDob(""); setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-brand py-2 text-sm font-medium text-brand"
      >
        + Ajouter un patient
      </button>
    );
  }

  return (
    <form onSubmit={add} className="space-y-2 rounded-lg border bg-slate-50 p-3">
      <div className="flex gap-2">
        <input required placeholder="Nom" value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="w-1/2 rounded border border-slate-300 px-2 py-1.5 text-sm" />
        <input required placeholder="Prénom" value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          className="w-1/2 rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <label className="block text-xs text-slate-500">Date de naissance</label>
      <input type="date" value={dob}
        onChange={(e) => setDob(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving}
          className="flex-1 rounded bg-brand py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {saving ? "…" : "Enregistrer"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="rounded border px-3 py-1.5 text-sm">Annuler</button>
      </div>
    </form>
  );
}
