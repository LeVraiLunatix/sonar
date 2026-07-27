import { NextResponse } from "next/server";
import { runIncremental } from "@/lib/ingest";

// Appelé par Vercel Cron toutes les 30 min (voir vercel.json).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  // Vercel Cron envoie "Authorization: Bearer <CRON_SECRET>"
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const inserted = await runIncremental(() => {});
    return NextResponse.json({ ok: true, inserted });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
