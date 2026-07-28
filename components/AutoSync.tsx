"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Récupère les nouveaux scrobbles pendant que le site est ouvert.
 *
 * Le cron Vercel ne passe qu'une fois par jour : sans ça, le compteur, les
 * derniers scrobbles et les stats du jour resteraient figés entre deux passages.
 * On déclenche donc un sync léger à l'ouverture, puis à intervalle régulier et
 * au retour sur l'onglet. La page n'est rafraîchie que si quelque chose de
 * nouveau est réellement arrivé — sinon on ne touche à rien.
 */
export default function AutoSync({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const busy = useRef(false);

  const sync = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch("/api/sync/self", { method: "POST", cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { inserted?: number };
      if (data.inserted && data.inserted > 0) {
        // recharge les données côté serveur (compteur, récents, stats du jour)
        router.refresh();
      }
    } catch {
      /* silencieux : le cron reste le filet de sécurité */
    } finally {
      busy.current = false;
    }
  }, [router]);

  useEffect(() => {
    sync();
    const id = setInterval(sync, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sync, intervalMs]);

  return null;
}
