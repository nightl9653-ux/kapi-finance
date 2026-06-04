"use client";

import { useEffect, useRef } from "react";

import {
  clearPendingLegalConsent,
  readPendingLegalConsent,
} from "@/lib/legal-consent";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/** After OAuth or email-confirm login, flush sessionStorage consent to profiles. */
export function LegalConsentRecorder() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const pending = readPendingLegalConsent();
    if (!pending) return;

    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      try {
        const res = await fetch("/api/profile/terms-consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: pending.version,
            acceptedAt: pending.acceptedAt,
            sanctionsAttested: pending.sanctionsAttested === true,
          }),
        });
        if (res.ok) clearPendingLegalConsent();
      } catch {
        /* keep pending for a later navigation */
      }
    })();
  }, []);

  return null;
}
