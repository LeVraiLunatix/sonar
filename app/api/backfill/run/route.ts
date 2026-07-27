import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { backfillChunk } from "@/lib/ingest";

// Une tranche d'import par appel : le client rappelle jusqu'à `done`.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const account = await currentUser();
  if (!account) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }
  try {
    const progress = await backfillChunk(account, { maxPages: 10, budgetMs: 20_000 });
    return NextResponse.json(progress);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
