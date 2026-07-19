import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "eTransMed — Transmissions infirmières",
    short_name: "eTransMed",
    description: "Transmissions vocales pour infirmiers libéraux (version test)",
    start_url: "/accueil",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6faf9",
    theme_color: "#0d9488",
    lang: "fr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
