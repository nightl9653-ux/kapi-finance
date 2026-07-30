"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { ContactDetail } from "@/components/meetings/ContactDetail";
import { ContactForm } from "@/components/meetings/ContactForm";
import { MeetingForm } from "@/components/meetings/MeetingForm";
import { Button } from "@/components/ui/button";
import {
  deleteContact,
  deleteMeeting,
  loadMeetingsStore,
  upsertContact,
  upsertMeeting,
} from "@/lib/meetings/storage";
import { contactStats, formatScore, recentMeetings, sortedContacts } from "@/lib/meetings/stats";
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

function isSchemaMissing(err: unknown): boolean {
  const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined;
  const msg = err instanceof Error ? err.message : "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /social_contacts|social_meetings|schema cache|does not exist/i.test(msg)
  );
}

export function MeetingsApp({ userId }: { userId: string }) {
  const t = useTranslations("meetingsPage");
  const nav = useTranslations("nav");
  const locale = useLocale();
  const [store, setStore] = useState<MeetingsStore>({ contacts: [], meetings: [] });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creatingFriend, setCreatingFriend] = useState(false);
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  const refresh = useCallback(async () => {
    setReady(false);
    setError(null);
    try {
      setStore(await loadMeetingsStore(userId));
    } catch (e) {
      setError(isSchemaMissing(e) ? t("schemaMissing") : t("loadError"));
    } finally {
      setReady(true);
    }
  }, [userId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const contacts = useMemo(() => sortedContacts(store), [store]);
  const recent = useMemo(() => recentMeetings(store, 8), [store]);
  const contactById = useMemo(() => {
    const map = new Map(store.contacts.map((c) => [c.id, c]));
    return map;
  }, [store.contacts]);

  const active = activeId ? store.contacts.find((c) => c.id === activeId) : undefined;

  const handleUpsertContact = async (c: Contact) => {
    setSaving(true);
    setError(null);
    try {
      const next = await upsertContact(userId, c);
      setStore(next);
      setActiveId(c.id);
    } catch (e) {
      setError(isSchemaMissing(e) ? t("schemaMissing") : t("saveError"));
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      setStore(await deleteContact(userId, id));
      setActiveId(null);
    } catch (e) {
      setError(isSchemaMissing(e) ? t("schemaMissing") : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleUpsertMeeting = async (m: Meeting) => {
    setSaving(true);
    setError(null);
    try {
      const next = await upsertMeeting(userId, m);
      setStore(next);
      setActiveId(m.contactId);
    } catch (e) {
      setError(isSchemaMissing(e) ? t("schemaMissing") : t("saveError"));
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      setStore(await deleteMeeting(userId, id));
    } catch (e) {
      setError(isSchemaMissing(e) ? t("schemaMissing") : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  }

  if (active) {
    return (
      <div className="space-y-4">
        {error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
            <button type="button" className="ml-2 underline" onClick={() => void refresh()}>
              {t("retry")}
            </button>
          </div>
        ) : null}
        <ContactDetail
          contact={active}
          store={store}
          busy={saving}
          onBack={() => setActiveId(null)}
          onUpsertContact={handleUpsertContact}
          onDeleteContact={handleDeleteContact}
          onUpsertMeeting={handleUpsertMeeting}
          onDeleteMeeting={handleDeleteMeeting}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{nav("meetings")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          <button type="button" className="ml-2 underline" onClick={() => void refresh()}>
            {t("retry")}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="rounded-full"
          disabled={saving}
          onClick={() => setCreatingFriend(true)}
        >
          {t("newFriend")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => setCreatingMeeting(true)}
          disabled={saving || store.contacts.length === 0}
        >
          {t("newMeeting")}
        </Button>
        <Link
          href={`/${locale}/transactions`}
          className="self-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t("goToTransactions")}
        </Link>
      </div>

      {creatingFriend ? (
        <ContactForm
          mode="create"
          onCancel={() => setCreatingFriend(false)}
          onSave={async (c) => {
            await handleUpsertContact(c);
            setCreatingFriend(false);
          }}
        />
      ) : null}

      {creatingMeeting ? (
        <MeetingForm
          contacts={store.contacts}
          onCancel={() => setCreatingMeeting(false)}
          onSave={async (m) => {
            await handleUpsertMeeting(m);
            setCreatingMeeting(false);
          }}
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-medium">{t("friendsTitle")}</h2>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noFriends")}</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-white/60">
            {contacts.map((c) => {
              const s = contactStats(store, c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-black/[0.02]"
                    onClick={() => setActiveId(c.id)}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[c.relation, s.lastMetOn ? t("lastMetOn", { date: s.lastMetOn }) : null]
                          .filter(Boolean)
                          .join(" · ") || t("noMeetingsYet")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <p className="tabular-nums text-muted-foreground">
                        {t("meetupCountShort", { count: s.count })}
                      </p>
                      <p>{s.average == null ? "—" : <ScoreBadge score={s.average} />}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium">{t("recentTitle")}</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noRecent")}</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((m) => {
              const friend = contactById.get(m.contactId);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 rounded-2xl border bg-white/60 px-4 py-3 text-left hover:bg-black/[0.02]"
                    onClick={() => setActiveId(m.contactId)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        <span className="tabular-nums">{m.metOn}</span>
                        <span className="text-muted-foreground"> · {friend?.name ?? "—"}</span>
                      </p>
                      {m.occasion ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{m.occasion}</p>
                      ) : null}
                      {m.feeling ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.feeling}</p>
                      ) : null}
                    </div>
                    <ScoreBadge score={m.score} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
