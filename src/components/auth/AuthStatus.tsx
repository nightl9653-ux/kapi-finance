"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; email: string | null };

export function AuthStatus() {
  const locale = useLocale();
  const t = useTranslations("auth");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AuthState>(() =>
    isSupabaseConfigured ? { status: "loading" } : { status: "signedOut" },
  );

  const authHref = useMemo(() => `/${locale}/auth?force=1`, [locale]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return;
        setState(data.user ? { status: "signedIn", email: data.user.email ?? null } : { status: "signedOut" });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "signedOut" });
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session?.user ? { status: "signedIn", email: session.user.email ?? null } : { status: "signedOut" });
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSignOut = () => {
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace(authHref);
      router.refresh();
    });
  };

  if (state.status === "loading") {
    return (
      <Button variant="secondary" size="sm" className="rounded-full" disabled>
        {t("loading")}
      </Button>
    );
  }

  if (state.status === "signedOut") {
    return (
      <Link
        href={authHref}
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "rounded-full")}
      >
        {t("signIn")}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden max-w-[220px] truncate text-xs text-muted-foreground sm:block">
        {state.email ?? ""}
      </div>
      <Button variant="secondary" size="sm" className="rounded-full" onClick={onSignOut} disabled={isPending}>
        {t("signOut")}
      </Button>
    </div>
  );
}

