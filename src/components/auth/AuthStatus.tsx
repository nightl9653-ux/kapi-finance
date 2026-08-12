"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { useHuaweiLikeDevice } from "@/lib/device";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; email: string | null };

export type InitialAuth = { email: string | null } | null;

type AuthContextValue = {
  state: AuthState;
  authHref: string;
  isPending: boolean;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function authFromInitial(initialAuth: InitialAuth | undefined): AuthState {
  if (!isSupabaseConfigured) return { status: "signedOut" };
  if (initialAuth === undefined) return { status: "loading" };
  if (initialAuth === null) return { status: "signedOut" };
  return { status: "signedIn", email: initialAuth.email };
}

function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("Auth components must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ initialAuth, children }: { initialAuth?: InitialAuth; children: ReactNode }) {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AuthState>(() => authFromInitial(initialAuth));
  const authHref = useMemo(() => `/${locale}/auth?force=1`, [locale]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    async function syncAuth() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;

      const sessionUser = sessionData.session?.user;
      if (sessionUser) {
        setState({ status: "signedIn", email: sessionUser.email ?? null });
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setState(data.user ? { status: "signedIn", email: data.user.email ?? null } : { status: "signedOut" });
    }

    void syncAuth();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session?.user ? { status: "signedIn", email: session.user.email ?? null } : { status: "signedOut" });
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = () => {
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace(authHref);
      router.refresh();
    });
  };

  return <AuthContext.Provider value={{ state, authHref, isPending, signOut }}>{children}</AuthContext.Provider>;
}

export function AuthUserEmail({ placement }: { placement: "header" | "menu" }) {
  const { state } = useAuthContext();

  if (state.status !== "signedIn" || !state.email) {
    return null;
  }

  if (placement === "menu") {
    return (
      <div className="border-b border-border/60 px-4 py-2.5">
        <p className="truncate text-xs text-muted-foreground" title={state.email}>
          {state.email}
        </p>
      </div>
    );
  }

  return (
    <span
      className="hidden max-w-[220px] shrink-0 truncate text-xs text-muted-foreground md:inline"
      title={state.email}
    >
      {state.email}
    </span>
  );
}

export function AuthStatus() {
  const t = useTranslations("auth");
  const { state, authHref, isPending, signOut } = useAuthContext();
  const huaweiLike = useHuaweiLikeDevice();

  if (state.status === "loading") {
    return (
      <Button
        variant="secondary"
        size="sm"
        className={cn("shrink-0 rounded-full", huaweiLike && "px-2.5")}
        disabled
      >
        {t("loading")}
      </Button>
    );
  }

  if (state.status === "signedOut") {
    return (
      <Link
        href={authHref}
        className={cn(
          buttonVariants({ variant: "secondary", size: "sm" }),
          "shrink-0 rounded-full",
          huaweiLike && "px-2.5",
        )}
      >
        {t("signIn")}
      </Link>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      className={cn("shrink-0 rounded-full", huaweiLike && "px-2.5")}
      onClick={signOut}
      disabled={isPending}
    >
      {t("signOut")}
    </Button>
  );
}
