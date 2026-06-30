"use client";

import { useTranslations } from "next-intl";

import { taskDueDate } from "@/lib/banquet-party/timeline";
import type { Party, TimelineTask } from "@/lib/banquet-party/types";
import { cn } from "@/lib/utils";

export function PartyTimelineTab({
  party,
  onChange,
}: {
  party: Party;
  onChange: (timeline: TimelineTask[]) => void;
}) {
  const t = useTranslations("banquetParty");
  const tasks = [...(party.timeline ?? [])].sort((a, b) => b.offsetDays - a.offsetDays);

  const toggle = (id: string) => {
    onChange((party.timeline ?? []).map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("timelineLead")}</p>
      <ul className="space-y-2">
        {tasks.map((task) => {
          const due = taskDueDate(party.date, task.offsetDays);
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => toggle(task.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                  task.done ? "border-emerald-200/80 bg-emerald-50/40" : "bg-white/80 hover:bg-muted/20",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs",
                    task.done ? "border-emerald-600 bg-emerald-600 text-white" : "border-muted-foreground/40",
                  )}
                >
                  {task.done ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", task.done && "text-muted-foreground line-through")}>
                    {t(`timeline.task.${task.labelKey}`)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {task.offsetDays === 0 ? t("timelineDayOf") : t("timelineDaysBefore", { n: task.offsetDays })}
                    {" · "}
                    {due}
                    {task.time ? ` · ${task.time}` : ""}
                  </p>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
