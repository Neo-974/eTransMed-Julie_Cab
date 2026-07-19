import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nom_complet, cabinet_id, cabinets(nom)")
    .eq("id", user.id)
    .single();

  // Profil sans cabinet : compte incomplet, on renvoie vers l'inscription.
  if (!profile?.cabinet_id) redirect("/register");

  const cab = Array.isArray(profile.cabinets) ? profile.cabinets[0] : profile.cabinets;
  const cabinetNom = (cab as { nom: string } | null)?.nom ?? "Cabinet";

  return (
    <div className="mx-auto min-h-screen max-w-md bg-white shadow-sm">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
        <Link href="/accueil" className="flex items-center gap-2 font-bold text-brand-dark" aria-label="Accueil">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm text-white">🏠</span>
          eTransMed
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">{cabinetNom}</span>
          <SignOutButton />
        </div>
      </header>

      <div className="bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">
        Version test — données fictives uniquement (non-HDS)
      </div>

      <nav className="flex border-b text-sm">
        <Link href="/accueil" className="flex-1 py-2 text-center hover:bg-slate-50">Accueil</Link>
        <Link href="/patients" className="flex-1 py-2 text-center hover:bg-slate-50">Patients</Link>
        <Link href="/transmissions" className="flex-1 py-2 text-center hover:bg-slate-50">Transmissions</Link>
      </nav>

      <main className="px-4 py-4">{children}</main>
    </div>
  );
}
