import { NextResponse } from "next/server";

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { rate: number; expiresAt: number }>();

function key(from: string, to: string) {
  return `${from}->${to}`.toUpperCase();
}

function isCode(v: string) {
  return /^[A-Z]{3}$/.test(v);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = String(url.searchParams.get("from") ?? "")
    .trim()
    .toUpperCase();
  const to = String(url.searchParams.get("to") ?? "")
    .trim()
    .toUpperCase();

  if (!isCode(from) || !isCode(to) || from === to) {
    return NextResponse.json({ ok: false, error: "bad_params" }, { status: 400 });
  }

  const k = key(from, to);
  const now = Date.now();
  const hit = cache.get(k);
  if (hit && hit.expiresAt > now) {
    return NextResponse.json({ ok: true, from, to, rate: hit.rate, cached: true });
  }

  // Frankfurter: free, no key for latest rates
  const api = new URL("https://api.frankfurter.app/latest");
  api.searchParams.set("from", from);
  api.searchParams.set("to", to);

  const res = await fetch(api.toString(), { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "upstream_failed" }, { status: 502 });
  }
  const data = (await res.json().catch(() => null)) as null | { rates?: Record<string, number> };
  const rate = data?.rates?.[to];
  if (!Number.isFinite(rate) || !rate || rate <= 0) {
    return NextResponse.json({ ok: false, error: "bad_rate" }, { status: 502 });
  }

  cache.set(k, { rate, expiresAt: now + TTL_MS });
  return NextResponse.json({ ok: true, from, to, rate, cached: false });
}

