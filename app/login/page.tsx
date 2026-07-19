import LoginForm from "./login-form";

// Dynamique : évite le pré-rendu statique qui exigerait les variables d'env au build.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm />;
}
