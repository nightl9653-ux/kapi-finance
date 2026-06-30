import type { TimelineTask } from "@/lib/banquet-party/types";

export const DEFAULT_TIMELINE_SPECS: { labelKey: string; offsetDays: number; time?: string }[] = [
  { labelKey: "confirmGuests", offsetDays: 14 },
  { labelKey: "finalizeMenu", offsetDays: 7 },
  { labelKey: "buyDecor", offsetDays: 3 },
  { labelKey: "setupDecor", offsetDays: 1, time: "14:00" },
  { labelKey: "dayOfWelcome", offsetDays: 0, time: "17:00" },
];

export function createDefaultTimeline(newId: () => string): TimelineTask[] {
  return DEFAULT_TIMELINE_SPECS.map((spec) => ({
    id: newId(),
    labelKey: spec.labelKey,
    offsetDays: spec.offsetDays,
    time: spec.time,
    done: false,
  }));
}

export function taskDueDate(partyDate: string, offsetDays: number): string {
  const d = new Date(partyDate + "T00:00:00");
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}
