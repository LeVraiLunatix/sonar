import { NextResponse } from "next/server";
import { resolveAccount } from "@/lib/session";
import { clearSpotifyTokens } from "@/lib/accounts";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const account = await resolveAccount();
  if (account) {
    await clearSpotifyTokens(account);
  }
  return NextResponse.redirect(new URL("/spotify", origin), { status: 303 });
}
