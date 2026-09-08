"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { foldPassword } from "@/lib/auth-fold";
import { consumeAuthLink } from "@/lib/auth-link";
import { authRecoverPath } from "@/lib/auth-return-path";
import { clearPasswordResetIntent } from "@/lib/password-reset";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ResetPasswordForm({ hasSession: initialHasSession }: { hasSession: boolean }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(initialHasSession);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash");
    const code = searchParams.get("code");
    if (tokenHash || code) {
      const recover = new URL(authRecoverPath(locale), window.location.origin);
      recover.searchParams.set("token_hash", tokenHash ?? "");
      recover.searchParams.set("type", searchParams.get("type") || "recovery");
      if (code) recover.searchParams.set("code", code);
      if (!tokenHash) recover.searchParams.delete("token_hash");
      window.location.replace(recover.toString());
      return;
    }

    if (searchParams.get("invalid") === "1") {
      setError(t("resetNeedSession"));
      setHasSession(false);
      setReady(true);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    void consumeAuthLink(supabase)
      .then(async (result) => {
        if (result.error) {
          setError(t("resetNeedSession"));
        }
        const { data } = await supabase.auth.getSession();
        setHasSession(Boolean(data.session) || result.ok);
      })
      .catch(() => {
        setHasSession(false);
      })
      .finally(() => setReady(true));
  }, [locale, searchParams, t]);

  const onSave = () => {
    setError(null);
    if (!password || password.length < 6) {
      setError(t("weakPassword"));
      return;
    }
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password: foldPassword(password) });
      if (updateError) {
        const msg = updateError.message.toLowerCase();
        setError(msg.includes("password") || msg.includes("6") ? t("weakPassword") : t("resetNeedSession"));
        return;
      }
      clearPasswordResetIntent();
      setDone(true);
      router.replace(`/${locale}`);
      router.refresh();
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("resetTitle")}</CardTitle>
        {!ready ? <CardDescription>{t("loading")}</CardDescription> : null}
        {ready && hasSession && !done ? <CardDescription>{t("resetHint")}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {ready && !hasSession ? <div className="text-sm text-destructive">{error || t("resetNeedSession")}</div> : null}
        {done ? <div className="text-sm text-emerald-700">{t("resetOk")}</div> : null}
        {ready && hasSession && !done ? (
          <div className="space-y-2">
            <Label htmlFor="new-password">{t("newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
            />
          </div>
        ) : null}
        {ready && hasSession && error ? <div className="text-sm text-destructive">{error}</div> : null}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {ready && !hasSession ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.replace(`/${locale}/auth?mode=forgot`)}
            disabled={isPending}
          >
            {t("forgotPassword")}
          </Button>
        ) : null}
        {ready && hasSession && !done ? (
          <Button className="w-full" onClick={onSave} disabled={isPending}>
            {t("resetSave")}
          </Button>
        ) : null}
        <Button variant="secondary" className="w-full" onClick={() => router.push(`/${locale}`)} disabled={isPending}>
          {t("close")}
        </Button>
      </CardFooter>
    </Card>
  );
}
