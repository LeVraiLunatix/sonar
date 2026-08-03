"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseStreamingHistoryFile, type ParsedPlay } from "@/lib/spotify-import";

const BATCH_SIZE = 1000;

type State =
  | { status: "idle" }
  | { status: "running"; filesDone: number; filesTotal: number; imported: number }
  | { status: "done"; imported: number }
  | { status: "error"; message: string; imported: number };

/**
 * Import de l'export RGPD Spotify : chaque fichier .json est lu et parsé
 * DANS LE NAVIGATEUR (lib/spotify-import.ts), puis envoyé par lots normalisés
 * — jamais le fichier brut d'un coup, pour rester sous la limite de taille
 * d'une requête serverless quel que soit le nombre d'années d'historique.
 */
export default function SpotifyImportRunner() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "idle" });

  async function sendBatch(plays: ParsedPlay[]): Promise<number> {
    const res = await fetch("/api/spotify/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plays }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { inserted: number };
    return data.inserted;
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    let imported = 0;
    setState({ status: "running", filesDone: 0, filesTotal: files.length, imported: 0 });

    try {
      for (let i = 0; i < files.length; i++) {
        const text = await files[i].text();
        let raw: unknown;
        try {
          raw = JSON.parse(text);
        } catch {
          throw new Error(`${files[i].name} : JSON invalide`);
        }
        const plays = parseStreamingHistoryFile(raw);
        for (let j = 0; j < plays.length; j += BATCH_SIZE) {
          const batch = plays.slice(j, j + BATCH_SIZE);
          imported += await sendBatch(batch);
          setState({ status: "running", filesDone: i, filesTotal: files.length, imported });
        }
        setState({ status: "running", filesDone: i + 1, filesTotal: files.length, imported });
      }
      setState({ status: "done", imported });
      router.refresh();
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "erreur inconnue",
        imported,
      });
    }
  }

  if (state.status === "running") {
    return (
      <div className="onb">
        <p className="ann__label">
          import en cours · fichier {state.filesDone}/{state.filesTotal}
        </p>
        <p className="prose">
          {state.imported.toLocaleString("fr-FR")} écoutes importées pour l’instant…
        </p>
      </div>
    );
  }

  if (state.status === "done") {
    return (
      <p className="prose">
        {state.imported.toLocaleString("fr-FR")} écoutes importées. Ton archive Spotify est prête
        — <a href="/all">voir depuis toujours</a>.
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div>
        <p className="login__error mono" role="alert">
          import interrompu : {state.message}
          <br />
          {state.imported.toLocaleString("fr-FR")} écoutes déjà importées avant l’arrêt — pas de
          doublons si tu relances, l’import est idempotent.
        </p>
        <label className="btn btn--ghost" style={{ cursor: "pointer", marginTop: "0.9rem" }}>
          réessayer
          <input
            type="file"
            accept="application/json"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            style={{ display: "none" }}
          />
        </label>
      </div>
    );
  }

  return (
    <>
      <label className="btn btn--solid" style={{ cursor: "pointer" }}>
        Choisir les fichiers .json
        <input
          type="file"
          accept="application/json"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: "none" }}
        />
      </label>
      <p className="note" style={{ marginTop: "0.75rem" }}>
        Sélectionne tous les fichiers <code>Streaming_History_Audio_*.json</code> (ou
        l’ancien <code>StreamingHistory*.json</code>) reçus dans l’export Spotify.
      </p>
    </>
  );
}
