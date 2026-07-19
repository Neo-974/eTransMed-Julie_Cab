import RegisterForm from "./register-form";

// Dynamique : évite le pré-rendu statique qui exigerait les variables d'env au build.
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return <RegisterForm />;
}
