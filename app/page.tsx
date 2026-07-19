import { redirect } from "next/navigation";

// La logique d'auth est gérée par le middleware ; on redirige vers l'accueil.
export default function Home() {
  redirect("/accueil");
}
