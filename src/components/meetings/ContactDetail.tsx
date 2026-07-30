"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { MeetingForm } from "@/components/meetings/MeetingForm";
import { ContactForm } from "@/components/meetings/ContactForm";
import { ContactAdviceSection } from "@/components/meetings/ContactAdviceSection";
import { Button } from "@/components/ui/button";
import { contactStats, formatScore, meetingsForContact } from "@/lib/meetings/stats";
import type { Contact, Meeting, MeetingsStore } from "@/lib/meetings/types";
import { cn } from "@/lib/utils";

function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "tabular-nums font-medium",
        score > 0 && "text-emerald-700",
        score < 0 && "text-rose-700",
        score === 0 && "text-muted-foreground",
      )}
    >
      {formatScore(score)}
    </span>
  );
}

export function ContactDetail({
  contact,
  store,
  busy = false,
  onBack,
  onUpsertContact,
  onDeleteContact,
  onUpsertMeeting,
  onDeleteMeeting,
}: {
  contact: Contact;
  store: MeetingsStore;
  busy?: boolean;
  onBack: () => void;
  onUpsertContact: (c: Contact) => void | Promise<void>;
  onDeleteContact: (id: string) => void | Promise<void>;
  onUpsertMeeting: (m: Meeting) => void | Promise<void>;
  onDeleteMeeting: (id: string) => void | Promise<void>;
}) {
  const t = useTranslations("meetingsPage");
  const [editing, setEditing] = useState(false);
  const [addingMeeting, setAddingMeeting] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  const stats = useMemo(() => contactStats(store, contact.id), [store, contact.id]);
  const meetings = useMemo(() => meetingsForContact(store, contact.id), [store, contact.id]);

  if (editing) {
    return (
      <ContactForm
        mode="edit"
        initial={contact}
        onCancel={() => setEditing(false)}
        onSave={async (c) => {
          await onUpsertContact(c);
          setEditing(false);
        }}
      />
    );
  }

  if (addingMeeting || editingMeeting) {
    return (
      <MeetingForm
        contacts={[contact]}
        defaultContactId={contact.id}
        initial={editingMeeting ?? undefined}
        onCancel={() => {
          setAddingMeeting(false);
          setEditingMeeting(null);
        }}
        onSave={async (m) => {
          await onUpsertMeeting(m);
          setAddingMeeting(false);
          setEditingMeeting(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={onBack}
          >
            ← {t("back")}
          </button>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{contact.name}</h1>
          {contact.alias ? <p className="text-sm text-muted-foreground">{contact.alias}</p> : null}
          {contact.relation ? (
            <p className="mt-1 text-sm text-muted-foreground">{contact.relation}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            {t("editFriend")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full text-destructive"
            disabled={busy}
            onClick={() => {
              if (window.confirm(t("deleteFriendConfirm"))) void onDeleteContact(contact.id);
            }}
          >
            {t("deleteFriend")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white/60 p-4">
          <p className="text-xs text-muted-foreground">{t("meetupCount")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{stats.count}</p>
        </div>
        <div className="rounded-2xl border bg-white/60 p-4">
          <p className="text-xs text-muted-foreground">{t("averageScore")}</p>
          <p className="mt-1 text-xl font-semibold">
            {stats.average == null ? "—" : <ScoreBadge score={stats.average} />}
          </p>
        </div>
        <div className="rounded-2xl border bg-white/60 p-4">
          <p className="text-xs text-muted-foreground">{t("lastMet")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{stats.lastMetOn ?? "—"}</p>
        </div>
      </div>

      <ContactAdviceSection contact={contact} store={store} onChange={onUpsertContact} />

      {(contact.phone || contact.email || contact.notes) && (
        <div className="rounded-2xl border bg-white/60 p-4 text-sm space-y-1">
          {contact.phone ? (
            <p>
              <span className="text-muted-foreground">{t("phone")}：</span>
              {contact.phone}
            </p>
          ) : null}
          {contact.email ? (
            <p>
              <span className="text-muted-foreground">{t("email")}：</span>
              {contact.email}
            </p>
          ) : null}
          {contact.notes ? (
            <p className="whitespace-pre-wrap">
              <span className="text-muted-foreground">{t("notes")}：</span>
              {contact.notes}
            </p>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-medium">{t("recordsTitle")}</h2>
        <Button type="button" className="rounded-full" onClick={() => setAddingMeeting(true)}>
          {t("newMeeting")}
        </Button>
      </div>

      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noMeetingsForFriend")}</p>
      ) : (
        <ul className="space-y-3">
          {meetings.map((m) => (
            <li key={m.id} className="rounded-2xl border bg-white/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium tabular-nums">
                    {m.metOn}
                    {m.occasion ? (
                      <span className="font-normal text-muted-foreground"> · {m.occasion}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm">
                    {t("score")}：<ScoreBadge score={m.score} />
                  </p>
                  {m.feeling ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{m.feeling}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setEditingMeeting(m)}
                  >
                    {t("edit")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-destructive"
                    onClick={() => {
                      if (window.confirm(t("deleteMeetingConfirm"))) onDeleteMeeting(m.id);
                    }}
                  >
                    {t("delete")}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
