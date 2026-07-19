import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ParametresForm from "./parametres-form";
import MembersManager from "./members-manager";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("cabinet_id, role")
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
        <MembersManager
          members={(membres ?? []).map((m) => ({
            id: m.id as string,
            nom_complet: m.nom_complet,
            role: m.role as string,
          }))}
          currentUserId={userData.user!.id}
          isTitulaire={profile?.role === "titulaire"}
        />
      </section>
    </div>
  );
}
