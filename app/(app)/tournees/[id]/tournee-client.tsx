"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Membership = {
  patient_id: string;
  moment: string;
  patient: { nom: string; prenom: string } | null;
};
type Patient = { id: string; nom: string; prenom: string };
type Praticien = { id: string; nom: string };
type Tournee = { id: string; nom: string };

const MOMENTS = [
  { key: "matin", label: "Matin" },
  { key: "apres_midi", label: "Après-midi" },
  { key: "soir", label: "Soir" },
];
const momentLabel = (k: string) => MOMENTS.find((m) => m.key === k)?.label ?? k;

export default function TourneeClient({
  tourneeId,
  cabinetId,
  memberships,
  allPatients,
  memberIds,
  praticiens,
  otherTournees,
}: {
  tourneeId: string;
  cabinetId: string;
  memberships: Membership[];
  allPatients: Patient[];
  memberIds: string[];
  praticiens: Praticien[];
  otherTournees: Tournee[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addPatient, setAddPatient] = useState("");
  const [addMoment, setAddMoment] = useState("matin");

  const inTournee = new Set(memberships.map((m) => m.patient_id));
  const available = allPatients.filter((p) => !inTournee.has(p.id));

  async function toggleMembre(profileId: string, assigned: boolean) {
    setBusy(true);
    setError(null);
    if (assigned) {
      await supabase.from("tournee_membres").delete().eq("tournee_id", tourneeId).eq("profile_id", profileId);
    } else {
      await supabase
        .from("tournee_membres")
        .insert({ tournee_id: tourneeId, profile_id: profileId, cabinet_id: cabinetId });
    }
    setBusy(false);
    router.refresh();
  }

  async function addToTournee() {
    if (!addPatient) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("tournee_patients")
      .insert({ tournee_id: tourneeId, patient_id: addPatient, cabinet_id: cabinetId, moment: addMoment });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setAddPatient("");
    router.refresh();
  }

  async function changeMoment(patientId: string, moment: string) {
    setBusy(true);
    await supabase.from("tournee_patients").update({ moment }).eq("tournee_id", tourneeId).eq("patient_id", patientId);
    setBusy(false);
    router.refresh();
  }

  async function removePatient(patientId: string) {
    setBusy(true);
    await supabase.from("tournee_patients").delete().eq("tournee_id", tourneeId).eq("patient_id", patientId);
    setBusy(false);
    router.refresh();
  }

  async function movePatient(patientId: string, targetTournee: string, moment: string) {
    if (!targetTournee) return;
    setBusy(true);
    setError(null);
    const { error: insErr } = await supabase
      .from("tournee_patients")
      .upsert(
        { tournee_id: targetTournee, patient_id: patientId, cabinet_id: cabinetId, moment },
        { onConflict: "tournee_id,patient_id" }
      );
    if (insErr) {
      setBusy(false);
      setError(insErr.message);
      return;
    }
    await supabase.from("tournee_patients").delete().eq("tournee_id", tourneeId).eq("patient_id", patientId);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Praticiens affectés */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Praticiens de la tournée</h2>
        <div className="flex flex-wrap gap-2">
          {praticiens.map((p) => {
            const assigned = memberIds.includes(p.id);
            return (
              <button
                key={p.id}
                disabled={busy}
                onClick={() => toggleMembre(p.id, assigned)}
                className={
                  assigned
                    ? "rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white"
                    : "rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                }
              >
                {assigned ? "✓ " : "+ "}
                {p.nom ?? "—"}
              </button>
            );
          })}
          {praticiens.length === 0 && <p className="text-xs text-slate-400">Aucun praticien.</p>}
        </div>
      </section>

      {/* Ajouter un patient */}
      <section className="space-y-2 rounded-lg border bg-slate-50 p-3">
        <h2 className="text-sm font-semibold text-slate-600">Ajouter un patient à la tournée</h2>
        <select
          value={addPatient}
          onChange={(e) => setAddPatient(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
        >
          <option value="">Choisir un patient…</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom.toUpperCase()} {p.prenom}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select
            value={addMoment}
            onChange={(e) => setAddMoment(e.target.value)}
            className="flex-1 rounded border border-slate-300 px-2 py-2 text-sm"
          >
            {MOMENTS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            onClick={addToTournee}
            disabled={busy || !addPatient}
            className="rounded bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
        {available.length === 0 && (
          <p className="text-xs text-slate-400">Tous les patients du cabinet sont déjà dans cette tournée.</p>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Patients groupés par moment */}
      {MOMENTS.map((m) => {
        const list = memberships.filter((x) => x.moment === m.key);
        if (list.length === 0) return null;
        return (
          <section key={m.key}>
            <h2 className="mb-2 text-sm font-semibold text-slate-600">
              {m.label} · {list.length}
            </h2>
            <ul className="space-y-2">
              {list.map((mp) => (
                <li key={mp.patient_id} className="rounded-lg border p-3">
                  <Link
                    href={`/patients/${mp.patient_id}`}
                    className="font-medium text-brand-dark"
                  >
                    {mp.patient ? `${mp.patient.nom.toUpperCase()} ${mp.patient.prenom}` : "Patient"}
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <select
                      value={mp.moment}
                      disabled={busy}
                      onChange={(e) => changeMoment(mp.patient_id, e.target.value)}
                      className="rounded border border-slate-300 px-2 py-1"
                    >
                      {MOMENTS.map((mm) => (
                        <option key={mm.key} value={mm.key}>
                          {mm.label}
                        </option>
                      ))}
                    </select>
                    {otherTournees.length > 0 && (
                      <select
                        value=""
                        disabled={busy}
                        onChange={(e) => movePatient(mp.patient_id, e.target.value, mp.moment)}
                        className="rounded border border-slate-300 px-2 py-1"
                      >
                        <option value="">Déplacer vers…</option>
                        {otherTournees.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nom}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => removePatient(mp.patient_id)}
                      disabled={busy}
                      className="rounded border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50"
                    >
                      Retirer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {memberships.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-400">
          Aucun patient dans cette tournée. Ajoutez-en un ci-dessus.
        </p>
      )}
    </div>
  );
}
