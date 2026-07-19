// Service worker minimal — rend l'app installable (PWA). Pas de cache offline
// pour l'instant (les données de santé ne doivent pas persister côté client).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Passe-plat : on laisse le navigateur gérer les requêtes normalement.
});
