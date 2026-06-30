"use client";

import { useTranslations } from "next-intl";

import type { PartyDetailTab } from "@/lib/banquet-party/types";
import { cn } from "@/lib/utils";

const TABS: PartyDetailTab[] = ["overview", "aesthetics", "prep", "guests", "timeline"];

export function PartyTabBar({ active, onChange }: { active: PartyDetailTab; onChange: (tab: PartyDetailTab) => void }) {
  const t = useTranslations("banquetParty");

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
            active === tab ? "border-foreground bg-foreground text-background" : "bg-white/80 text-muted-foreground hover:text-foreground",
          )}
        >
          {t(`tab.${tab}`)}
        </button>
      ))}
    </div>
  );
}
