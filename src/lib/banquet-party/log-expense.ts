"use server";

import { revalidatePath } from "next/cache";

import { BASE_CURRENCY, coerceCurrency, computeAmountBase, fetchFxRate } from "@/lib/fx";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LogBanquetMaterialResult =
  | { ok: true; transactionId: string }
  | { ok: false; error: "unauthorized" | "invalid" | "fx_failed" | "insert_failed"; detail?: string };

/** 从宴会材料生成一笔「宴会」支出：原币=派对币种，并折算 USD 本位 */
export async function logBanquetMaterialExpense(input: {
  partyId: string;
  partyName: string;
  materialName: string;
  amount: number;
  currency?: string;
  occurredOn?: string;
  locale?: string;
}): Promise<LogBanquetMaterialResult> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "unauthorized" };

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "invalid" };
  if (!input.partyId || !input.materialName.trim()) return { ok: false, error: "invalid" };

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

  const note = `${input.partyName.trim()} · ${input.materialName.trim()}`.slice(0, 200);
  const ts = new Date(`${occurredOn}T12:00:00`);

  const baseRow = {
    user_id: auth.user.id,
    amount,
    currency,
    fx_rate: fxRate,
    amount_base: amountBase,
    type: "expense" as const,
    category: "banquet",
    merchant: input.materialName.trim().slice(0, 120),
    note,
    occurred_on: occurredOn,
    timestamp: Number.isFinite(ts.getTime()) ? ts.toISOString() : new Date().toISOString(),
  };

  const withParty = { ...baseRow, party_id: input.partyId };
  let { data, error } = await supabase.from("transactions").insert(withParty).select("id").single();

  // party_id 列未迁移 / schema cache 未刷新时，降级为不挂派对仍记账
  if (error && /party_id/i.test(error.message ?? "")) {
    ({ data, error } = await supabase.from("transactions").insert(baseRow).select("id").single());
  }

  if (error || !data?.id) {
    return { ok: false, error: "insert_failed", detail: error?.message ?? undefined };
  }

  const locale = input.locale === "zh" ? "zh" : "en";
  revalidatePath(`/${locale}/transactions`);
  revalidatePath(`/${locale}/banquet-studio`);
  return { ok: true, transactionId: data.id as string };
}

/** 该派对已挂交易的实付合计（原币 amount 之和；同派对通常同币种） */
export async function loadPartyLinkedSpend(partyId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || !partyId) return 0;

  const { data, error } = await supabase
    .from("transactions")
    .select("amount,amount_base,currency")
    .eq("user_id", auth.user.id)
    .eq("party_id", partyId)
    .eq("type", "expense");

  if (error || !data) return 0;

  return data.reduce((sum, row) => {
    const n = Number(row.amount);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}
