import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { getAccount } from "@/lib/accounts";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await currentUser();
  if (!account) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }
  const acc = await getAccount(account);
  if (!acc) return NextResponse.json({ status: "pending", page: 0, pages: null });
  return NextResponse.json({
    status: acc.backfill_status,
    page: acc.backfill_page,
    pages: acc.backfill_pages,
    error: acc.backfill_error,
  });
}
