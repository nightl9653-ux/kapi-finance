"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { ProjectDetailTab } from "@/lib/house-renovation/types";
import { cn } from "@/lib/utils";

const TABS: ProjectDetailTab[] = ["overview", "materials"];

export function ProjectTabBar({ active, onChange }: { active: ProjectDetailTab; onChange: (t: ProjectDetailTab) => void }) {
  const t = useTranslations("houseRenovation");

  return (
    <div className="flex gap-1 rounded-full border bg-white/60 p-1">
      {TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={cn(
            "flex-1 rounded-full px-3 py-1.5 text-sm transition-colors",
            active === tab ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(`tab.${tab}`)}
        </button>
      ))}
    </div>
  );
}
