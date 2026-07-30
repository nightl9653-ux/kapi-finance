import type { Contact, Meeting, MeetingsStore } from "@/lib/meetings/types";

export type ContactStats = {
  count: number;
  average: number | null;
  lastMetOn: string | null;
};

export function meetingsForContact(store: MeetingsStore, contactId: string): Meeting[] {
  return store.meetings
    .filter((m) => m.contactId === contactId)
    .sort((a, b) => (a.metOn < b.metOn ? 1 : a.metOn > b.metOn ? -1 : 0));
}

export function contactStats(store: MeetingsStore, contactId: string): ContactStats {
  const list = meetingsForContact(store, contactId);
  if (list.length === 0) {
    return { count: 0, average: null, lastMetOn: null };
  }
  const sum = list.reduce((acc, m) => acc + m.score, 0);
  return {
    count: list.length,
    average: Math.round((sum / list.length) * 10) / 10,
    lastMetOn: list[0]!.metOn,
  };
}

export function sortedContacts(store: MeetingsStore): Contact[] {
  return [...store.contacts].sort((a, b) => {
    const sa = contactStats(store, a.id);
    const sb = contactStats(store, b.id);
    if (sa.lastMetOn && sb.lastMetOn && sa.lastMetOn !== sb.lastMetOn) {
      return sa.lastMetOn < sb.lastMetOn ? 1 : -1;
    }
    if (sa.lastMetOn && !sb.lastMetOn) return -1;
    if (!sa.lastMetOn && sb.lastMetOn) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export function recentMeetings(store: MeetingsStore, limit = 12): Meeting[] {
  return [...store.meetings]
    .sort((a, b) => (a.metOn < b.metOn ? 1 : a.metOn > b.metOn ? -1 : 0))
    .slice(0, limit);
}

export function formatScore(score: number): string {
  if (score > 0) return `+${score}`;
  return String(score);
}
