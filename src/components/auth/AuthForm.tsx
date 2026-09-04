"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authResetPath, isSafeInternalNextPath } from "@/lib/auth-return-path";
import {
  clearPendingLegalConsent,
  readPendingLegalConsent,
  stashPendingLegalConsent,
} from "@/lib/legal-consent";
import { markPasswordResetIntent } from "@/lib/password-reset";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthMode = "login" | "signup" | "forgot";

async function flushTermsConsentToServer(): Promise<void> {
  const pending = readPendingLegalConsent();
  if (!pending) return;
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
    /* LegalConsentRecorder will retry from sessionStorage */
  }
}

function parseAuthMode(raw: string | null): AuthMode {
  if (raw === "signup" || raw === "forgot") return raw;
  return "login";
}

export function AuthForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [sanctionsAttested, setSanctionsAttested] = useState(false);
  const [isPending, startTransition] = useTransition();

  const mode = parseAuthMode(searchParams.get("mode"));
  const signUpConsentsReady = legalAccepted && sanctionsAttested;

  const mapAuthError = (message: string) => {
    const msg = message.toLowerCase();
    if (msg.includes("invalid login") || msg.includes("invalid_credentials")) return t("badCreds");
    if (msg.includes("already registered") || msg.includes("user_already_exists")) return t("alreadyRegistered");
    if (msg.includes("password") && (msg.includes("6") || msg.includes("least"))) return t("weakPassword");
    return message;
  };

  const requireSignUpConsents = () => {
    if (!legalAccepted) {
      setError(t("legalConsentRequired"));
      return false;
    }
    if (!sanctionsAttested) {
      setError(t("sanctionsAttestRequired"));
      return false;
    }
    return true;
  };

  const next = useMemo(() => {
    const raw = searchParams.get("next");
    const fallback = `/${locale}`;
    if (!raw) return fallback;
    try {
      const decoded = decodeURIComponent(raw);
      if (isSafeInternalNextPath(decoded) && !decoded.includes("/auth/reset")) return decoded;
    } catch {
      /* ignore malformed % sequences */
    }
    return fallback;
  }, [locale, searchParams]);

  const hrefWithMode = (nextMode: AuthMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextMode === "login") params.delete("mode");
    else params.set("mode", nextMode);
    const q = params.toString();
    return `/${locale}/auth${q ? `?${q}` : ""}`;
  };

  const switchMode = (nextMode: AuthMode) => {
    setError(null);
    setSuccess(null);
    router.replace(hrefWithMode(nextMode), { scroll: false });
  };

  const onSignIn = () => {
    setError(null);
    setSuccess(null);
    if (!email.trim()) {
      setError(t("needEmail"));
      return;
    }
    if (!password) {
      setError(t("needPassword"));
      return;
    }
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError(mapAuthError(error.message));
        return;
      }
      router.replace(next);
      router.refresh();
    });
  };

  const onSignUp = () => {
    setError(null);
    setSuccess(null);
    if (!email.trim()) {
      setError(t("needEmail"));
      return;
    }
    if (!password) {
      setError(t("needPassword"));
      return;
    }
    if (password.length < 6) {
      setError(t("weakPassword"));
      return;
    }
    if (!requireSignUpConsents()) return;
    stashPendingLegalConsent({ sanctionsAttested: true });
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) {
        setError(mapAuthError(error.message));
        return;
      }
      if (data.session) {
        await flushTermsConsentToServer();
        router.replace(next);
        router.refresh();
        return;
      }
      if (data.user) {
        setSuccess(t("signUpConfirmEmail"));
        return;
      }
      setSuccess(t("signUpSuccess"));
    });
  };

  const onForgot = () => {
    setError(null);
    setSuccess(null);
    if (!email.trim()) {
      setError(t("needEmail"));
      return;
    }
    markPasswordResetIntent();
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}${authResetPath(locale)}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) {
        setError(mapAuthError(error.message));
        return;
      }
      setSuccess(t("forgotSent"));
    });
  };

  const title = mode === "forgot" ? t("forgotPassword") : mode === "signup" ? t("signUp") : t("signIn");
  const hint = mode === "forgot" ? t("forgotHint") : undefined;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {hint ? <CardDescription>{hint}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            placeholder="name@example.com"
          />
        </div>
        {mode !== "forgot" ? (
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>
        ) : null}

        {mode === "login" ? (
          <button
            type="button"
            className="text-left text-sm text-muted-foreground underline-offset-2 hover:underline"
            disabled={isPending}
            onClick={() => switchMode("forgot")}
          >
            {t("forgotPassword")}
          </button>
        ) : (
          <button
            type="button"
            className="text-left text-sm text-muted-foreground underline-offset-2 hover:underline"
            disabled={isPending}
            onClick={() => switchMode("login")}
          >
            {t("backToSignIn")}
          </button>
        )}

        {mode === "signup" ? (
          <>
            <label className="flex cursor-pointer gap-3 rounded-xl border bg-white/60 p-3 text-sm leading-snug">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 rounded border-input accent-foreground"
                checked={legalAccepted}
                onChange={(e) => {
                  setLegalAccepted(e.target.checked);
                  if (e.target.checked) setError(null);
                }}
                aria-describedby="auth-legal-consent-desc"
              />
              <span id="auth-legal-consent-desc">
                {t("legalConsentPrefix")}{" "}
                <Link
                  href={`/${locale}/terms`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  {t("legalTermsLink")}
                </Link>
                {t("legalConsentAnd")}{" "}
                <Link
                  href={`/${locale}/privacy`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  {t("legalPrivacyLink")}
                </Link>
                {t("legalConsentSuffix")}
              </span>
            </label>

            <label className="flex cursor-pointer gap-3 rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 text-sm leading-snug">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 rounded border-input accent-foreground"
                checked={sanctionsAttested}
                onChange={(e) => {
                  setSanctionsAttested(e.target.checked);
                  if (e.target.checked && legalAccepted) setError(null);
                }}
                aria-describedby="auth-sanctions-attest-desc"
              />
              <span id="auth-sanctions-attest-desc">{t("sanctionsAttestLabel")}</span>
            </label>
          </>
        ) : null}

        {success ? <div className="text-sm text-emerald-700">{success}</div> : null}
        {error ? <div className="text-sm text-destructive">{error}</div> : null}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {mode === "login" ? (
          <>
            <Button className="w-full" onClick={onSignIn} disabled={isPending}>
              {t("signIn")}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => switchMode("signup")} disabled={isPending}>
              {t("signUp")}
            </Button>
          </>
        ) : null}
        {mode === "signup" ? (
          <>
            <Button className="w-full" onClick={onSignUp} disabled={isPending || !signUpConsentsReady}>
              {t("signUp")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t("legalConsentHint")}</p>
          </>
        ) : null}
        {mode === "forgot" ? (
          <Button className="w-full" onClick={onForgot} disabled={isPending || Boolean(success)}>
            {t("forgotSend")}
          </Button>
        ) : null}
        <Button variant="secondary" className="w-full" onClick={() => router.push(`/${locale}`)} disabled={isPending}>
          {t("close")}
        </Button>
      </CardFooter>
    </Card>
  );
}
