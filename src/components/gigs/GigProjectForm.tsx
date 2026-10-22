"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BASE_CURRENCY, type Currency } from "@/lib/fx";
import {
  defaultPackageForVertical,
  makeInstallmentsFromPackage,
  packageById,
  packagesForVertical,
} from "@/lib/gigs/templates";
import {
  GIG_PROJECT_STATUSES,
  GIG_VERTICALS,
  newGigId,
  type GigClient,
  type GigProject,
  type GigProjectStatus,
  type GigVertical,
} from "@/lib/gigs/types";
import { cn } from "@/lib/utils";

export function GigProjectForm({
  clients,
  initial,
  onCancel,
  onSave,
  saving,
}: {
  clients: GigClient[];
  initial?: GigProject;
  onCancel: () => void;
  onSave: (project: GigProject) => Promise<void>;
  saving?: boolean;
}) {
  const t = useTranslations("gigs");
  const initialPackageId = defaultPackageForVertical(initial?.vertical ?? "design").id;
  const [nameFromPackage, setNameFromPackage] = useState(!initial);
  const [name, setName] = useState(initial?.name ?? t(`packages.${initialPackageId}.name`));
  const [clientId, setClientId] = useState(initial?.clientId ?? clients[0]?.id ?? "");
  const [vertical, setVertical] = useState<GigVertical>(initial?.vertical ?? "design");
  const [packageId, setPackageId] = useState(initialPackageId);
  const [status, setStatus] = useState<GigProjectStatus>(initial?.status ?? "active");
  const [currency, setCurrency] = useState<string>(initial?.currency ?? BASE_CURRENCY);
  const [totalHint, setTotalHint] = useState(
    initial ? String(initial.installments.reduce((s, i) => s + i.amount, 0) || "") : "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const canSubmit = name.trim() && clientId;
  const packages = packagesForVertical(vertical);

  const currencies = useMemo(() => ["USD", "CNY", "HKD", "EUR", "JPY"] as Currency[], []);

  function choosePackage(id: string) {
    const label = t(`packages.${id}.name`);
    setPackageId(id);
    setName((current) => (nameFromPackage || !current.trim() ? label : current));
    setNameFromPackage((fromPackage) => fromPackage || !name.trim());
  }

  return (
    <form
      className="space-y-3 rounded-2xl border bg-white/70 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        const now = new Date().toISOString();
        const total = Math.max(0, Number(totalHint) || 0);
        const selected = packageById(packageId) ?? defaultPackageForVertical(vertical);
        const installments =
          initial?.installments?.length && initial.id
            ? initial.installments
            : makeInstallmentsFromPackage(
                selected,
                total,
                selected.ratios.map((_, index) => t(`packages.${selected.id}.item${index}`)),
              );
        void onSave({
          id: initial?.id || newGigId(),
          clientId,
          name: name.trim(),
          vertical,
          currency: (currencies.includes(currency as Currency) ? currency : BASE_CURRENCY) as Currency,
          status,
          notes: notes.trim() || undefined,
          installments,
          costs: initial?.costs ?? [],
          timeLogs: initial?.timeLogs ?? [],
          createdAt: initial?.createdAt || now,
          updatedAt: now,
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="gig-project-name">{t("projectName")}</Label>
        <Input
          id="gig-project-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameFromPackage(false);
          }}
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="gig-project-client">{t("client")}</Label>
          <select
            id="gig-project-client"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          >
            {clients.length === 0 ? <option value="">{t("noClientsYet")}</option> : null}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gig-project-vertical">{t("vertical")}</Label>
          <select
            id="gig-project-vertical"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={vertical}
            onChange={(e) => {
              const next = e.target.value as GigVertical;
              setVertical(next);
              if (!initial) choosePackage(defaultPackageForVertical(next).id);
            }}
          >
            {GIG_VERTICALS.map((v) => (
              <option key={v} value={v}>
                {t(`verticals.${v}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!initial ? (
        <div className="space-y-1.5">
          <Label>{t("openingPackage")}</Label>
          <div className="flex flex-wrap gap-2">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  packageId === pkg.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => choosePackage(pkg.id)}
              >
                {t(`packages.${pkg.id}.name`)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t(`packages.${packageId}.hint`)}</p>
          <p className="text-xs text-muted-foreground">{t("templateHint")}</p>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="gig-project-status">{t("status")}</Label>
          <select
            id="gig-project-status"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as GigProjectStatus)}
          >
            {GIG_PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gig-project-currency">{t("currency")}</Label>
          <select
            id="gig-project-currency"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        {!initial ? (
          <div className="space-y-1.5">
            <Label htmlFor="gig-project-total">{t("contractTotal")}</Label>
            <Input
              id="gig-project-total"
              type="number"
              min={0}
              step="0.01"
              value={totalHint}
              onChange={(e) => setTotalHint(e.target.value)}
              placeholder="0"
            />
          </div>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="gig-project-notes">{t("notes")}</Label>
        <Input id="gig-project-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {initial ? <p className="text-xs text-muted-foreground">{t("currencyEditHint")}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="rounded-full" disabled={saving || !canSubmit}>
          {t("save")}
        </Button>
        <Button type="button" variant="outline" className="rounded-full" onClick={onCancel} disabled={saving}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
