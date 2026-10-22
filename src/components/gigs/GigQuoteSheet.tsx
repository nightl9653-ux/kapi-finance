"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { formatProjectMoney } from "@/lib/fx";
import { projectContractTotal } from "@/lib/gigs/money";
import { isoToday, type GigClient, type GigProject } from "@/lib/gigs/types";

export function GigQuoteSheet({
  project,
  client,
  onClose,
}: {
  project: GigProject;
  client: GigClient | undefined;
  onClose: () => void;
}) {
  const t = useTranslations("gigs");
  const money = (n: number) => formatProjectMoney(n, project.currency);
  const today = isoToday();
  const who = [client?.name, client?.company, client?.phone, client?.email].filter(Boolean).join(" · ");

  return (
    <div className="gig-quote-root space-y-6">
      <div className="gig-quote-no-print flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={onClose}>
          {t("quoteBack")}
        </button>
        <Button type="button" className="rounded-full" onClick={() => window.print()}>
          {t("quotePrint")}
        </Button>
      </div>

      <article className="rounded-2xl border bg-white px-6 py-8 text-foreground print:rounded-none print:border-0 print:px-0 print:py-0">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("quoteOpen")}</p>
            <h2 className="mt-1 font-serif text-3xl font-semibold tracking-tight">{project.name}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("quoteDate")} {today}
          </p>
        </header>

        <p className="mt-6 text-sm">
          <span className="text-muted-foreground">{t("quoteTo")} </span>
          {who || t("unknownClient")}
        </p>

        {project.installments.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">{t("quoteEmpty")}</p>
        ) : (
          <table className="mt-8 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">{t("quoteColItem")}</th>
                <th className="py-2 font-medium">{t("quoteColDue")}</th>
                <th className="py-2 text-right font-medium">{t("quoteColAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {project.installments.map((inst) => (
                <tr key={inst.id} className="border-b border-border/70">
                  <td className="py-3 pr-4">{inst.label}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{inst.dueOn || "—"}</td>
                  <td className="py-3 text-right tabular-nums">{money(inst.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-4 font-medium" colSpan={2}>
                  {t("contractTotal")}
                </td>
                <td className="pt-4 text-right text-base font-semibold tabular-nums">{money(projectContractTotal(project))}</td>
              </tr>
            </tfoot>
          </table>
        )}

        {project.notes ? (
          <p className="mt-8 whitespace-pre-wrap text-sm">
            <span className="text-muted-foreground">{t("notes")} </span>
            {project.notes}
          </p>
        ) : null}

        <p className="mt-10 text-xs text-muted-foreground">{t("quoteFoot")}</p>
      </article>
    </div>
  );
}
