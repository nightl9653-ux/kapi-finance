"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/locales";

type Msg = { role: "user" | "assistant"; content: string };

function errorText(t: (key: string) => string, code: string): string {
  const m: Record<string, string> = {
    unauthenticated: t("errors.unauthenticated"),
    openai_unconfigured: t("errors.openai_unconfigured"),
    supabase_not_configured: t("errors.supabase_not_configured"),
    rate_limit: t("errors.rate_limit"),
    bad_messages: t("errors.bad_messages"),
    bad_json: t("errors.bad_messages"),
    openai_failed: t("errors.openai_failed"),
    usage_write_failed: t("errors.usage_write_failed"),
    usage_query_failed: t("errors.unknown"),
  };
  return m[code] ?? t("errors.unknown");
}

export function AIAssistantChat({ locale }: { locale: Locale }) {
  const t = useTranslations("aiAssistantPage");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || pending) return;

    const nextUser: Msg = { role: "user", content: text };
    const history = [...messages, nextUser];
    setInput("");
    setErrorKey(null);
    setPending(true);
    setMessages((m) => [...m, nextUser]);

    try {
      const res = await fetch("/api/ai-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = (await res.json().catch(() => null)) as null | {
        ok?: boolean;
        message?: string;
        error?: string;
        remaining?: number;
        limit?: number;
      };

      if (!res.ok || !data?.ok || typeof data.message !== "string") {
        const code = data?.error ?? "unknown";
        setErrorKey(code);
        setMessages((m) => m.slice(0, -1));
        return;
      }

      const reply = String(data.message ?? "").trim();
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
    } catch {
      setErrorKey("network");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setPending(false);
    }
  }, [input, pending, messages, locale]);

  return (
    <div className="flex flex-col gap-3">
      {remaining !== null ? (
        <p className="text-xs text-muted-foreground">
          {t("quotaHint", { remaining })}
        </p>
      ) : null}

      <div
        ref={listRef}
        className={cn(
          "max-h-[min(420px,55vh)] overflow-y-auto rounded-xl border bg-white/80 p-4",
          messages.length === 0 ? "min-h-0 py-6" : "min-h-[160px] space-y-3",
        )}
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">{t("chatEmpty")}</p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                m.role === "user"
                  ? "ml-8 border border-primary/20 bg-primary/5 text-foreground"
                  : "mr-8 border bg-muted/40 text-foreground",
              )}
            >
              {m.content}
            </div>
          ))
        )}
      </div>

      {errorKey ? (
        <p className="text-sm text-destructive" role="alert">
          {errorText(t, errorKey)}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <textarea
            className={cn(
              "min-h-[88px] flex-1 resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none",
              "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "disabled:opacity-50",
            )}
            placeholder={t("inputPlaceholder")}
            value={input}
            disabled={pending}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button type="button" className="rounded-full sm:shrink-0" disabled={pending || !input.trim()} onClick={() => void send()}>
            {pending ? t("sending") : t("send")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {locale === "zh" ? "Enter 发送 · Shift+Enter 换行" : "Enter to send · Shift+Enter for a new line"}
        </p>
      </div>
    </div>
  );
}
