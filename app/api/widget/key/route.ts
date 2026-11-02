import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { signWidgetKey } from "@/lib/widget";

/**
 * Donne sa clé de widget au compte de la session (et à lui seul).
 * La clé est déterministe : la redemander rend la même.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  const account = await currentUser();
  if (!account) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }
  const key = await signWidgetKey(account);
  if (!key) {
    return NextResponse.json({ error: "secret serveur manquant" }, { status: 500 });
  }
  return NextResponse.json({ key });
}
