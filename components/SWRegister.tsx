"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker en PRODUCTION uniquement.
 * En développement, un SW met en cache les bundles (qui changent à chaque
 * Fast Refresh) et casse l'hydratation → on désenregistre tout SW existant
 * et on vide les caches pour repartir propre.
 */
export default function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    } else {
      navigator.serviceWorker
        .getRegistrations()
        .then((rs) => rs.forEach((r) => r.unregister()))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
      }
    }
  }, []);
  return null;
}
