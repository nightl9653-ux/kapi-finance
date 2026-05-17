"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";

import { BASE_CURRENCY, coerceCurrency, type Currency } from "@/lib/fx";
import { cn } from "@/lib/utils";

const QUICK: Currency[] = ["USD", "CNY", "EUR", "JPY", "HKD"];
const ALL: Currency[] = [
  "USD",
  "CNY",
  "EUR",
  "JPY",
  "HKD",
  "GBP",
  "AUD",
  "CAD",
  "KRW",
  "SGD",
  "TWD",
  "THB",
  "CHF",
  "SEK",
  "NOK",
  "NZD",
  "INR",
  "IDR",
  "MYR",
  "PHP",
  "VND",
];

export function TransactionsCurrencyPicker({
  label,
  basePath,
  preservedQuery,
  displayCurrency,
}: {
  label: string;
  basePath: string;
  preservedQuery: Record<string, string | undefined>;
  displayCurrency: Currency;
}) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState<string>(displayCurrency);

  useEffect(() => {
    setQ(displayCurrency);
  }, [displayCurrency]);

  const build = (c: Currency) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(preservedQuery)) {
      if (v !== undefined && v !== "") p.set(k, v);
    }
    if (c !== BASE_CURRENCY) p.set("dc", c);
    const qs = p.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  const commit = (raw: string) => {
    const c = coerceCurrency(raw);
    router.push(build(c), { scroll: false });
  };

  const suggestions = useMemo(() => {
    const s = q.trim().toUpperCase();
    if (!s) return ALL;
    return ALL.filter((c) => c.includes(s)).slice(0, 12);
  }, [q]);

  return (
    <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full border bg-white px-2 py-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/80">{label}</span>

      <div className="hidden items-center gap-1 sm:flex">
        {QUICK.map((c) => {
          const active = c === displayCurrency;
          return (
            <Link
              key={c}
              scroll={false}
              href={build(c)}
              className={cn(
                "rounded-full px-2 py-0.5",
                active ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              {c}
            </Link>
          );
        })}
        <div className="mx-1 h-4 w-px bg-border/60" aria-hidden="true" />
      </div>

      <div className="flex items-center gap-1">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => {
            if (!q.trim()) setQ(displayCurrency);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(q);
            }
          }}
          list={listId}
          className="h-7 w-[6.5rem] rounded-md border bg-white/70 px-2 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={label}
          placeholder="搜索币种…"
        />
        <datalist id={listId}>
          {suggestions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={() => commit(q)}
          className="h-7 rounded-md border bg-white/70 px-2 text-xs text-foreground hover:bg-muted/40"
        >
          切换
        </button>
      </div>
    </div>
  );
}

