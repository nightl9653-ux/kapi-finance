import { NextResponse } from "next/server";

import type { PendingLegalConsent } from "@/lib/legal-consent";
import { LEGAL_POLICY_VERSION } from "@/lib/site";
import { recordTermsConsentOnProfile } from "@/lib/record-terms-consent-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  version?: string;
  acceptedAt?: string;
  sanctionsAttested?: boolean;
};

/** Persist terms acceptance on the authenticated user's profile (first accept only). */
export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const version = String(body.version ?? "").trim();
  if (version !== LEGAL_POLICY_VERSION) {
    return NextResponse.json({ ok: false, error: "version_mismatch" }, { status: 400 });
  }

  const acceptedAt = String(body.acceptedAt ?? "").trim();
  if (!acceptedAt) {
    return NextResponse.json({ ok: false, error: "invalid_accepted_at" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const pending: PendingLegalConsent = {
    version,
    acceptedAt,
    ...(body.sanctionsAttested === true ? { sanctionsAttested: true } : {}),
  };
  const result = await recordTermsConsentOnProfile(supabase, auth.user.id, pending, {
    sanctionsAttested: body.sanctionsAttested === true,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    alreadyRecorded: result.alreadyRecorded ?? false,
    version,
    acceptedAt,
  });
}
