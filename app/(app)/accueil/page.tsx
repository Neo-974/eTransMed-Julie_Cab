import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreateTournee from "./create-tournee";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  titulaire: "Titulaire",
  collaborateur: "Collaborateur",
  remplacant: "Remplaçant",
};

function firstOrSelf<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function AccueilPage() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("cabinet_id, cabinets(nom)")
    .eq("id", userData.user!.id)
    .single();
  const cabinetNom = firstOrSelf<{ nom: string }>(profile?.cabinets)?.nom ?? "Cabinet";

  const { data: praticiens } = await supabase
    .from("profiles")
    .select("id, nom_complet, role")
    .order("nom_complet");

  const { data: tournees } = await supabase
    .from("tournees")
    .select("id, nom, description, tournee_patients(count), tournee_membres(count)")
    .order("nom");

  return (
    <div className="space-y-6">
      {/* Cabinet */}
      <section className="rounded-xl border border-brand bg-teal-50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-dark">
            Cabinet infirmier
          </p>
          <Link href="/parametres" className="text-xs font-medium text-brand-dark hover:underline">
            ⚙️ Paramètres
          </Link>
        </div>
        <h1 className="text-2xl font-bold leading-tight text-slate-900">{cabinetNom}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {praticiens?.length ?? 0} praticien{(praticiens?.length ?? 0) > 1 ? "s" : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(praticiens ?? []).map((p) => (
            <span
              key={p.id}
              className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
            >
              {p.nom_complet ?? "—"}
              <span className="ml-1 text-slate-400">· {ROLE_LABEL[p.role] ?? p.role}</span>
            </span>
          ))}
        </div>
      </section>

      {/* Tournées */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tournées</h2>
          <span className="text-sm text-slate-400">{tournees?.length ?? 0}</span>
        </div>

        <CreateTournee />

        <ul className="space-y-2">
          {(tournees ?? []).map((t) => {
            const nbPatients = firstOrSelf<{ count: number }>(t.tournee_patients)?.count ?? 0;
            const nbMembres = firstOrSelf<{ count: number }>(t.tournee_membres)?.count ?? 0;
            return (
              <li key={t.id}>
                <Link
                  href={`/tournees/${t.id}`}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-slate-50"
                >
                  <span>
                    <span className="block font-semibold text-slate-900">{t.nom}</span>
                    {t.description && (
                      <span className="block text-xs text-slate-500">{t.description}</span>
                    )}
                  </span>
                  <span className="flex flex-col items-end text-xs text-slate-500">
                    <span>👤 {nbPatients} patient{nbPatients > 1 ? "s" : ""}</span>
                    <span>🩺 {nbMembres} praticien{nbMembres > 1 ? "s" : ""}</span>
                  </span>
                </Link>
              </li>
            );
          })}
          {(!tournees || tournees.length === 0) && (
            <li className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-400">
              Aucune tournée. Créez-en une ci-dessus.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
