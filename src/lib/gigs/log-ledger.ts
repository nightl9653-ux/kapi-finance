"use server";

import { revalidatePath } from "next/cache";

import { BASE_CURRENCY, coerceCurrency, computeAmountBase, fetchFxRate } from "@/lib/fx";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LogGigLedgerResult =
  | { ok: true; transactionId: string }
  | {
      ok: false;
      error: "unauthorized" | "invalid" | "fx_failed" | "insert_failed" | "schema_missing";
      detail?: string;
    };

/** 接单收款记入总账（收入） */
export async function logGigInstallmentIncome(input: {
  projectId: string;
  projectName: string;
  clientName: string;
  installmentLabel: string;
  amount: number;
  currency?: string;
  occurredOn?: string;
  locale?: string;
}): Promise<LogGigLedgerResult> {
  return insertGigTx({
    ...input,
    type: "income",
    category: "business",
    merchant: input.clientName,
    noteLabel: input.installmentLabel,
  });
}

/** 接单成本记入总账（支出） */
export async function logGigCostExpense(input: {
  projectId: string;
  projectName: string;
  costName: string;
  amount: number;
  currency?: string;
  occurredOn?: string;
  locale?: string;
}): Promise<LogGigLedgerResult> {
  return insertGigTx({
    projectId: input.projectId,
    projectName: input.projectName,
    clientName: input.costName,
    installmentLabel: input.costName,
    amount: input.amount,
    currency: input.currency,
    occurredOn: input.occurredOn,
    locale: input.locale,
    type: "expense",
    category: "other",
    merchant: input.costName,
    noteLabel: input.costName,
  });
}

async function insertGigTx(input: {
  projectId: string;
  projectName: string;
  clientName: string;
  installmentLabel: string;
  amount: number;
  currency?: string;
  occurredOn?: string;
  locale?: string;
  type: "income" | "expense";
  category: string;
  merchant: string;
  noteLabel: string;
}): Promise<LogGigLedgerResult> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "unauthorized" };

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "invalid" };
  if (!input.projectId || !input.projectName.trim()) return { ok: false, error: "invalid" };

  const currency = coerceCurrency(input.currency);
  const occurredOn =
    input.occurredOn && /^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn)
      ? input.occurredOn
      : new Date().toISOString().slice(0, 10);

  let fxRate: number;
  let amountBase: number;
  try {
    const rate = currency === BASE_CURRENCY ? 1 : await fetchFxRate(currency, BASE_CURRENCY, occurredOn);
    const out = computeAmountBase({ amount, currency, fxRate: rate });
    fxRate = out.fxRate;
    amountBase = out.amountBase;
  } catch {
    return { ok: false, error: "fx_failed" };
  }

  const note = `${input.projectName.trim()} · ${input.noteLabel.trim()}`.slice(0, 200);
  const ts = new Date(`${occurredOn}T12:00:00`);

  const baseRow = {
    user_id: auth.user.id,
    amount,
    currency,
    fx_rate: fxRate,
    amount_base: amountBase,
    type: input.type,
    category: input.category,
    sub_category: "gigs",
    merchant: input.merchant.trim().slice(0, 120),
    note,
    occurred_on: occurredOn,
    timestamp: Number.isFinite(ts.getTime()) ? ts.toISOString() : new Date().toISOString(),
  };

  const withProject = { ...baseRow, studio_project_id: input.projectId };
  let { data, error } = await supabase.from("transactions").insert(withProject).select("id").single();

  if (error && /studio_project_id/i.test(error.message ?? "")) {
    ({ data, error } = await supabase.from("transactions").insert(baseRow).select("id").single());
  }

  if (error) {
    if (/studio_project|schema cache|does not exist|42703/i.test(error.message ?? "")) {
      return { ok: false, error: "schema_missing", detail: error.message };
    }
    return { ok: false, error: "insert_failed", detail: error.message };
  }

  const locale = input.locale === "zh" ? "zh" : "en";
  revalidatePath(`/${locale}/transactions`);
  revalidatePath(`/${locale}/gigs`);
  return { ok: true, transactionId: String((data as { id: string }).id) };
}
