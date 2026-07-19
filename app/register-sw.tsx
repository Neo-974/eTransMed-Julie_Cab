"use client";

import { useEffect } from "react";

// Enregistre le service worker pour rendre l'app installable sur smartphone.
export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
