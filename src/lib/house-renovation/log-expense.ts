"use server";

import { revalidatePath } from "next/cache";

import { BASE_CURRENCY, coerceCurrency, computeAmountBase, fetchFxRate } from "@/lib/fx";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LogRenovationMaterialResult =
  | { ok: true; transactionId: string }
  | { ok: false; error: "unauthorized" | "invalid" | "fx_failed" | "insert_failed"; detail?: string };

/** 从装修材料生成一笔「住房」支出：原币=项目币种，并折算 USD 本位 */
export async function logRenovationMaterialExpense(input: {
  projectId: string;
  projectName: string;
  materialName: string;
  amount: number;
  currency?: string;
  phase?: string;
  occurredOn?: string;
  locale?: string;
}): Promise<LogRenovationMaterialResult> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "unauthorized" };

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "invalid" };
  if (!input.projectId || !input.materialName.trim()) return { ok: false, error: "invalid" };

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

  const note = `${input.projectName.trim()} · ${input.materialName.trim()}`.slice(0, 200);
  const ts = new Date(`${occurredOn}T12:00:00`);

  const baseRow = {
    user_id: auth.user.id,
    amount,
    currency,
    fx_rate: fxRate,
    amount_base: amountBase,
    type: "expense" as const,
    category: "housing",
    sub_category: input.phase?.trim().slice(0, 80) || null,
    merchant: input.materialName.trim().slice(0, 120),
    note,
    occurred_on: occurredOn,
    timestamp: Number.isFinite(ts.getTime()) ? ts.toISOString() : new Date().toISOString(),
  };

  const withProject = { ...baseRow, renovation_project_id: input.projectId };
  let { data, error } = await supabase.from("transactions").insert(withProject).select("id").single();

  // renovation_project_id 列未迁移时，降级为不挂项目仍记账
  if (error && /renovation_project_id/i.test(error.message ?? "")) {
    ({ data, error } = await supabase.from("transactions").insert(baseRow).select("id").single());
  }

  if (error || !data?.id) {
    return { ok: false, error: "insert_failed", detail: error?.message ?? undefined };
  }

  const locale = input.locale === "zh" ? "zh" : "en";
  revalidatePath(`/${locale}/transactions`);
  revalidatePath(`/${locale}/renovation-studio`);
  return { ok: true, transactionId: data.id as string };
}

/** 该项目已挂交易的实付合计（原币 amount 之和） */
export async function loadProjectLinkedSpend(projectId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || !projectId) return 0;

  const { data, error } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", auth.user.id)
    .eq("renovation_project_id", projectId)
    .eq("type", "expense");

  if (error || !data) return 0;

  return data.reduce((sum, row) => {
    const n = Number(row.amount);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}
