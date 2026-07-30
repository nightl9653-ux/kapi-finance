import { contactStats, meetingsForContact } from "@/lib/meetings/stats";
import { isoToday, type Contact, type MeetingsStore } from "@/lib/meetings/types";

export type AdviceTone = "nurture" | "reconnect" | "caution" | "celebrate" | "observe";

/** Contextual (from meetup history) */
export type AdviceKey =
  | "firstMeetup"
  | "thinData"
  | "reconnectLong"
  | "reconnectWarm"
  | "checkInSoon"
  | "keepDistance"
  | "gentleBoundary"
  | "deepenBond"
  | "strikeWhileWarm"
  | "repairGently"
  | "coolingTrend"
  | "steadyGood"
  | "logMoreFeelings";

/** Always available in the friend-detail dropdown */
export const STATIC_ADVICE_KEYS = [
  "sendHello",
  "shortCoffee",
  "politeOnly",
  "noteWhatTheyLike",
  "lowerPace",
  "thankFollowUp",
] as const;

export type StaticAdviceKey = (typeof STATIC_ADVICE_KEYS)[number];

export type ContactAdvice = {
  key: AdviceKey | StaticAdviceKey;
  tone: AdviceTone;
  priority: number;
  params: Record<string, string | number>;
  group: "contextual" | "common";
};

function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function daysBetween(fromIso: string, toIso: string): number | null {
  const a = parseIsoDate(fromIso);
  const b = parseIsoDate(toIso);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function avgOf(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10;
}

function contextualAdvice(
  contact: Contact,
  store: MeetingsStore,
  today: string,
): ContactAdvice[] {
  const list = meetingsForContact(store, contact.id);
  const stats = contactStats(store, contact.id);
  const name = contact.name;
  const out: ContactAdvice[] = [];

  if (list.length === 0) {
    out.push({
      key: "firstMeetup",
      tone: "nurture",
      priority: 40,
      params: { name },
      group: "contextual",
    });
    return out;
  }

  const days = stats.lastMetOn ? daysBetween(stats.lastMetOn, today) : null;
  const average = stats.average ?? 0;
  const latest = list[0]!;
  const withFeeling = list.filter((m) => m.feeling && m.feeling.trim().length > 0).length;

  if (list.length <= 2) {
    out.push({
      key: "thinData",
      tone: "observe",
      priority: 35,
      params: { name, count: list.length },
      group: "contextual",
    });
  }

  if (average <= -4) {
    out.push({
      key: "keepDistance",
      tone: "caution",
      priority: 90,
      params: { name, avg: average },
      group: "contextual",
    });
  } else if (average <= -1.5) {
    out.push({
      key: "gentleBoundary",
      tone: "caution",
      priority: 75,
      params: { name, avg: average },
      group: "contextual",
    });
  }

  if (days != null && days >= 90 && average >= 2) {
    out.push({
      key: "reconnectWarm",
      tone: "reconnect",
      priority: 85,
      params: { name, days, avg: average },
      group: "contextual",
    });
  } else if (days != null && days >= 60) {
    out.push({
      key: "reconnectLong",
      tone: "reconnect",
      priority: 80,
      params: { name, days, avg: average },
      group: "contextual",
    });
  } else if (days != null && days >= 28 && average >= 3) {
    out.push({
      key: "checkInSoon",
      tone: "nurture",
      priority: 55,
      params: { name, days, avg: average },
      group: "contextual",
    });
  }

  if (latest.score >= 6 && (days == null || days <= 21) && average >= 2) {
    out.push({
      key: "strikeWhileWarm",
      tone: "celebrate",
      priority: 70,
      params: { name, score: latest.score },
      group: "contextual",
    });
  } else if (average >= 5 && list.length >= 3 && (days == null || days <= 45)) {
    out.push({
      key: "deepenBond",
      tone: "celebrate",
      priority: 60,
      params: { name, avg: average },
      group: "contextual",
    });
  } else if (average >= 3 && list.length >= 3 && days != null && days < 28) {
    out.push({
      key: "steadyGood",
      tone: "nurture",
      priority: 30,
      params: { name, avg: average },
      group: "contextual",
    });
  }

  if (list.length >= 2 && latest.score <= average - 4 && latest.score <= 0) {
    out.push({
      key: "repairGently",
      tone: "caution",
      priority: 78,
      params: { name, score: latest.score, avg: average },
      group: "contextual",
    });
  }

  if (list.length >= 4) {
    const recentAvg = avgOf(list.slice(0, 2).map((m) => m.score));
    const olderAvg = avgOf(list.slice(2).map((m) => m.score));
    if (recentAvg <= olderAvg - 3 && recentAvg < 2) {
      out.push({
        key: "coolingTrend",
        tone: "observe",
        priority: 72,
        params: { name, recent: recentAvg, earlier: olderAvg },
        group: "contextual",
      });
    }
  }

  if (list.length >= 3 && withFeeling / list.length < 0.35) {
    out.push({
      key: "logMoreFeelings",
      tone: "observe",
      priority: 15,
      params: { name },
      group: "contextual",
    });
  }

  const seen = new Set<string>();
  return out
    .filter((a) => {
      if (seen.has(a.key)) return false;
      seen.add(a.key);
      return true;
    })
    .sort((a, b) => b.priority - a.priority);
}

function commonAdvice(name: string): ContactAdvice[] {
  return STATIC_ADVICE_KEYS.map((key, i) => ({
    key,
    tone: "nurture" as const,
    priority: 10 - i,
    params: { name },
    group: "common" as const,
  }));
}

/** Dropdown options for one friend: contextual first, then common presets. */
export function adviceOptionsForContact(
  contact: Contact,
  store: MeetingsStore,
  today: string = isoToday(),
): { contextual: ContactAdvice[]; common: ContactAdvice[] } {
  const contextual = contextualAdvice(contact, store, today);
  const used = new Set(contextual.map((a) => a.key));
  const common = commonAdvice(contact.name).filter((a) => !used.has(a.key));
  return { contextual, common };
}
