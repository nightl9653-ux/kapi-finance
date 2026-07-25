"use client";

import { useTranslations } from "next-intl";

import { decorAtmosphereLabel, decorZoneDisplay } from "@/lib/banquet-party/decor-labels";
import { DECOR_ZONE_ORDER, groupDecorMaterials, summarizeDecorAtmosphere } from "@/lib/banquet-party/decor";
import type { Party } from "@/lib/banquet-party/types";

export function DecorSummary({ party }: { party: Party }) {
  const t = useTranslations("banquetParty");
  const decorItems = party.materials.filter((m) => m.category === "decor");
  if (decorItems.length === 0) return null;

  const byZone = groupDecorMaterials(decorItems);
  const atmosphere = summarizeDecorAtmosphere(decorItems).slice(0, 8);

  return (
    <div className="rounded-2xl border bg-white/80 p-4">
      <p className="text-sm font-medium">{t("decorSummaryTitle")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("decorSummaryLead")}</p>
      <div className="mt-3 space-y-2">
        {DECOR_ZONE_ORDER.map((zone) => {
          const group = byZone.find((g) => g.zone === zone);
          const count = group?.items.length ?? 0;
          if (count === 0) return null;
          return (
            <div key={zone} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 text-muted-foreground">{decorZoneDisplay(t, zone)}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full bg-foreground/70"
                  style={{ width: `${Math.min(100, (count / decorItems.length) * 100)}%` }}
                />
              </div>
              <span className="w-6 shrink-0 tabular-nums text-muted-foreground">{count}</span>
            </div>
          );
        })}
      </div>
      {atmosphere.length > 0 ? (
        <div className="mt-4 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">{t("decorAtmosphereSummary")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {atmosphere.map(({ tag, count }) => (
              <span key={tag} className="rounded-full border bg-muted/20 px-2 py-0.5 text-[10px] text-muted-foreground">
                {decorAtmosphereLabel(t, tag)} ×{count}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
