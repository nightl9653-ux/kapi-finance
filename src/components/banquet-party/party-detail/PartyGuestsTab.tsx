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

type GuestDraft = { tableLabel: string; dietaryNotes: string; contact: string };

/** 合并旧 phone/email 到单一联系方式 */
function guestContact(g: Guest): string {
  return g.contact?.trim() || g.phone?.trim() || g.email?.trim() || "";
}

function emptyDraft(g: Guest): GuestDraft {
  return {
    tableLabel: g.tableLabel ?? "",
    dietaryNotes: g.dietaryNotes ?? "",
    contact: guestContact(g),
  };
}

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
  /** 文本字段本地草稿：避免每键都写库导致丢字 */
  const [drafts, setDrafts] = useState<Record<string, GuestDraft>>({});

  const draftOf = (g: Guest): GuestDraft => drafts[g.id] ?? emptyDraft(g);

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

  const setDraftField = (id: string, field: keyof GuestDraft, value: string) => {
    setDrafts((prev) => {
      const guest = guests.find((g) => g.id === id);
      const base = prev[id] ?? (guest ? emptyDraft(guest) : { tableLabel: "", dietaryNotes: "", contact: "" });
      return { ...prev, [id]: { ...base, [field]: value } };
    });
  };

  const commitDraft = (g: Guest) => {
    const d = draftOf(g);
    const tableLabel = d.tableLabel.trim() || undefined;
    const dietaryNotes = d.dietaryNotes.trim() || undefined;
    const contact = d.contact.trim() || undefined;
    const same =
      (g.tableLabel ?? "") === (tableLabel ?? "") &&
      (g.dietaryNotes ?? "") === (dietaryNotes ?? "") &&
      guestContact(g) === (contact ?? "");
    setDrafts((prev) => {
      if (!(g.id in prev)) return prev;
      const next = { ...prev };
      delete next[g.id];
      return next;
    });
    if (same) return;
    // 写入 contact，并清掉旧的 phone/email 字段
    updateGuest(g.id, { tableLabel, dietaryNotes, contact, phone: undefined, email: undefined });
  };

  const removeGuest = (id: string) => {
    if (!confirm(t("deleteGuestConfirm"))) return;
    setDrafts((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
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
          {guests.map((g) => {
            const draft = draftOf(g);
            return (
              <li key={g.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {g.name}
                      {g.tableLabel?.trim() ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">· {g.tableLabel.trim()}</span>
                      ) : null}
                    </p>
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
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`guest-table-${g.id}`} className="text-xs text-muted-foreground">
                      {t("guestTableLabel")}
                    </Label>
                    <Input
                      id={`guest-table-${g.id}`}
                      value={draft.tableLabel}
                      onChange={(e) => setDraftField(g.id, "tableLabel", e.target.value)}
                      onBlur={() => commitDraft(g)}
                      placeholder={t("guestTablePlaceholder")}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`guest-dietary-${g.id}`} className="text-xs text-muted-foreground">
                      {t("guestDietaryLabel")}
                    </Label>
                    <Input
                      id={`guest-dietary-${g.id}`}
                      value={draft.dietaryNotes}
                      onChange={(e) => setDraftField(g.id, "dietaryNotes", e.target.value)}
                      onBlur={() => commitDraft(g)}
                      placeholder={t("guestDietaryPlaceholder")}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor={`guest-contact-${g.id}`} className="text-xs text-muted-foreground">
                      {t("guestContactLabel")}
                    </Label>
                    <Input
                      id={`guest-contact-${g.id}`}
                      value={draft.contact}
                      onChange={(e) => setDraftField(g.id, "contact", e.target.value)}
                      onBlur={() => commitDraft(g)}
                      placeholder={t("guestContactPlaceholder")}
                      className="text-sm"
                      autoComplete="off"
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
