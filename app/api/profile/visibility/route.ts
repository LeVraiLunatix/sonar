import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { setProfileVisibility } from "@/lib/accounts";

/**
 * Rend son propre profil consultable — ou non — par les autres comptes.
 * On n'agit que sur le compte de la session : rien à usurper.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const account = await currentUser();
  if (!account) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }
  let body: { public?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "corps invalide" }, { status: 400 });
  }
  const isPublic = body.public !== false;
  try {
    await setProfileVisibility(account, isPublic);
    return NextResponse.json({ ok: true, public: isPublic });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
