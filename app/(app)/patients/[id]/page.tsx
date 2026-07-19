import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GenerateTransmission from "./generate-transmission";
import PatientTournees from "./patient-tournees";

export const dynamic = "force-dynamic";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function firstOrSelf<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const PERIODS = [
  { key: "48h", label: "48 h", days: 2 },
  { key: "7j", label: "1 semaine", days: 7 },
  { key: "all", label: "Tout", days: null },
] as const;

const MOMENT_LABEL: Record<string, string> = {
  matin: "Matin",
  apres_midi: "Après-midi",
  soir: "Soir",
};

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tp?: string };
}) {
  const supabase = createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("id, nom, prenom, date_naissance, cabinet_id")
    .eq("id", params.id)
    .single();
  if (!patient) notFound();

  const startOfDay = `${todayISO()}T00:00:00`;
  const { data: passages } = await supabase
    .from("passages")
    .select("id, recorded_at, transcript_corrige, transcript_raw, statut")
    .eq("patient_id", params.id)
    .gte("recorded_at", startOfDay)
    .order("recorded_at", { ascending: true });

  const { data: transmission } = await supabase
    .from("transmissions")
    .select("id, texte, statut, format, validee_at")
    .eq("patient_id", params.id)
    .eq("date_soin", todayISO())
    .maybeSingle();

  // Tournées auxquelles appartient le patient
  const { data: tournees } = await supabase
    .from("tournee_patients")
    .select("tournee_id, moment, tournees(nom)")
    .eq("patient_id", params.id);

  // Toutes les tournées du cabinet (pour le gestionnaire)
  const { data: allTournees } = await supabase
    .from("tournees")
    .select("id, nom")
    .order("nom");

  const memberships = (tournees ?? []).map((t) => ({
    tournee_id: t.tournee_id as string,
    moment: t.moment as string,
    nom: firstOrSelf<{ nom: string }>(t.tournees)?.nom ?? "Tournée",
  }));

  // Historique des transmissions validées, filtrable par période
  const active = PERIODS.find((p) => p.key === searchParams.tp) ?? PERIODS[0];
  let histQuery = supabase
    .from("transmissions")
    .select("id, date_soin, texte")
    .eq("patient_id", params.id)
    .eq("statut", "validee")
    .order("date_soin", { ascending: false });
  if (active.days !== null) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - active.days);
    histQuery = histQuery.gte("date_soin", cutoff.toISOString().slice(0, 10));
  }
  const { data: historique } = await histQuery;

  const validatedPassages = (passages ?? []).filter((p) => p.statut === "valide");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/patients" className="text-sm text-slate-400">← Patients</Link>
        <div className="mt-1 rounded-lg border border-brand bg-teal-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-dark">
            Patient
          </p>
          <h1 className="text-xl font-bold leading-tight text-slate-900">
            {patient.nom.toUpperCase()} {patient.prenom}
          </h1>
          <p className="text-xs text-slate-500">Né(e) le {patient.date_naissance ?? "—"}</p>
          {memberships.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {memberships.map((m) => (
                <span
                  key={m.tournee_id}
                  className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-brand-dark ring-1 ring-brand/30"
                >
                  {m.nom} · {MOMENT_LABEL[m.moment] ?? m.moment}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <Link
        href={`/patients/${patient.id}/record`}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-3 font-medium text-white"
      >
        ✍️ Nouvelle dictée
      </Link>

      <PatientTournees
        patientId={patient.id}
        cabinetId={patient.cabinet_id as string}
        memberships={memberships}
        allTournees={(allTournees ?? []).map((t) => ({ id: t.id as string, nom: t.nom as string }))}
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">
          Passages du jour ({(passages ?? []).length})
        </h2>
        <ul className="space-y-2">
          {(passages ?? []).map((p) => (
            <li key={p.id} className="rounded-lg border p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-slate-500">
                  {new Date(p.recorded_at).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span
                  className={
                    p.statut === "valide"
                      ? "rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700"
                      : "rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
                  }
                >
                  {p.statut === "valide" ? "validé" : "brouillon"}
                </span>
              </div>
              <p className="text-slate-700">
                {p.transcript_corrige || p.transcript_raw || <em className="text-slate-400">—</em>}
              </p>
              {p.statut !== "valide" && (
                <Link
                  href={`/patients/${patient.id}/record?passage=${p.id}`}
                  className="mt-1 inline-block text-xs text-brand underline"
                >
                  Relire et valider
                </Link>
              )}
            </li>
          ))}
          {(!passages || passages.length === 0) && (
            <li className="rounded-lg border border-dashed p-4 text-center text-sm text-slate-400">
              Aucun passage aujourd'hui.
            </li>
          )}
        </ul>
      </section>

      <GenerateTransmission
        patientId={patient.id}
        transmission={transmission}
        validatedCount={validatedPassages.length}
      />

      {/* Historique des transmissions (toutes tournées confondues) */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Transmissions</h2>
        <div className="mb-3 flex gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/patients/${patient.id}?tp=${p.key}`}
              className={
                p.key === active.key
                  ? "rounded-full bg-brand px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
              }
            >
              {p.label}
            </Link>
          ))}
        </div>
        <ul className="space-y-2">
          {(historique ?? []).map((h) => (
            <li key={h.id} className="rounded-lg border p-3">
              <div className="mb-1 text-xs font-medium text-slate-400">
                {new Date(h.date_soin).toLocaleDateString("fr-FR")}
              </div>
              <pre className="whitespace-pre-wrap text-sm text-slate-700">{h.texte}</pre>
            </li>
          ))}
          {(!historique || historique.length === 0) && (
            <li className="rounded-lg border border-dashed p-4 text-center text-sm text-slate-400">
              Aucune transmission validée sur cette période.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
