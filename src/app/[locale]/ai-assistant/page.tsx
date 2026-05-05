import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/locales";
import { fetchExpenseTotalsByCategory } from "@/lib/budget-progress";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AIAssistantChat } from "@/components/ai-assistant/AIAssistantChat";
import { BudgetPlanCard } from "@/components/ai-assistant/BudgetPlanCard";

function monthStartISO(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export default async function AIAssistantPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;
  const nav = await getTranslations("nav");
  const t = await getTranslations("aiAssistantPage");

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{nav("aiAssistant")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <p className="text-sm text-muted-foreground">{t("errors.supabase_not_configured")}</p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    redirect(`/${locale}/auth?next=${encodeURIComponent(`/${locale}/ai-assistant`)}`);
  }

  const month = monthStartISO();
  const { data: budget } = await supabase
    .from("budgets")
    .select("id,month,currency,note")
    .eq("user_id", auth.user.id)
    .eq("month", month)
    .maybeSingle();
  const budgetId = budget?.id ? String(budget.id) : null;
  const { data: items } = budgetId
    ? await supabase
        .from("budget_items")
        .select("budget_id,category,limit_base,pct,rationale")
        .eq("budget_id", budgetId)
        .order("limit_base", { ascending: false })
    : { data: null };

  let spentByCategory: Record<string, number> = {};
  if (budgetId) {
    try {
      spentByCategory = await fetchExpenseTotalsByCategory(supabase, auth.user.id, month);
    } catch {
      spentByCategory = {};
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{nav("aiAssistant")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="rounded-2xl border bg-white/70 p-6">
        <BudgetPlanCard
          locale={locale}
          initialSpent={spentByCategory}
          initial={
            budgetId
              ? {
                  id: budgetId,
                  month: String(budget?.month ?? month),
                  currency: String(budget?.currency ?? "USD"),
                  note: budget?.note ? String(budget.note) : null,
                  items: (items ?? []).map((it) => ({
                    budget_id: String(it.budget_id),
                    category: String(it.category ?? ""),
                    limit_base: Number(it.limit_base ?? 0),
                    pct: it.pct == null ? null : Number(it.pct),
                    rationale: it.rationale ? String(it.rationale) : null,
                  })),
                }
              : null
          }
        />
      </div>

      <div className="rounded-2xl border bg-white/70 p-6">
        <AIAssistantChat locale={locale} />
      </div>
    </div>
  );
}
