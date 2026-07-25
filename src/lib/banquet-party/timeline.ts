import type { TimelineTask } from "@/lib/banquet-party/types";

type TFn = (key: string, values?: Record<string, string | number>) => string;

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

/** 展示标题：自定义 label 优先，否则用预设 i18n */
export function timelineTaskTitle(task: TimelineTask, t: TFn): string {
  const custom = task.label?.trim();
  if (custom) return custom;
  if (task.labelKey) return t(`timeline.task.${task.labelKey}`);
  return "";
}

export function sortTimelineTasks(tasks: TimelineTask[]): TimelineTask[] {
  return [...tasks].sort((a, b) => {
    if (b.offsetDays !== a.offsetDays) return b.offsetDays - a.offsetDays;
    return (a.time ?? "").localeCompare(b.time ?? "");
  });
}
