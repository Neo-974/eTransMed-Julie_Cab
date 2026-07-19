import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Transcription audio -> texte pour la version test (données fictives).
// Moteur configurable par variable d'env. Sans clé, renvoie une chaîne vide :
// l'IDE saisit/corrige alors le texte manuellement.
export async function POST(request: Request) {
  const provider = process.env.TRANSCRIPTION_PROVIDER;
  const apiKey = process.env.OPENAI_API_KEY;

  if (provider !== "openai" || !apiKey) {
    return NextResponse.json({
      text: "",
      note: "Aucun moteur de transcription configuré — saisie manuelle.",
    });
  }

  try {
    const incoming = await request.formData();
    const audio = incoming.get("audio");
    if (!(audio instanceof Blob)) {
      return NextResponse.json({ error: "Fichier audio manquant" }, { status: 400 });
    }

    const body = new FormData();
    body.append("file", audio, "passage.webm");
    body.append("model", "whisper-1");
    body.append("language", "fr");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: "Transcription échouée", detail }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json({ text: data.text ?? "" });
  } catch (e) {
    return NextResponse.json(
      { error: "Erreur transcription", detail: String(e) },
      { status: 500 }
    );
  }
}
