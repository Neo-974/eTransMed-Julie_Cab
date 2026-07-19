import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PERIODS = [
  { key: "48h", label: "48 h", days: 2 },
  { key: "7j", label: "1 semaine", days: 7 },
  { key: "all", label: "Tout", days: null },
] as const;

// Toutes les transmissions validées du cabinet (visibilité partagée V1),
// filtrables par période : 48 h / 1 semaine / tout.
export default async function TransmissionsPage({
  searchParams,
}: {
  searchParams: { p?: string };
}) {
  const supabase = createClient();

  const active =
    PERIODS.find((p) => p.key === searchParams.p) ?? PERIODS[0]; // défaut : 48 h

  let query = supabase
    .from("transmissions")
    .select("id, date_soin, texte, statut, patient_id, patients(nom, prenom)")
    .eq("statut", "validee")
    .order("date_soin", { ascending: false });

  if (active.days !== null) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - active.days);
    query = query.gte("date_soin", cutoff.toISOString().slice(0, 10));
  }

  const { data: transmissions } = await query;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Transmissions validées</h1>

      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/transmissions?p=${p.key}`}
            className={
              p.key === active.key
                ? "rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white"
                : "rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            }
          >
            {p.label}
          </Link>
        ))}
      </div>

      <ul className="space-y-3">
        {(transmissions ?? []).map((t) => {
          const patient = (Array.isArray(t.patients) ? t.patients[0] : t.patients) as
            | { nom: string; prenom: string }
            | null;
          return (
            <li key={t.id} className="overflow-hidden rounded-lg border">
              <Link
                href={`/patients/${t.patient_id}`}
                className="flex items-center justify-between gap-2 bg-teal-50 px-4 py-2.5 hover:bg-teal-100"
              >
                <span className="text-base font-bold text-brand-dark">
                  {patient ? `${patient.nom.toUpperCase()} ${patient.prenom}` : "Patient"}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {new Date(t.date_soin).toLocaleDateString("fr-FR")}
                </span>
              </Link>
              <pre className="whitespace-pre-wrap px-4 py-3 text-sm text-slate-700">{t.texte}</pre>
            </li>
          );
        })}
        {(!transmissions || transmissions.length === 0) && (
          <li className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-400">
            Aucune transmission validée sur cette période.
          </li>
        )}
      </ul>
    </div>
  );
}
