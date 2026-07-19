"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Existing = {
  id: string;
  transcript_raw: string | null;
  transcript_corrige: string | null;
} | null;

export default function Recorder({
  patientId,
  patientName,
  existing,
}: {
  patientId: string;
  patientName: string;
  existing: Existing;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [text, setText] = useState(
    existing?.transcript_corrige ?? existing?.transcript_raw ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enregistre l'observation (texte dicté au clavier) et la valide.
  async function save() {
    if (!text.trim()) {
      setError("Le texte ne peut pas être vide.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: profile } = await supabase.from("profiles").select("cabinet_id").single();
    const { data: userData } = await supabase.auth.getUser();
    if (!profile?.cabinet_id || !userData.user) {
      setSaving(false);
      setError("Session invalide.");
      return;
    }

    if (existing) {
      const { error: e } = await supabase
        .from("passages")
        .update({
          transcript_corrige: text,
          statut: "valide",
          valide_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (e) {
        setSaving(false);
        setError(e.message);
        return;
      }
    } else {
      const { data: passage, error: e } = await supabase
        .from("passages")
        .insert({
          patient_id: patientId,
          cabinet_id: profile.cabinet_id,
          auteur_id: userData.user.id,
          transcript_corrige: text,
          statut: "valide",
          valide_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (e || !passage) {
        setSaving(false);
        setError(e?.message ?? "Enregistrement impossible.");
        return;
      }
      await supabase.from("audit_log").insert({
        cabinet_id: profile.cabinet_id,
        acteur_id: userData.user.id,
        action: "passage.valide",
        cible_type: "passage",
        cible_id: passage.id,
      });
    }

    setSaving(false);
    router.push(`/patients/${patientId}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-brand bg-teal-50 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-dark">
          Nouvelle observation · patient sélectionné
        </p>
        <p className="text-xl font-bold leading-tight text-slate-900">{patientName}</p>
      </div>

      <label className="block text-sm font-medium text-slate-600">Observation</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        autoFocus
        placeholder="Dictez avec le micro 🎤 de votre clavier, ou tapez le texte…"
        className="w-full rounded-lg border border-slate-300 p-3 text-sm"
      />
      <p className="text-xs text-slate-500">
        💡 Touchez le <b>micro 🎤 de votre clavier</b> pour dicter (transcription du
        téléphone, gratuite).
      </p>
      <p className="text-xs text-amber-700">
        ⚠️ Vérifiez soigneusement les posologies et les chiffres avant de valider.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !text.trim()}
          className="flex-1 rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-50"
        >
          {saving ? "…" : "Valider le passage"}
        </button>
        <button
          onClick={() => router.push(`/patients/${patientId}`)}
          className="rounded-lg border px-4 py-2.5 text-sm"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
