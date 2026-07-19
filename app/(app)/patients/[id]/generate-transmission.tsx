"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Transmission = {
  id: string;
  texte: string | null;
  statut: "brouillon" | "validee";
  format: "fluide" | "ciblee";
  validee_at: string | null;
} | null;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Fusionne chronologiquement les passages validés du jour en une transmission.
export default function GenerateTransmission({
  patientId,
  transmission,
  validatedCount,
}: {
  patientId: string;
  transmission: Transmission;
  validatedCount: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [text, setText] = useState(transmission?.texte ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validated = transmission?.statut === "validee";

  async function generate() {
    setBusy(true);
    setError(null);

    const { data: profile } = await supabase.from("profiles").select("cabinet_id").single();
    const { data: passages } = await supabase
      .from("passages")
      .select("recorded_at, transcript_corrige")
      .eq("patient_id", patientId)
      .eq("statut", "valide")
      .gte("recorded_at", `${todayISO()}T00:00:00`)
      .order("recorded_at", { ascending: true });

    // Fusion chronologique horodatée : "8h00 : … / 18h30 : …"
    const merged = (passages ?? [])
      .map((p) => {
        const t = new Date(p.recorded_at).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return `${t} : ${p.transcript_corrige ?? ""}`.trim();
      })
      .join("\n");

    if (!profile?.cabinet_id) {
      setBusy(false);
      setError("Cabinet introuvable.");
      return;
    }

    const { error: upErr } = await supabase.from("transmissions").upsert(
      {
        patient_id: patientId,
        cabinet_id: profile.cabinet_id,
        date_soin: todayISO(),
        texte: merged,
        statut: "brouillon",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "patient_id,date_soin" }
    );

    setBusy(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setText(merged);
    router.refresh();
  }

  async function validate() {
    setBusy(true);
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    const { error: upErr } = await supabase
      .from("transmissions")
      .update({
        texte: text,
        statut: "validee",
        validee_par: userData.user?.id,
        validee_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("patient_id", patientId)
      .eq("date_soin", todayISO());
    setBusy(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-lg border bg-slate-50 p-3">
      <h2 className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-600">
        Transmission du jour
        {validated && (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
            validée
          </span>
        )}
      </h2>

      {!transmission && (
        <button
          onClick={generate}
          disabled={busy || validatedCount === 0}
          className="w-full rounded-lg bg-brand py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {validatedCount === 0
            ? "Aucun passage validé"
            : busy
            ? "…"
            : `Générer la transmission (${validatedCount} passage${validatedCount > 1 ? "s" : ""})`}
        </button>
      )}

      {transmission && !validated && (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-slate-300 p-3 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={validate}
              disabled={busy || !text.trim()}
              className="flex-1 rounded-lg bg-brand py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "…" : "Valider (rendre visible au cabinet)"}
            </button>
            <button
              onClick={generate}
              disabled={busy}
              className="rounded-lg border px-3 py-2 text-sm"
              title="Regénérer depuis les passages validés"
            >
              ↻
            </button>
          </div>
        </div>
      )}

      {validated && (
        <pre className="whitespace-pre-wrap rounded-lg border bg-white p-3 text-sm text-slate-700">
          {transmission.texte}
        </pre>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
