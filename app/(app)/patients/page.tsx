import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AddPatientForm from "./add-patient-form";

export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  const supabase = createClient();
  const { data: patients } = await supabase
    .from("patients")
    .select("id, nom, prenom, date_naissance")
    .order("nom", { ascending: true })
    .order("prenom", { ascending: true });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Patients</h1>
        <span className="text-sm text-slate-400">{patients?.length ?? 0}</span>
      </div>

      <AddPatientForm />

      <ul className="divide-y rounded-lg border">
        {(patients ?? []).map((p) => (
          <li key={p.id}>
            <Link
              href={`/patients/${p.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
            >
              <span>
                <span className="font-medium">{p.nom.toUpperCase()}</span> {p.prenom}
              </span>
              <span className="text-xs text-slate-400">
                {p.date_naissance ?? "—"}
              </span>
            </Link>
          </li>
        ))}
        {(!patients || patients.length === 0) && (
          <li className="px-4 py-6 text-center text-sm text-slate-400">
            Aucun patient. Ajoutez-en un ci-dessus.
          </li>
        )}
      </ul>
    </div>
  );
}
