import { createClient } from "@/lib/supabase/server";
import Recorder from "./recorder";

export const dynamic = "force-dynamic";

export default async function RecordPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { passage?: string };
}) {
  const supabase = createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("nom, prenom")
    .eq("id", params.id)
    .single();

  let existing = null;
  if (searchParams.passage) {
    const { data } = await supabase
      .from("passages")
      .select("id, transcript_raw, transcript_corrige")
      .eq("id", searchParams.passage)
      .maybeSingle();
    existing = data;
  }

  return (
    <Recorder
      patientId={params.id}
      patientName={patient ? `${patient.nom.toUpperCase()} ${patient.prenom}` : ""}
      existing={existing}
    />
  );
}
