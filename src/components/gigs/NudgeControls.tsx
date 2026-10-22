"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addIsoDays, isIsoDate } from "@/lib/gigs/money";
import { isoToday } from "@/lib/gigs/types";

export function NudgeControls({
  rowKey,
  nextNudgeOn,
  disabled,
  onMarkNudged,
}: {
  rowKey: string;
  nextNudgeOn?: string;
  disabled?: boolean;
  onMarkNudged: (nextOn: string) => void;
}) {
  return (
    <NudgeFields
      key={`${rowKey}:${nextNudgeOn ?? ""}`}
      rowKey={rowKey}
      nextNudgeOn={nextNudgeOn}
      disabled={disabled}
      onMarkNudged={onMarkNudged}
    />
  );
}

function NudgeFields({
  rowKey,
  nextNudgeOn,
  disabled,
  onMarkNudged,
}: {
  rowKey: string;
  nextNudgeOn?: string;
  disabled?: boolean;
  onMarkNudged: (nextOn: string) => void;
}) {
  const t = useTranslations("gigs");
  const [draft, setDraft] = useState(
    nextNudgeOn && isIsoDate(nextNudgeOn) ? nextNudgeOn : addIsoDays(isoToday(), 7),
  );

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor={`nudge-${rowKey}`} className="text-xs text-muted-foreground">
          {t("nextNudgeOn")}
        </Label>
        <Input
          id={`nudge-${rowKey}`}
          type="date"
          className="h-8 w-[9.5rem]"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-full"
        disabled={disabled}
        onClick={() => onMarkNudged(isIsoDate(draft) ? draft : addIsoDays(isoToday(), 7))}
      >
        {t("markNudged")}
      </Button>
    </div>
  );
}
