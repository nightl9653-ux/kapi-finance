import type { PendingLegalConsent } from "@/lib/legal-consent";
import { LEGAL_POLICY_VERSION } from "@/lib/site";
import type { SupabaseClient } from "@supabase/supabase-js";

function parseAcceptedAt(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

/** Write first-time terms + optional sanctions attestation on profiles (no overwrite if already set). */
export async function recordTermsConsentOnProfile(
  supabase: SupabaseClient,
  userId: string,
  pending: PendingLegalConsent,
  opts?: { sanctionsAttested?: boolean },
): Promise<{ ok: boolean; alreadyRecorded?: boolean }> {
  if (pending.version !== LEGAL_POLICY_VERSION) {
    return { ok: false };
  }

  const acceptedAt = parseAcceptedAt(pending.acceptedAt);
  const sanctionsAt =
    opts?.sanctionsAttested === true ? parseAcceptedAt(pending.acceptedAt) : undefined;

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("terms_version,terms_accepted_at,sanctions_attested_at")
    .eq("id", userId)
    .maybeSingle();

  if (readError) return { ok: false };

  const termsDone = Boolean(profile?.terms_accepted_at && profile?.terms_version);
  if (termsDone && (!sanctionsAt || profile?.sanctions_attested_at)) {
    return { ok: true, alreadyRecorded: true };
  }

  const patch: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };
  if (!termsDone) {
    patch.terms_version = pending.version;
    patch.terms_accepted_at = acceptedAt;
  }
  if (sanctionsAt && !profile?.sanctions_attested_at) {
    patch.sanctions_attested_at = sanctionsAt;
  }

  const { error: writeError } = await supabase.from("profiles").update(patch).eq("id", userId);

  return { ok: !writeError };
}
