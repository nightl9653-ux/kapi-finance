import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/locales";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BASE_CURRENCY, coerceCurrency, type Currency } from "@/lib/fx";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoalTypePicker } from "@/components/goals/GoalTypePicker";
import { TransactionsCurrencyPicker } from "@/components/transactions/TransactionsCurrencyPicker";
import { FundPoolPlanner } from "@/components/goals/FundPoolPlanner";
import { DreamTheater } from "@/components/goals/DreamTheater";

type TxRow = { type: string | null; amount_base: number | null; timestamp: string | null };

function formatDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function coerceGoalType(typeRaw: string, typeCustomRaw: string): string {
  const type = String(typeRaw ?? "").trim();
  if (type === "custom") return String(typeCustomRaw ?? "").trim();
  return type;
}

function goalTypeLabel(t: (k: string) => string, type: string): string {
  const emoji = {
    housing: "🏠",
    travel: "✈️",
    retirement: "🌴",
    emergency: "🛡️",
    education: "🎓",
    car: "🚗",
    debt: "💳",
    medical: "🏥",
  } as const;

  const key = type as keyof typeof emoji;
  if (!emoji[key]) return type;
  return `${emoji[key]} ${t(type)}`;
}

function utcMonthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function utcYearStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
}

function utcQuarterStart(d: Date): Date {
  const q0 = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), q0, 1, 0, 0, 0, 0));
}

async function fetchFxRateUsdToLatest(display: Currency): Promise<number> {
  if (display === BASE_CURRENCY) return 1;
  const api = new URL("https://api.frankfurter.app/latest");
  api.searchParams.set("from", BASE_CURRENCY);
  api.searchParams.set("to", display);
  // 与 /api/fx 类似：日内汇率可缓存，减少首屏外网等待
  const res = await fetch(api.toString(), { next: { revalidate: 300 } });
  if (!res.ok) return 1;
  const data = (await res.json().catch(() => null)) as null | { rates?: Record<string, number> };
  const rate = Number(data?.rates?.[display]);
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

async function fetchAllTransactionsForUser(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) {
  const pageSize = 1000;
  const out: TxRow[] = [];
  for (let page = 0; page < 50; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("transactions")
      .select("type,amount_base,timestamp")
      .eq("user_id", userId)
      .order("timestamp", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const rows = (data ?? []) as TxRow[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

type NetTotals = { netAll: number; netMonth: number; netQuarter: number; netYear: number };

function computeNetTotalsFromTxRows(txRows: TxRow[]): NetTotals {
  const now = new Date();
  const monthStart = utcMonthStart(now).getTime();
  const quarterStart = utcQuarterStart(now).getTime();
  const yearStart = utcYearStart(now).getTime();

  let netAll = 0;
  let netMonth = 0;
  let netQuarter = 0;
  let netYear = 0;
  for (const r of txRows) {
    const amt = Number(r.amount_base ?? 0);
    if (!Number.isFinite(amt) || amt === 0) continue;
    const kind = String(r.type ?? "");
    const signed = kind === "income" ? amt : kind === "expense" ? -amt : 0;
    if (!signed) continue;
    const ts = r.timestamp ? new Date(r.timestamp).getTime() : NaN;
    if (!Number.isFinite(ts)) continue;
    netAll += signed;
    if (ts >= monthStart) netMonth += signed;
    if (ts >= quarterStart) netQuarter += signed;
    if (ts >= yearStart) netYear += signed;
  }
  return { netAll, netMonth, netQuarter, netYear };
}

async function updateGoal(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");

  const locale = String(formData.get("locale") ?? "en") as Locale;
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`/${locale}/goals?error=missing_id`);

  const name = String(formData.get("name") ?? "").trim();
  const type = coerceGoalType(String(formData.get("type") ?? ""), String(formData.get("type_custom") ?? ""));
  const targetAmount = Number(formData.get("target_amount") ?? 0);
  const currentAmount = Number(formData.get("current_amount") ?? 0);
  const priority = Number(formData.get("priority") ?? 2);
  const deadlineRaw = String(formData.get("deadline") ?? "").trim();

  if (
    !name ||
    !type ||
    !Number.isFinite(targetAmount) ||
    targetAmount <= 0 ||
    !Number.isFinite(currentAmount) ||
    currentAmount < 0 ||
    !Number.isFinite(priority)
  ) {
    redirect(`/${locale}/goals?error=invalid_input`);
  }

  const deadline = deadlineRaw ? deadlineRaw : null;
  const { error } = await supabase
    .from("financial_goals")
    .update({
      name,
      type,
      target_amount: targetAmount,
      current_amount: currentAmount,
      priority,
      deadline,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) redirect(`/${locale}/goals?error=unknown`);
  revalidatePath(`/${locale}/goals`);
  redirect(`/${locale}/goals?success=updated`);
}

async function createGoal(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");

  const locale = String(formData.get("locale") ?? "en") as Locale;
  const name = String(formData.get("name") ?? "").trim();
  const type = coerceGoalType(String(formData.get("type") ?? ""), String(formData.get("type_custom") ?? ""));
  const targetAmount = Number(formData.get("target_amount") ?? 0);
  const priority = Number(formData.get("priority") ?? 2);
  const deadlineRaw = String(formData.get("deadline") ?? "").trim();

  if (
    !name ||
    !type ||
    !Number.isFinite(targetAmount) ||
    targetAmount <= 0 ||
    !Number.isFinite(priority)
  ) {
    redirect(`/${locale}/goals?error=invalid_input`);
  }

  const deadline = deadlineRaw ? deadlineRaw : null;

  const { error } = await supabase.from("financial_goals").insert({
    user_id: data.user.id,
    name,
    type,
    target_amount: targetAmount,
    priority,
    deadline,
  });

  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("free plan goal limit reached")) {
      redirect(`/${locale}/goals?error=goal_limit`);
    }
    redirect(`/${locale}/goals?error=unknown`);
  }
  revalidatePath(`/${locale}/goals`);
  redirect(`/${locale}/goals?success=created`);
}

async function deleteGoal(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");

  const locale = String(formData.get("locale") ?? "en") as Locale;
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`/${locale}/goals?error=missing_id`);

  const { error } = await supabase.from("financial_goals").delete().eq("id", id);
  if (error) redirect(`/${locale}/goals?error=unknown`);
  revalidatePath(`/${locale}/goals`);
  redirect(`/${locale}/goals?success=deleted`);
}

export default async function GoalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;
  const sp = searchParams ? await searchParams : {};
  const errorKey = typeof sp.error === "string" ? sp.error : undefined;
  const successKey = typeof sp.success === "string" ? sp.success : undefined;
  const displayCurrency = coerceCurrency(typeof sp.dc === "string" ? sp.dc : BASE_CURRENCY);

  const [nav, t, tt, common, usdToDisplay] = await Promise.all([
    getTranslations("nav"),
    getTranslations("goals"),
    getTranslations("transactions"),
    getTranslations("common"),
    fetchFxRateUsdToLatest(displayCurrency),
  ]);

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{nav("goals")}</h1>
          <p className="text-sm text-muted-foreground">{common("supabaseEnvMissing")}</p>
        </div>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    redirect(`/${locale}/auth?next=${encodeURIComponent(`/${locale}/goals`)}`);
  }

  const [{ data: profile }, { data: goals, error }] = await Promise.all([
    supabase.from("profiles").select("is_plus_member").eq("id", auth.user.id).maybeSingle(),
    supabase
      .from("financial_goals")
      .select("id,name,type,target_amount,current_amount,deadline,priority,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false }),
  ]);
  if (error) {
    redirect(`/${locale}/goals?error=unknown`);
  }

  const isPlus = Boolean(profile?.is_plus_member);
  const usedCount = goals?.length ?? 0;

  const { data: netRpc, error: netRpcError } = await supabase.rpc("goals_net_stats");
  const rpcRow = netRpc?.[0] as Record<string, unknown> | undefined;
  const rpcNums =
    rpcRow &&
    ["net_all", "net_month", "net_quarter", "net_year"].map((k) => Number(rpcRow[k])).every((n) => Number.isFinite(n));

  let netTotals: NetTotals;
  if (!netRpcError && rpcNums && rpcRow) {
    netTotals = {
      netAll: Number(rpcRow.net_all),
      netMonth: Number(rpcRow.net_month),
      netQuarter: Number(rpcRow.net_quarter),
      netYear: Number(rpcRow.net_year),
    };
  } else {
    const txRows = await fetchAllTransactionsForUser(supabase, auth.user.id).catch(() => []);
    netTotals = computeNetTotalsFromTxRows(txRows);
  }
  const { netAll, netMonth, netQuarter, netYear } = netTotals;

  const money = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: displayCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{nav("goals")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border bg-white px-3 py-1">
              {isPlus ? t("planPlus") : t("planFree")}
            </span>
            <span className="text-muted-foreground">
              {isPlus ? t("quotaUnlimited") : t("quota", { used: usedCount, limit: 2 })}
            </span>
          </div>
          <TransactionsCurrencyPicker
            label={tt("fxDisplayCurrency")}
            basePath={`/${locale}/goals`}
            preservedQuery={{}}
            displayCurrency={displayCurrency}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-white/70 p-4">
          <div className="text-sm text-muted-foreground">{t("netAllTime")}</div>
          <div className="mt-1 text-lg font-semibold">{money.format(netAll * usdToDisplay)}</div>
        </div>
        <div className="rounded-2xl border bg-white/70 p-4">
          <div className="text-sm text-muted-foreground">{t("netMonth")}</div>
          <div className="mt-1 text-lg font-semibold">{money.format(netMonth * usdToDisplay)}</div>
        </div>
        <div className="rounded-2xl border bg-white/70 p-4">
          <div className="text-sm text-muted-foreground">{t("netQuarter")}</div>
          <div className="mt-1 text-lg font-semibold">{money.format(netQuarter * usdToDisplay)}</div>
        </div>
        <div className="rounded-2xl border bg-white/70 p-4">
          <div className="text-sm text-muted-foreground">{t("netYear")}</div>
          <div className="mt-1 text-lg font-semibold">{money.format(netYear * usdToDisplay)}</div>
        </div>
      </div>

      <FundPoolPlanner
        goals={(goals ?? []).map((g) => ({ id: String(g.id), name: String(g.name ?? "") }))}
        netMonthUsd={netMonth}
        displayCurrency={displayCurrency}
        usdToDisplay={usdToDisplay}
      />

      {errorKey ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorKey === "goal_limit"
            ? t("errorGoalLimit")
            : errorKey === "invalid_input"
              ? t("errorInvalidInput")
              : common("error")}
        </div>
      ) : null}

      {successKey ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {successKey === "created"
            ? t("successCreated")
            : successKey === "deleted"
              ? t("successDeleted")
              : successKey === "updated"
                ? t("successUpdated")
                : t("success")}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white/70 p-6">
        <h2 className="text-base font-medium">{t("create")}</h2>
        <form action={createGoal} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <div className="space-y-2">
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" name="name" placeholder={t("namePlaceholder")} required />
          </div>
          <GoalTypePicker />
          <div className="space-y-2">
            <Label htmlFor="target_amount">{t("targetAmount")}</Label>
            <Input id="target_amount" name="target_amount" type="number" min="0" step="0.01" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deadline">{t("deadline")}</Label>
            <Input id="deadline" name="deadline" type="date" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="priority-create">{t("priority")}</Label>
              <span className="text-right text-xs text-muted-foreground">{t("priorityHint")}</span>
            </div>
            <Input
              id="priority-create"
              name="priority"
              type="number"
              min="1"
              step="1"
              defaultValue={2}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" className="rounded-full">
              {t("create")}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border bg-white/70 p-6">
        <h2 className="text-base font-medium">{nav("goals")}</h2>
        <div className="mt-4 space-y-3">
          {goals?.length ? (
            goals.map((g) => (
              <div key={g.id} className="rounded-xl border bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {goalTypeLabel(t, String(g.type ?? ""))} · {t("currentAmount")}: {g.current_amount ?? 0} /{" "}
                      {t("targetAmount")}: {g.target_amount}
                      {g.deadline ? ` · ${t("deadline")}: ${formatDateInput(g.deadline as string)}` : ""}
                      {g.priority != null ? ` · ${t("priority")}: ${g.priority}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`#edit-${g.id}`}
                      scroll={false}
                      className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "rounded-full")}
                    >
                      {t("edit")}
                    </Link>
                    <form action={deleteGoal}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={g.id} />
                      <Button type="submit" variant="secondary" className="rounded-full">
                        {t("delete")}
                      </Button>
                    </form>
                  </div>
                </div>

                <div id={`edit-${g.id}`} className="mt-4 rounded-xl border bg-white/60 p-4">
                  <div className="text-sm font-medium">{t("edit")}</div>
                  <form action={updateGoal} className="mt-3 grid gap-4 sm:grid-cols-2">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={g.id} />
                    <div className="space-y-2">
                      <Label htmlFor={`name-${g.id}`}>{t("name")}</Label>
                      <Input id={`name-${g.id}`} name="name" defaultValue={g.name} required />
                    </div>
                    <GoalTypePicker defaultType={String(g.type ?? "")} />
                    <div className="space-y-2">
                      <Label htmlFor={`target-${g.id}`}>{t("targetAmount")}</Label>
                      <Input
                        id={`target-${g.id}`}
                        name="target_amount"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={Number(g.target_amount ?? 0)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`current-${g.id}`}>{t("currentAmount")}</Label>
                      <Input
                        id={`current-${g.id}`}
                        name="current_amount"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={Number(g.current_amount ?? 0)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`deadline-${g.id}`}>{t("deadline")}</Label>
                      <Input
                        id={`deadline-${g.id}`}
                        name="deadline"
                        type="date"
                        defaultValue={formatDateInput(g.deadline as string | null)}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor={`priority-${g.id}`}>{t("priority")}</Label>
                        <span className="text-right text-xs text-muted-foreground">{t("priorityHint")}</span>
                      </div>
                      <Input
                        id={`priority-${g.id}`}
                        name="priority"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={Number(g.priority ?? 2)}
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Button type="submit" className="rounded-full">
                        {common("save")}
                      </Button>
                    </div>
                  </form>
                </div>

                <DreamTheater
                  goal={{
                    id: String(g.id),
                    name: String(g.name ?? ""),
                    type: String(g.type ?? ""),
                    targetAmount: Number(g.target_amount ?? 0),
                    currentAmount: Number(g.current_amount ?? 0),
                    deadline: g.deadline ? String(g.deadline) : null,
                  }}
                  pageLocale={locale}
                />
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">{t("empty")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

