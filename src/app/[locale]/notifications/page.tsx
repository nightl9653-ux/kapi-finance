import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Locale } from "@/i18n/locales";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

async function markAllRead(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");

  const locale = String(formData.get("locale") ?? "en") as Locale;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", data.user.id)
    .is("read_at", null);

  if (error) redirect(`/${locale}/notifications?error=unknown`);
  revalidatePath(`/${locale}/notifications`);
  redirect(`/${locale}/notifications`);
}

async function markOneRead(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");

  const locale = String(formData.get("locale") ?? "en") as Locale;
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`/${locale}/notifications?error=invalid`);

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", data.user.id)
    .eq("id", id);

  if (error) redirect(`/${locale}/notifications?error=unknown`);
  revalidatePath(`/${locale}/notifications`);
  redirect(`/${locale}/notifications`);
}

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = (raw === "zh" ? "zh" : "en") as Locale;
  const nav = await getTranslations("nav");
  const t = await getTranslations("notifications");

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect(`/${locale}/auth?next=${encodeURIComponent(`/${locale}/notifications`)}`);
  }

  const { data: rows } = await supabase
    .from("notifications")
    .select("id,kind,for_date,title,body,read_at,created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const unread = (rows ?? []).filter((r) => !r.read_at).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{nav("notifications")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle", { unread })}</p>
        </div>
        {unread > 0 ? (
          <form action={markAllRead}>
            <input type="hidden" name="locale" value={locale} />
            <Button variant="secondary" className="rounded-full">
              {t("markAllRead")}
            </Button>
          </form>
        ) : null}
      </div>

      <div className="rounded-2xl border bg-white/70 p-6">
        <h2 className="text-base font-medium">{t("listTitle")}</h2>
        <div className="mt-4 space-y-3">
          {rows?.length ? (
            rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-2 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{row.title}</div>
                    {row.read_at ? null : (
                      <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs text-foreground">
                        {t("unread")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.for_date ? t("forDate", { date: String(row.for_date) }) : null}
                    {row.body ? (row.for_date ? ` · ${row.body}` : row.body) : null}
                  </div>
                </div>
                {row.read_at ? null : (
                  <form action={markOneRead}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={row.id} />
                    <Button type="submit" variant="secondary" size="sm" className="rounded-full">
                      {t("markRead")}
                    </Button>
                  </form>
                )}
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

