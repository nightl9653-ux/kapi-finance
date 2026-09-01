import { NextResponse } from "next/server";

import { artCorsHeaders } from "@/lib/art-origins";

export function artOptions(req: Request) {
  const headers = artCorsHeaders(req);
  if (!req.headers.get("origin") || Object.keys(headers).length === 0) {
    return new NextResponse(null, { status: 204 });
  }
  return new NextResponse(null, { status: 204, headers });
}

export function artJson(req: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: artCorsHeaders(req) });
}
