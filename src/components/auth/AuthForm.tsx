"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSafeInternalNextPath } from "@/lib/auth-return-path";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AuthForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const next = useMemo(() => {
    const raw = searchParams.get("next");
    const fallback = `/${locale}`;
    if (!raw) return fallback;
    try {
      const decoded = decodeURIComponent(raw);
      if (isSafeInternalNextPath(decoded)) return decoded;
    } catch {
      /* ignore malformed % sequences */
    }
    return fallback;
  }, [locale, searchParams]);

  const onSignIn = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      router.replace(next);
      router.refresh();
    });
  };

  const onSignUp = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      setSuccess("Check your email to confirm your account.");
    });
  };

  const onGoogle = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/${locale}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) setError(error.message);
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
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
        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {success ? <div className="text-sm text-emerald-700">{success}</div> : null}
        {error ? <div className="text-sm text-destructive">{error}</div> : null}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button className="w-full" onClick={onSignIn} disabled={isPending}>
          {t("signIn")}
        </Button>
        <Button variant="secondary" className="w-full" onClick={onSignUp} disabled={isPending}>
          {t("signUp")}
        </Button>
        <Button variant="outline" className="w-full" onClick={onGoogle} disabled={isPending}>
          {t("continueWithGoogle")}
        </Button>
      </CardFooter>
    </Card>
  );
}

