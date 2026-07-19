import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ParametresForm from "./parametres-form";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  titulaire: "Titulaire",
  collaborateur: "Collaborateur",
  remplacant: "Remplaçant",
};

export default async function ParametresPage() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("cabinet_id")
    .eq("id", userData.user!.id)
    .single();

  const { data: cabinet } = await supabase
    .from("cabinets")
    .select("id, nom, description, code_invitation")
    .eq("id", profile!.cabinet_id)
    .single();

  const { data: membres } = await supabase
    .from("profiles")
    .select("id, nom_complet, role")
    .order("nom_complet");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/accueil" className="text-sm text-slate-400">← Accueil</Link>
        <h1 className="mt-1 text-lg font-semibold">Paramètres du cabinet</h1>
      </div>

      <ParametresForm
        cabinetId={cabinet?.id as string}
        nom={cabinet?.nom ?? ""}
        description={cabinet?.description ?? ""}
        codeInvitation={cabinet?.code_invitation ?? "—"}
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">
          Praticiens du cabinet ({membres?.length ?? 0})
        </h2>
        <ul className="divide-y rounded-lg border">
          {(membres ?? []).map((m) => (
            <li key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-medium">{m.nom_complet ?? "—"}</span>
              <span className="text-xs text-slate-500">{ROLE_LABEL[m.role] ?? m.role}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
