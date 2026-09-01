import { NextResponse } from "next/server";

export const PLUS_REQUIRED = "plus_required";

export function plusRequiredJson(limit = 0) {
  return NextResponse.json({ ok: false, error: PLUS_REQUIRED, limit }, { status: 403 });
}
