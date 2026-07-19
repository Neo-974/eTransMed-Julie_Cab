"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Membership = { tournee_id: string; moment: string; nom: string };
type Tournee = { id: string; nom: string };

const MOMENTS = [
  { key: "matin", label: "Matin" },
  { key: "apres_midi", label: "Après-midi" },
  { key: "soir", label: "Soir" },
];
const momentLabel = (k: string) => MOMENTS.find((m) => m.key === k)?.label ?? k;

export default function PatientTournees({
  patientId,
  cabinetId,
  memberships,
  allTournees,
}: {
  patientId: string;
  cabinetId: string;
  memberships: Membership[];
  allTournees: Tournee[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addTournee, setAddTournee] = useState("");
  const [addMoment, setAddMoment] = useState("matin");

  const assigned = new Set(memberships.map((m) => m.tournee_id));
  const available = allTournees.filter((t) => !assigned.has(t.id));

  async function add() {
    if (!addTournee) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("tournee_patients").insert({
      tournee_id: addTournee,
      patient_id: patientId,
      cabinet_id: cabinetId,
      moment: addMoment,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setAddTournee("");
    router.refresh();
  }

  async function changeMoment(tourneeId: string, moment: string) {
    setBusy(true);
    await supabase
      .from("tournee_patients")
      .update({ moment })
      .eq("tournee_id", tourneeId)
      .eq("patient_id", patientId);
    setBusy(false);
    router.refresh();
  }

  async function remove(tourneeId: string) {
    setBusy(true);
    await supabase
      .from("tournee_patients")
      .delete()
      .eq("tournee_id", tourneeId)
      .eq("patient_id", patientId);
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="rounded-lg border bg-slate-50 p-3">
      <h2 className="mb-2 text-sm font-semibold text-slate-600">Tournées du patient</h2>

      <ul className="space-y-2">
        {memberships.map((m) => (
          <li
            key={m.tournee_id}
            className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-2 text-sm"
          >
            <span className="font-medium text-brand-dark">{m.nom}</span>
            <select
              value={m.moment}
              disabled={busy}
              onChange={(e) => changeMoment(m.tournee_id, e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-xs"
            >
              {MOMENTS.map((mm) => (
                <option key={mm.key} value={mm.key}>
                  {mm.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => remove(m.tournee_id)}
              disabled={busy}
              className="ml-auto rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              Retirer
            </button>
          </li>
        ))}
        {memberships.length === 0 && (
          <li className="text-xs text-slate-400">Ce patient n&apos;est dans aucune tournée.</li>
        )}
      </ul>

      {available.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={addTournee}
            onChange={(e) => setAddTournee(e.target.value)}
            className="min-w-[8rem] flex-1 rounded border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="">Ajouter à une tournée…</option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nom}
              </option>
            ))}
          </select>
          <select
            value={addMoment}
            onChange={(e) => setAddMoment(e.target.value)}
            className="rounded border border-slate-300 px-2 py-2 text-sm"
          >
            {MOMENTS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={busy || !addTournee}
            className="rounded bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
