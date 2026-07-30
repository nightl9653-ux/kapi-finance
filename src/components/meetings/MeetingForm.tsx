"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clampMeetingScore,
  isoToday,
  MEETING_SCORE_MAX,
  MEETING_SCORE_MIN,
  newEntityId,
  type Contact,
  type Meeting,
} from "@/lib/meetings/types";

export function MeetingForm({
  contacts,
  initial,
  defaultContactId,
  onCancel,
  onSave,
}: {
  contacts: Contact[];
  initial?: Meeting;
  defaultContactId?: string;
  onCancel: () => void;
  onSave: (meeting: Meeting) => void | Promise<void>;
}) {
  const t = useTranslations("meetingsPage");
  const [contactId, setContactId] = useState(
    initial?.contactId ?? defaultContactId ?? contacts[0]?.id ?? "",
  );
  const [metOn, setMetOn] = useState(initial?.metOn ?? isoToday());
  const [occasion, setOccasion] = useState(initial?.occasion ?? "");
  const [score, setScore] = useState(String(initial?.score ?? 0));
  const [feeling, setFeeling] = useState(initial?.feeling ?? "");
  const [submitting, setSubmitting] = useState(false);

  if (contacts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
        {t("needFriendFirst")}
        <div className="mt-3">
          <Button type="button" variant="outline" className="rounded-full" onClick={onCancel}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4 rounded-2xl border bg-gradient-to-br from-[#F4EFEA] to-[#FAF9F7] p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!contactId || submitting) return;
        const now = new Date().toISOString();
        setSubmitting(true);
        void Promise.resolve(
          onSave({
            id: initial?.id ?? newEntityId(),
            contactId,
            metOn,
            occasion: occasion.trim() || undefined,
            score: clampMeetingScore(Number(score)),
            feeling: feeling.trim() || undefined,
            createdAt: initial?.createdAt ?? now,
            updatedAt: now,
          }),
        ).finally(() => setSubmitting(false));
      }}
    >
      <h2 className="text-base font-medium">{initial ? t("editMeeting") : t("newMeeting")}</h2>
      <div className="space-y-1.5">
        <Label htmlFor="meeting-friend">{t("friend")}</Label>
        <select
          id="meeting-friend"
          className="flex h-9 w-full rounded-md border bg-white px-3 text-sm"
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          required
        >
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.alias ? `${c.name} · ${c.alias}` : c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="meeting-date">{t("metOn")}</Label>
          <Input
            id="meeting-date"
            type="date"
            value={metOn}
            onChange={(e) => setMetOn(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meeting-occasion">{t("occasion")}</Label>
          <Input
            id="meeting-occasion"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            placeholder={t("occasionPlaceholder")}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="meeting-score">
          {t("score")}{" "}
          <span className="font-normal text-muted-foreground">
            ({MEETING_SCORE_MIN} – {MEETING_SCORE_MAX})
          </span>
        </Label>
        <Input
          id="meeting-score"
          type="number"
          min={MEETING_SCORE_MIN}
          max={MEETING_SCORE_MAX}
          step={1}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="meeting-feeling">{t("feeling")}</Label>
        <textarea
          id="meeting-feeling"
          value={feeling}
          onChange={(e) => setFeeling(e.target.value)}
          rows={3}
          placeholder={t("feelingPlaceholder")}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="rounded-full" onClick={onCancel} disabled={submitting}>
          {t("cancel")}
        </Button>
        <Button type="submit" className="rounded-full" disabled={submitting}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
