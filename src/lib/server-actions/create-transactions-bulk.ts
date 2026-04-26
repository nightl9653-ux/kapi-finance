"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/locales";
import { coerceCurrency, computeAmountBase } from "@/lib/fx";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function parseContextDate(formData: FormData): string | undefined {
  const raw = String(formData.get("context_date") ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

function transactionsSearchPath(locale: Locale, opts: { success?: string; error?: string; date?: string }): string {
  const p = new URLSearchParams();
  if (opts.error) p.set("error", opts.error);
  if (opts.success) p.set("success", opts.success);
  if (opts.date) p.set("date", opts.date);
  const q = p.toString();
  return `/${locale}/transactions${q ? `?${q}` : ""}`;
}

type BulkRow = {
  occurred_on: string;
  type: "expense" | "income";
  amount: string | number;
  currency?: string;
  fx_rate?: string | number;
  category: string;
  merchant?: string;
  note?: string;
};

export async function createTransactionsBulk(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");

  const locale = String(formData.get("locale") ?? "en") as Locale;
  const contextDate = parseContextDate(formData);
  const raw = String(formData.get("bulk") ?? "[]");
  const returnTo = String(formData.get("return_to") ?? "transactions").trim();

  let rows: BulkRow[] = [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error("not array");
    rows = parsed as BulkRow[];
  } catch {
    redirect(
      returnTo === "quick"
        ? `/${locale}/quick-record?error=invalid`
        : transactionsSearchPath(locale, { error: "invalid", date: contextDate }),
    );
  }

  const cleaned = rows
    .map((r) => ({
      occurred_on: String(r.occurred_on ?? "").trim(),
      type: r.type === "income" ? "income" : "expense",
      amount: Number(r.amount),
      currency: coerceCurrency((r as { currency?: unknown }).currency),
      fxRate: Number((r as { fx_rate?: unknown }).fx_rate),
      category: String(r.category ?? "").trim(),
      merchant: String((r as { merchant?: unknown }).merchant ?? "").trim(),
      note: String(r.note ?? "").trim(),
    }))
    .filter((r) => r.occurred_on || r.category || Number.isFinite(r.amount));

  if (!cleaned.length || cleaned.length > 200) {
    redirect(
      returnTo === "quick"
        ? `/${locale}/quick-record?error=invalid`
        : transactionsSearchPath(locale, { error: "invalid", date: contextDate }),
    );
  }

  for (const r of cleaned) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.occurred_on) || !r.category || !Number.isFinite(r.amount) || r.amount <= 0) {
      redirect(
        returnTo === "quick"
          ? `/${locale}/quick-record?error=invalid`
          : transactionsSearchPath(locale, { error: "invalid", date: contextDate }),
      );
    }
    try {
      computeAmountBase({ amount: r.amount, currency: r.currency, fxRate: Number.isFinite(r.fxRate) ? r.fxRate : null });
    } catch {
      redirect(
        returnTo === "quick"
          ? `/${locale}/quick-record?error=invalid`
          : transactionsSearchPath(locale, { error: "invalid", date: contextDate }),
      );
    }
  }

  const payload = cleaned.map((r) => {
    const ts = new Date(`${r.occurred_on}T20:00`);
    const fx = computeAmountBase({ amount: r.amount, currency: r.currency, fxRate: Number.isFinite(r.fxRate) ? r.fxRate : null });
    return {
      user_id: data.user.id,
      amount: r.amount,
      currency: r.currency,
      fx_rate: fx.fxRate,
      amount_base: fx.amountBase,
      type: r.type,
      category: r.category,
      merchant: r.merchant || null,
      note: r.note || null,
      occurred_on: r.occurred_on,
      timestamp: Number.isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString(),
    };
  });

  const { error } = await supabase.from("transactions").insert(payload);
  if (error) {
    redirect(
      returnTo === "quick"
        ? `/${locale}/quick-record?error=unknown`
        : transactionsSearchPath(locale, { error: "unknown", date: contextDate }),
    );
  }
  revalidatePath(`/${locale}/transactions`);
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/quick-record`);
  if (returnTo === "quick") {
    redirect(`/${locale}/quick-record?success=bulk_created`);
  }
  redirect(transactionsSearchPath(locale, { success: "bulk_created", date: contextDate }));
}
