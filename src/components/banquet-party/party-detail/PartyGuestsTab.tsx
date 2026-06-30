"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getGuestHeadcount } from "@/lib/banquet-party/budget";
import { newGuestId } from "@/lib/banquet-party/storage";
import type { Guest, GuestRsvp, Party } from "@/lib/banquet-party/types";
import { cn } from "@/lib/utils";

const RSVP_OPTIONS: GuestRsvp[] = ["pending", "confirmed", "declined"];

export function PartyGuestsTab({
  party,
  onChange,
}: {
  party: Party;
  onChange: (guests: Guest[]) => void;
}) {
  const t = useTranslations("banquetParty");
  const guests = party.guests ?? [];
  const { confirmed, total } = getGuestHeadcount(party);
  const [name, setName] = useState("");
  const [count, setCount] = useState(1);

  const addGuest = () => {
    if (!name.trim()) return;
    onChange([
      ...guests,
      {
        id: newGuestId(),
        name: name.trim(),
        count: Math.max(1, count),
        rsvp: "pending",
      },
    ]);
    setName("");
    setCount(1);
  };

  const updateGuest = (id: string, patch: Partial<Guest>) => {
    onChange(guests.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const removeGuest = (id: string) => {
    if (!confirm(t("deleteGuestConfirm"))) return;
    onChange(guests.filter((g) => g.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white/80 p-4">
        <p className="text-sm font-medium">{t("guestSummary")}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {t("overviewGuestCount", { confirmed, total })}
        </p>
      </div>

      <div className="rounded-2xl border bg-gradient-to-br from-[#F4EFEA] to-[#FAF9F7] p-4">
        <p className="text-sm font-medium">{t("addGuest")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_80px_auto]">
          <div className="space-y-1">
            <Label htmlFor="guest-name">{t("guestName")}</Label>
            <Input
              id="guest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("guestNamePlaceholder")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="guest-count">{t("guestCount")}</Label>
            <Input
              id="guest-count"
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 1)}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" className="w-full rounded-full sm:w-auto" onClick={addGuest}>
              {t("addGuest")}
            </Button>
          </div>
        </div>
      </div>

      {guests.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("noGuests")}</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-white/80">
          {guests.map((g) => (
            <li key={g.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{g.name}</p>
                  <p className="text-xs text-muted-foreground">{t("guestCountLabel", { n: g.count })}</p>
                </div>
                <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => removeGuest(g.id)}>
                  {t("delete")}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {RSVP_OPTIONS.map((rsvp) => (
                  <button
                    key={rsvp}
                    type="button"
                    onClick={() => updateGuest(g.id, { rsvp })}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs",
                      g.rsvp === rsvp ? "border-foreground bg-foreground text-background" : "text-muted-foreground",
                    )}
                  >
                    {t(`rsvp.${rsvp}`)}
                  </button>
                ))}
              </div>
              <Input
                value={g.dietaryNotes ?? ""}
                onChange={(e) => updateGuest(g.id, { dietaryNotes: e.target.value })}
                placeholder={t("guestDietaryPlaceholder")}
                className="text-sm"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
