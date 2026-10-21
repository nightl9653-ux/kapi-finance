"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BASE_CURRENCY, PROJECT_CURRENCIES, formatProjectMoney } from "@/lib/fx";
import {
  deleteSocialMoneyFlow,
  loadSocialMoneyFlows,
  logSocialMoneyFlow,
} from "@/lib/meetings/log-money";
import {
  SOCIAL_MONEY_KINDS,
  emptyMoneySummary,
  formatUsdBase,
  summarizeFlows,
  type SocialMoneyFlow,
  type SocialMoneyKind,
} from "@/lib/meetings/money-flows";
import { isoToday } from "@/lib/meetings/types";
import { cn } from "@/lib/utils";

function kindLabel(t: (key: string) => string, kind: SocialMoneyKind): string {
  return t(`moneyKind.${kind}`);
}

export function ContactMoneySection({
  contactId,
  contactName,
  onSummariesChange,
}: {
  contactId: string;
  contactName: string;
  /** 通知父级刷新列表余额（可选） */
  onSummariesChange?: () => void;
}) {
  const t = useTranslations("meetingsPage");
  const locale = useLocale();
  const [flows, setFlows] = useState<SocialMoneyFlow[]>([]);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [kind, setKind] = useState<SocialMoneyKind>("gift_out");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>(BASE_CURRENCY);
  const [occurredOn, setOccurredOn] = useState(isoToday());
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loadSocialMoneyFlows({ contactId });
      setSchemaMissing(res.schemaMissing);
      setFlows(res.flows);
    } catch {
      setError(t("moneyLoadError"));
    } finally {
      setLoading(false);
    }
  }, [contactId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const summary = useMemo(() => {
    const map = summarizeFlows(flows);
    return map.get(contactId) ?? emptyMoneySummary(contactId);
  }, [flows, contactId]);

  const submit = () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError(t("moneyInvalidAmount"));
      return;
    }
    startTransition(async () => {
      setError(null);
      const res = await logSocialMoneyFlow({
        contactId,
        contactName,
        kind,
        amount: n,
        currency,
        occurredOn,
        note,
        locale,
      });
      if (!res.ok) {
        setError(
          res.error === "schema_missing"
            ? t("moneySchemaMissing")
            : res.error === "fx_failed"
              ? t("moneyFxError")
              : t("moneySaveError"),
        );
        return;
      }
      setAmount("");
      setNote("");
      setOpenForm(false);
      await refresh();
      onSummariesChange?.();
    });
  };

  const remove = (id: string) => {
    if (!window.confirm(t("moneyDeleteConfirm"))) return;
    startTransition(async () => {
      setError(null);
      const res = await deleteSocialMoneyFlow({ transactionId: id, locale });
      if (!res.ok) {
        setError(res.error === "schema_missing" ? t("moneySchemaMissing") : t("moneySaveError"));
        return;
      }
      await refresh();
      onSummariesChange?.();
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-medium">{t("moneyTitle")}</h2>
        <Button
          type="button"
          className="rounded-full"
          disabled={pending || schemaMissing}
          onClick={() => setOpenForm((v) => !v)}
        >
          {openForm ? t("cancel") : t("moneyAdd")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t("moneyHint")}</p>

      {schemaMissing ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950">
          {t("moneySchemaMissing")}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-white/60 p-4">
          <p className="text-xs text-muted-foreground">{t("moneyLoanBalance")}</p>
          <p
            className={cn(
              "mt-1 text-lg font-semibold tabular-nums",
              summary.loanBalanceBase > 0 && "text-emerald-700",
              summary.loanBalanceBase < 0 && "text-rose-700",
            )}
          >
            {summary.loanBalanceBase === 0
              ? t("moneyLoanSettled")
              : summary.loanBalanceBase > 0
                ? t("moneyTheyOwe", { amount: formatUsdBase(summary.loanBalanceBase) })
                : t("moneyIOwe", { amount: formatUsdBase(Math.abs(summary.loanBalanceBase)) })}
          </p>
        </div>
        <div className="rounded-2xl border bg-white/60 p-4">
          <p className="text-xs text-muted-foreground">{t("moneyGiftNet")}</p>
          <p
            className={cn(
              "mt-1 text-lg font-semibold tabular-nums",
              summary.giftNetBase > 0 && "text-emerald-700",
              summary.giftNetBase < 0 && "text-rose-700",
            )}
          >
            {summary.giftNetBase === 0
              ? t("moneyGiftEven")
              : summary.giftNetBase > 0
                ? t("moneyGiftReceivedMore", { amount: formatUsdBase(summary.giftNetBase) })
                : t("moneyGiftSentMore", { amount: formatUsdBase(Math.abs(summary.giftNetBase)) })}
          </p>
        </div>
      </div>

      {openForm ? (
        <div className="space-y-3 rounded-2xl border bg-white/70 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="social-money-kind">{t("moneyKindLabel")}</Label>
              <select
                id="social-money-kind"
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as SocialMoneyKind)}
              >
                {SOCIAL_MONEY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {kindLabel(t, k)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="social-money-date">{t("metOn")}</Label>
              <Input
                id="social-money-date"
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="social-money-amount">{t("moneyAmount")}</Label>
              <Input
                id="social-money-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="social-money-currency">{t("moneyCurrency")}</Label>
              <select
                id="social-money-currency"
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {PROJECT_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="social-money-note">{t("moneyNote")}</Label>
            <Input
              id="social-money-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("moneyNotePlaceholder")}
            />
          </div>
          <Button type="button" className="rounded-full" disabled={pending} onClick={submit}>
            {pending ? t("moneySaving") : t("moneySave")}
          </Button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : flows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("moneyEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {flows.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border bg-white/60 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="tabular-nums">{f.occurredOn}</span>
                  <span className="text-muted-foreground"> · {kindLabel(t, f.kind)}</span>
                </p>
                <p className="mt-0.5 text-sm tabular-nums">
                  {formatProjectMoney(f.amount, f.currency)}
                  {f.currency !== BASE_CURRENCY ? (
                    <span className="text-muted-foreground">
                      {" "}
                      ≈ {formatUsdBase(f.amountBase)}
                    </span>
                  ) : null}
                </p>
                {f.note ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{f.note}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full text-destructive"
                disabled={pending}
                onClick={() => remove(f.id)}
              >
                {t("delete")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 列表页：批量加载各联系人余额摘要 */
export function useContactMoneySummaries(enabled: boolean) {
  const [byContact, setByContact] = useState(() => new Map<string, ReturnType<typeof emptyMoneySummary>>());
  const [schemaMissing, setSchemaMissing] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await loadSocialMoneyFlows();
      setSchemaMissing(res.schemaMissing);
      setByContact(summarizeFlows(res.flows));
    } catch {
      setByContact(new Map());
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { byContact, schemaMissing, refresh };
}
