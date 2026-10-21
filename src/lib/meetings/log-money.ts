"use server";

import { revalidatePath } from "next/cache";

import { BASE_CURRENCY, coerceCurrency, computeAmountBase, fetchFxRate } from "@/lib/fx";
import {
  categoryForKind,
  isSocialMoneyKind,
  transactionTypeForKind,
  type SocialMoneyFlow,
  type SocialMoneyKind,
} from "@/lib/meetings/money-flows";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LogSocialMoneyResult =
  | { ok: true; transactionId: string }
  | {
      ok: false;
      error: "unauthorized" | "invalid" | "fx_failed" | "insert_failed" | "schema_missing" | "not_found";
      detail?: string;
    };

type TxRow = {
  id: string;
  social_contact_id: string | null;
  amount: number | string | null;
  currency: string | null;
  amount_base: number | string | null;
  sub_category: string | null;
  note: string | null;
  occurred_on: string | null;
  created_at: string | null;
};

function rowToFlow(row: TxRow): SocialMoneyFlow | null {
  const contactId = String(row.social_contact_id ?? "").trim();
  if (!contactId || !isSocialMoneyKind(row.sub_category)) return null;
  const amount = Number(row.amount);
  const amountBase = Number(row.amount_base ?? row.amount);
  const occurredOn = String(row.occurred_on ?? "").slice(0, 10);
  if (!Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) return null;
  return {
    id: row.id,
    contactId,
    kind: row.sub_category,
    amount,
    currency: coerceCurrency(row.currency),
    amountBase: Number.isFinite(amountBase) ? amountBase : amount,
    occurredOn,
    note: row.note?.trim() || undefined,
    createdAt: row.created_at || occurredOn,
  };
}

function isSchemaMissing(message: string | undefined): boolean {
  return /social_contact_id|schema cache|does not exist|42703/i.test(message ?? "");
}

/** 从往来页记一笔资金：写入总账并挂 social_contact_id；类型在 sub_category */
export async function logSocialMoneyFlow(input: {
  contactId: string;
  contactName: string;
  kind: SocialMoneyKind;
  amount: number;
  currency?: string;
  occurredOn?: string;
  note?: string;
  locale?: string;
}): Promise<LogSocialMoneyResult> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "unauthorized" };

  if (!input.contactId || !isSocialMoneyKind(input.kind)) return { ok: false, error: "invalid" };
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "invalid" };

  const { data: contact } = await supabase
    .from("social_contacts")
    .select("id,name")
    .eq("id", input.contactId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!contact) return { ok: false, error: "not_found" };

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

  const name = (input.contactName || contact.name || "").trim().slice(0, 80);
  const userNote = (input.note ?? "").trim().slice(0, 160);
  const note = userNote ? `${name} · ${userNote}`.slice(0, 200) : name.slice(0, 200);
  const ts = new Date(`${occurredOn}T12:00:00`);
  const type = transactionTypeForKind(input.kind);

  const row = {
    user_id: auth.user.id,
    amount,
    currency,
    fx_rate: fxRate,
    amount_base: amountBase,
    type,
    category: categoryForKind(input.kind),
    sub_category: input.kind,
    merchant: name.slice(0, 120),
    note,
    occurred_on: occurredOn,
    timestamp: Number.isFinite(ts.getTime()) ? ts.toISOString() : new Date().toISOString(),
    social_contact_id: input.contactId,
  };

  const { data, error } = await supabase.from("transactions").insert(row).select("id").single();

  if (error) {
    if (isSchemaMissing(error.message)) {
      return { ok: false, error: "schema_missing", detail: error.message };
    }
    return { ok: false, error: "insert_failed", detail: error.message };
  }
  if (!data?.id) return { ok: false, error: "insert_failed" };

  const locale = input.locale === "zh" ? "zh" : "en";
  revalidatePath(`/${locale}/transactions`);
  revalidatePath(`/${locale}/meetings`);
  revalidatePath(`/${locale}/reports`);
  return { ok: true, transactionId: data.id as string };
}

export async function deleteSocialMoneyFlow(input: {
  transactionId: string;
  locale?: string;
}): Promise<LogSocialMoneyResult> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "unauthorized" };
  if (!input.transactionId) return { ok: false, error: "invalid" };

  const { data: existing, error: findErr } = await supabase
    .from("transactions")
    .select("id,social_contact_id")
    .eq("id", input.transactionId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (findErr) {
    if (isSchemaMissing(findErr.message)) {
      return { ok: false, error: "schema_missing", detail: findErr.message };
    }
    return { ok: false, error: "insert_failed", detail: findErr.message };
  }
  if (!existing?.id || !existing.social_contact_id) return { ok: false, error: "not_found" };

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", input.transactionId)
    .eq("user_id", auth.user.id);

  if (error) return { ok: false, error: "insert_failed", detail: error.message };

  const locale = input.locale === "zh" ? "zh" : "en";
  revalidatePath(`/${locale}/transactions`);
  revalidatePath(`/${locale}/meetings`);
  revalidatePath(`/${locale}/reports`);
  return { ok: true, transactionId: input.transactionId };
}

export async function loadSocialMoneyFlows(params?: {
  contactId?: string;
}): Promise<{ flows: SocialMoneyFlow[]; schemaMissing: boolean }> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { flows: [], schemaMissing: false };

  let query = supabase
    .from("transactions")
    .select("id,social_contact_id,amount,currency,amount_base,sub_category,note,occurred_on,created_at")
    .eq("user_id", auth.user.id)
    .not("social_contact_id", "is", null)
    .order("occurred_on", { ascending: false });

  if (params?.contactId) {
    query = query.eq("social_contact_id", params.contactId);
  }

  const { data, error } = await query;
  if (error) {
    if (isSchemaMissing(error.message)) return { flows: [], schemaMissing: true };
    return { flows: [], schemaMissing: false };
  }

  const flows = ((data as TxRow[]) ?? [])
    .map(rowToFlow)
    .filter((f): f is SocialMoneyFlow => !!f);

  return { flows, schemaMissing: false };
}
