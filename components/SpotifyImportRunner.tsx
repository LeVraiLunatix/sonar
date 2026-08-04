"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { unzipSync } from "fflate";
import { parseStreamingHistoryFile, type ParsedPlay } from "@/lib/spotify-import";

const BATCH_SIZE = 1000;
const ACCEPT = ".json,.zip,application/json,application/zip,application/x-zip-compressed";

type State =
  | { status: "idle" }
  | { status: "running"; filesDone: number; filesTotal: number; imported: number }
  | { status: "done"; imported: number }
  | { status: "error"; message: string; imported: number };

/**
 * Fichiers .json à parser pour un fichier choisi. Spotify envoie l'export en
 * .zip : on l'extrait DANS LE NAVIGATEUR (fflate) et on ne garde que les
 * entrées .json — README, paiements, etc. sont ignorés (parseStreamingHistoryFile
 * renvoie [] pour tout ce qui n'a pas la forme d'un historique d'écoute).
 */
async function jsonEntriesOf(file: File): Promise<{ name: string; text: string }[]> {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return [{ name: file.name, text: await file.text() }];
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(bytes, {
    filter: (entry) => entry.name.toLowerCase().endsWith(".json"),
  });
  const decoder = new TextDecoder();
  return Object.entries(entries).map(([name, data]) => ({ name, text: decoder.decode(data) }));
}

/**
 * Import de l'export RGPD Spotify (.zip ou .json déjà extraits) : tout est lu
 * et parsé DANS LE NAVIGATEUR (lib/spotify-import.ts), puis envoyé par lots
 * normalisés — jamais un fichier brut d'un coup, pour rester sous la limite
 * de taille d'une requête serverless quel que soit le nombre d'années.
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
        let entries: { name: string; text: string }[];
        try {
          entries = await jsonEntriesOf(files[i]);
        } catch {
          throw new Error(`${files[i].name} : archive illisible`);
        }

        for (const entry of entries) {
          let raw: unknown;
          try {
            raw = JSON.parse(entry.text);
          } catch {
            continue; // fichier non pertinent dans l'export (pas un historique) : ignoré
          }
          const plays = parseStreamingHistoryFile(raw);
          for (let j = 0; j < plays.length; j += BATCH_SIZE) {
            const batch = plays.slice(j, j + BATCH_SIZE);
            imported += await sendBatch(batch);
            setState({ status: "running", filesDone: i, filesTotal: files.length, imported });
          }
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
            accept={ACCEPT}
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
        Choisir le fichier .zip (ou les .json)
        <input
          type="file"
          accept={ACCEPT}
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: "none" }}
        />
      </label>
      <p className="note" style={{ marginTop: "0.75rem" }}>
        Dépose directement le <code>.zip</code> reçu par e-mail — il est
        décompressé dans ton navigateur, rien n’est envoyé tel quel. Tu peux
        aussi sélectionner des fichiers <code>.json</code> déjà extraits.
      </p>
    </>
  );
}
