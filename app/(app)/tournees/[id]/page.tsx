import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TourneeClient from "./tournee-client";

export const dynamic = "force-dynamic";

function firstOrSelf<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function TourneePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: tournee } = await supabase
    .from("tournees")
    .select("id, nom, description, cabinet_id")
    .eq("id", params.id)
    .single();
  if (!tournee) notFound();

  const { data: memberships } = await supabase
    .from("tournee_patients")
    .select("patient_id, moment, patients(nom, prenom)")
    .eq("tournee_id", params.id);

  const { data: members } = await supabase
    .from("tournee_membres")
    .select("profile_id")
    .eq("tournee_id", params.id);

  const { data: allPatients } = await supabase
    .from("patients")
    .select("id, nom, prenom")
    .order("nom")
    .order("prenom");

  const { data: praticiens } = await supabase
    .from("profiles")
    .select("id, nom_complet")
    .order("nom_complet");

  const { data: otherTournees } = await supabase
    .from("tournees")
    .select("id, nom")
    .neq("id", params.id)
    .order("nom");

  const mem = (memberships ?? []).map((m) => ({
    patient_id: m.patient_id as string,
    moment: m.moment as string,
    patient: firstOrSelf<{ nom: string; prenom: string }>(m.patients),
  }));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/accueil" className="text-sm text-slate-400">← Accueil</Link>
        <div className="mt-1 rounded-lg border border-brand bg-teal-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-dark">Tournée</p>
          <h1 className="text-xl font-bold leading-tight text-slate-900">{tournee.nom}</h1>
          {tournee.description && <p className="text-xs text-slate-500">{tournee.description}</p>}
        </div>
      </div>

      <TourneeClient
        tourneeId={tournee.id}
        cabinetId={tournee.cabinet_id}
        memberships={mem}
        allPatients={allPatients ?? []}
        memberIds={(members ?? []).map((m) => m.profile_id as string)}
        praticiens={(praticiens ?? []).map((p) => ({ id: p.id as string, nom: p.nom_complet as string }))}
        otherTournees={(otherTournees ?? []).map((t) => ({ id: t.id as string, nom: t.nom as string }))}
      />
    </div>
  );
}
