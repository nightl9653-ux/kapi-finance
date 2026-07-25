"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newTimelineTaskId } from "@/lib/banquet-party/storage";
import { sortTimelineTasks, taskDueDate, timelineTaskTitle } from "@/lib/banquet-party/timeline";
import type { Party, TimelineTask } from "@/lib/banquet-party/types";
import { cn } from "@/lib/utils";

type Draft = {
  label: string;
  offsetDays: number;
  time: string;
};

const emptyDraft = (): Draft => ({ label: "", offsetDays: 1, time: "" });

function draftFromTask(task: TimelineTask, title: string): Draft {
  return {
    label: title,
    offsetDays: Math.max(0, task.offsetDays),
    time: task.time ?? "",
  };
}

export function PartyTimelineTab({
  party,
  onChange,
}: {
  party: Party;
  onChange: (timeline: TimelineTask[]) => void;
}) {
  const t = useTranslations("banquetParty");
  const timeline = party.timeline ?? [];
  const tasks = sortTimelineTasks(timeline);

  const [addDraft, setAddDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);

  const toggle = (id: string) => {
    onChange(timeline.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
  };

  const addTask = () => {
    const label = addDraft.label.trim();
    if (!label) return;
    const time = addDraft.time.trim() || undefined;
    onChange([
      ...timeline,
      {
        id: newTimelineTaskId(),
        label,
        offsetDays: Math.max(0, Math.floor(addDraft.offsetDays) || 0),
        time,
        done: false,
      },
    ]);
    setAddDraft(emptyDraft());
  };

  const startEdit = (task: TimelineTask) => {
    setEditingId(task.id);
    setEditDraft(draftFromTask(task, timelineTaskTitle(task, t)));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(emptyDraft());
  };

  const saveEdit = () => {
    if (!editingId) return;
    const label = editDraft.label.trim();
    if (!label) return;
    const time = editDraft.time.trim() || undefined;
    const offsetDays = Math.max(0, Math.floor(editDraft.offsetDays) || 0);
    onChange(
      timeline.map((task) => {
        if (task.id !== editingId) return task;
        const sameAsPreset = task.labelKey && label === t(`timeline.task.${task.labelKey}`);
        return {
          ...task,
          label: sameAsPreset ? undefined : label,
          labelKey: sameAsPreset ? task.labelKey : undefined,
          offsetDays,
          time,
        };
      }),
    );
    cancelEdit();
  };

  const removeTask = (id: string) => {
    if (!confirm(t("deleteTimelineTaskConfirm"))) return;
    onChange(timeline.filter((task) => task.id !== id));
    if (editingId === id) cancelEdit();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("timelineLead")}</p>

      <div className="rounded-2xl border bg-gradient-to-br from-[#F4EFEA] to-[#FAF9F7] p-4">
        <p className="text-sm font-medium">{t("addTimelineTask")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_100px_100px_auto]">
          <div className="space-y-1">
            <Label htmlFor="timeline-add-label">{t("timelineTaskLabel")}</Label>
            <Input
              id="timeline-add-label"
              value={addDraft.label}
              onChange={(e) => setAddDraft((d) => ({ ...d, label: e.target.value }))}
              placeholder={t("timelineTaskLabelPlaceholder")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="timeline-add-offset">{t("timelineOffsetDays")}</Label>
            <Input
              id="timeline-add-offset"
              type="number"
              min={0}
              value={addDraft.offsetDays}
              onChange={(e) => setAddDraft((d) => ({ ...d, offsetDays: Number(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="timeline-add-time">{t("timelineTaskTime")}</Label>
            <Input
              id="timeline-add-time"
              type="time"
              value={addDraft.time}
              onChange={(e) => setAddDraft((d) => ({ ...d, time: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" className="w-full rounded-full sm:w-auto" onClick={addTask}>
              {t("addTimelineTask")}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("timelineOffsetHint")}</p>
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("noTimelineTasks")}
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => {
            const due = taskDueDate(party.date, task.offsetDays);
            const title = timelineTaskTitle(task, t);
            const isEditing = editingId === task.id;

            if (isEditing) {
              return (
                <li key={task.id} className="rounded-2xl border bg-white/90 p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_100px_100px]">
                    <div className="space-y-1">
                      <Label htmlFor={`timeline-edit-label-${task.id}`}>{t("timelineTaskLabel")}</Label>
                      <Input
                        id={`timeline-edit-label-${task.id}`}
                        value={editDraft.label}
                        onChange={(e) => setEditDraft((d) => ({ ...d, label: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`timeline-edit-offset-${task.id}`}>{t("timelineOffsetDays")}</Label>
                      <Input
                        id={`timeline-edit-offset-${task.id}`}
                        type="number"
                        min={0}
                        value={editDraft.offsetDays}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, offsetDays: Number(e.target.value) || 0 }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`timeline-edit-time-${task.id}`}>{t("timelineTaskTime")}</Label>
                      <Input
                        id={`timeline-edit-time-${task.id}`}
                        type="time"
                        value={editDraft.time}
                        onChange={(e) => setEditDraft((d) => ({ ...d, time: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" className="rounded-full" onClick={saveEdit}>
                      {t("saveTimelineTask")}
                    </Button>
                    <Button type="button" variant="outline" className="rounded-full" onClick={cancelEdit}>
                      {t("cancel")}
                    </Button>
                    <button
                      type="button"
                      className="ml-auto text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => removeTask(task.id)}
                    >
                      {t("delete")}
                    </button>
                  </div>
                </li>
              );
            }

            return (
              <li key={task.id}>
                <div
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border p-4 transition-colors",
                    task.done ? "border-emerald-200/80 bg-emerald-50/40" : "bg-white/80",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggle(task.id)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    aria-pressed={task.done}
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
                        {title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {task.offsetDays === 0
                          ? t("timelineDayOf")
                          : t("timelineDaysBefore", { n: task.offsetDays })}
                        {" · "}
                        {due}
                        {task.time ? ` · ${task.time}` : ""}
                      </p>
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-col gap-1 pt-0.5 sm:flex-row sm:gap-2">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => startEdit(task)}
                    >
                      {t("edit")}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => removeTask(task.id)}
                    >
                      {t("delete")}
                    </button>
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
