"use server";

import { revalidatePath } from "next/cache";

import { BASE_CURRENCY, coerceCurrency, computeAmountBase, fetchFxRate } from "@/lib/fx";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LogTravelItemResult =
  | { ok: true; transactionId: string }
  | {
      ok: false;
      error: "unauthorized" | "invalid" | "fx_failed" | "insert_failed" | "schema_missing";
      detail?: string;
    };

/** 从旅行清单项生成一笔「旅行」支出，挂 travel_trip_id */
export async function logTravelItemExpense(input: {
  tripId: string;
  tripName: string;
  itemName: string;
  amount: number;
  currency?: string;
  category?: string;
  occurredOn?: string;
  locale?: string;
}): Promise<LogTravelItemResult> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "unauthorized" };

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "invalid" };
  if (!input.tripId || !input.itemName.trim()) return { ok: false, error: "invalid" };

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

  const note = `${input.tripName.trim()} · ${input.itemName.trim()}`.slice(0, 200);
  const ts = new Date(`${occurredOn}T12:00:00`);

  const baseRow = {
    user_id: auth.user.id,
    amount,
    currency,
    fx_rate: fxRate,
    amount_base: amountBase,
    type: "expense" as const,
    category: "travel",
    sub_category: input.category?.trim().slice(0, 80) || null,
    merchant: input.itemName.trim().slice(0, 120),
    note,
    occurred_on: occurredOn,
    timestamp: Number.isFinite(ts.getTime()) ? ts.toISOString() : new Date().toISOString(),
  };

  const withTrip = { ...baseRow, travel_trip_id: input.tripId };
  let { data, error } = await supabase.from("transactions").insert(withTrip).select("id").single();

  if (error && /travel_trip_id/i.test(error.message ?? "")) {
    ({ data, error } = await supabase.from("transactions").insert(baseRow).select("id").single());
  }

  if (error) {
    if (/travel_trip|schema cache|does not exist|42703/i.test(error.message ?? "")) {
      return { ok: false, error: "schema_missing", detail: error.message };
    }
    return { ok: false, error: "insert_failed", detail: error.message };
  }
  if (!data?.id) return { ok: false, error: "insert_failed" };

  const locale = input.locale === "zh" ? "zh" : "en";
  revalidatePath(`/${locale}/transactions`);
  revalidatePath(`/${locale}/travel-studio`);
  revalidatePath(`/${locale}/reports`);
  return { ok: true, transactionId: data.id as string };
}

export async function loadTripLinkedSpend(tripId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || !tripId) return 0;

  const { data, error } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", auth.user.id)
    .eq("travel_trip_id", tripId)
    .eq("type", "expense");

  if (error || !data) return 0;
  return data.reduce((sum, row) => {
    const n = Number(row.amount);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}
