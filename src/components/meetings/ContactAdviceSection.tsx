"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  adviceOptionsForContact,
  type ContactAdvice,
  type StaticAdviceKey,
} from "@/lib/meetings/advice";
import { newEntityId, type Contact, type ContactAdviceItem, type MeetingsStore } from "@/lib/meetings/types";

/** Avoid dynamic next-intl keys (can throw / bloat compile); resolve tips in-app. */
function formatTip(locale: string, tip: ContactAdvice): string {
  const zh = locale.startsWith("zh");
  const { key, params: p } = tip;
  const name = String(p.name ?? "");
  const avg = p.avg;
  const days = p.days;
  const score = p.score;
  const count = p.count;
  const recent = p.recent;
  const earlier = p.earlier;

  const table: Record<string, string> = zh
    ? {
        firstMeetup: `和${name}还没有见面记录。可先安排一次轻松短聚，或把偶然碰上的感受记下来。`,
        thinData: `和${name}只有 ${count} 次记录，样本还薄。先多记几次，再下重判断。`,
        reconnectLong: `和${name}已有 ${days} 天未见（均分 ${avg}）。发条近况或约一次短聚，比突然深聊更稳。`,
        reconnectWarm: `和${name}已 ${days} 天未见，但均分不错（${avg}）。值得主动续上：一句问候或轻量邀约即可。`,
        checkInSoon: `和${name}已 ${days} 天未见，关系偏暖（均分 ${avg}）。近期保持一次轻联系，避免热度掉下去。`,
        keepDistance: `和${name}的均分偏低（${avg}）。优先保护精力：减少主动投入，必要时只维持礼貌往来。`,
        gentleBoundary: `和${name}的均分偏冷（${avg}）。见面宜短、边界清晰，先观察再决定是否加深。`,
        deepenBond: `和${name}均分较高（${avg}）。可以考虑稍深一点的共同安排，或记住对方在意的小事。`,
        strikeWhileWarm: `刚和${name}有一次高分见面（${score}）。趁热乎跟进一句感谢或下一步小约定，效果通常更好。`,
        repairGently: `最近一次和${name}的分数（${score}）明显低于均分（${avg}）。先弄清原因，再决定是轻声修补还是先降温。`,
        coolingTrend: `和${name}近两次均分（${recent}）低于更早记录（${earlier}）。可放慢节奏、降低期待，先观察一阵。`,
        steadyGood: `和${name}目前状态平稳偏暖（均分 ${avg}）。维持自然节奏即可，不必用力过猛。`,
        logMoreFeelings: `和${name}的见面里感受文字偏少。多写一两句当下感受，以后建议会更准。`,
        sendHello: `给${name}发一条轻松近况问候，不谈正事。`,
        shortCoffee: `约${name}一次短聚（咖啡/散步），控制在一小时内。`,
        politeOnly: `和${name}保持礼貌往来即可，暂不加深。`,
        noteWhatTheyLike: `记下${name}在意的小事（忌口、兴趣、家人），下次用得上。`,
        lowerPace: `放慢和${name}的互动节奏，先观察再投入。`,
        thankFollowUp: `见面后给${name}补一句感谢或小跟进，巩固好感。`,
      }
    : {
        firstMeetup: `No meetup notes with ${name} yet. Plan a light get-together, or log how a chance meeting felt.`,
        thinData: `Only ${count} meetup(s) with ${name} so far. Log a few more before drawing strong conclusions.`,
        reconnectLong: `It has been ${days} days since you met ${name} (avg ${avg}). A short check-in or light invite is safer than a sudden deep talk.`,
        reconnectWarm: `${days} days without seeing ${name}, but the average stays solid (${avg}). Worth a gentle ping—a hello or low-key invite.`,
        checkInSoon: `${days} days since ${name}, and the bond looks warm (avg ${avg}). A light touch soon helps keep the heat.`,
        keepDistance: `Average with ${name} is low (${avg}). Protect your energy: less proactive effort; polite contact is enough if needed.`,
        gentleBoundary: `Average with ${name} runs cool (${avg}). Keep meetups short and clear; watch before going deeper.`,
        deepenBond: `Average with ${name} is high (${avg}). A slightly richer shared plan—or remembering what they care about—can help.`,
        strikeWhileWarm: `Your latest meetup with ${name} scored high (${score}). A quick thank-you or next small plan often lands well now.`,
        repairGently: `The latest score with ${name} (${score}) is well below their average (${avg}). Clarify what happened before repairing—or cool off first.`,
        coolingTrend: `Recent scores with ${name} (${recent}) are cooler than earlier ones (${earlier}). Slow down, lower expectations, and observe.`,
        steadyGood: `Things with ${name} look steady and warm (avg ${avg}). Keep a natural pace—no need to force it.`,
        logMoreFeelings: `Few meetup notes with ${name} include feelings. A sentence or two each time will improve these tips.`,
        sendHello: `Send ${name} a light check-in—no agenda.`,
        shortCoffee: `Invite ${name} to a short meetup (coffee/walk), about an hour.`,
        politeOnly: `Keep things polite with ${name} for now; don’t push deeper.`,
        noteWhatTheyLike: `Jot down what ${name} cares about (food, hobbies, family) for next time.`,
        lowerPace: `Slow the pace with ${name}; observe before investing more.`,
        thankFollowUp: `After meeting ${name}, send a quick thank-you or small follow-up.`,
      };

  return table[key] ?? key;
}

function shortOptionLabel(key: ContactAdvice["key"], locale: string): string {
  const zh = locale.startsWith("zh");
  const labels: Record<string, [string, string]> = {
    firstMeetup: ["先约一次短聚", "Plan a first meetup"],
    thinData: ["样本还少，先多记", "Log a few more meetups"],
    reconnectLong: ["久未见，轻联系", "Reconnect lightly"],
    reconnectWarm: ["关系还暖，主动续上", "Warm bond—reach out"],
    checkInSoon: ["该轻联系了", "Time for a check-in"],
    keepDistance: ["均分偏低，保护精力", "Low score—protect energy"],
    gentleBoundary: ["边界清晰、见面宜短", "Keep clear boundaries"],
    deepenBond: ["可稍加深共同安排", "Deepen the bond a bit"],
    strikeWhileWarm: ["趁热跟进", "Follow up while warm"],
    repairGently: ["最近偏低，先弄清原因", "Latest dip—clarify first"],
    coolingTrend: ["有降温趋势，放慢", "Cooling trend—slow down"],
    steadyGood: ["状态平稳，维持节奏", "Steady—keep the pace"],
    logMoreFeelings: ["多写感受文字", "Write more feeling notes"],
    sendHello: ["发一句问候", "Send a hello"],
    shortCoffee: ["约短聚", "Short coffee/walk"],
    politeOnly: ["礼貌往来即可", "Polite contact only"],
    noteWhatTheyLike: ["记下对方在意的事", "Note what they like"],
    lowerPace: ["放慢节奏", "Lower the pace"],
    thankFollowUp: ["见面后小跟进", "Thank-you follow-up"],
  };
  const pair = labels[key];
  if (!pair) return key;
  return zh ? pair[0] : pair[1];
}

export function ContactAdviceSection({
  contact,
  store,
  onChange,
}: {
  contact: Contact;
  store: MeetingsStore;
  onChange: (next: Contact) => void | Promise<void>;
}) {
  const t = useTranslations("meetingsPage");
  const locale = useLocale();
  const [selected, setSelected] = useState("");
  const [custom, setCustom] = useState("");

  const options = useMemo(() => adviceOptionsForContact(contact, store), [contact, store]);
  const saved = contact.adviceItems ?? [];

  const addItem = (item: ContactAdviceItem) => {
    const nextItems = [item, ...saved];
    void onChange({ ...contact, adviceItems: nextItems, updatedAt: new Date().toISOString() });
  };

  const addFromSelect = () => {
    if (!selected) return;
    const all = [...options.contextual, ...options.common];
    const tip = all.find((a) => a.key === selected);
    if (!tip) return;
    const text = formatTip(locale, tip).trim();
    if (!text) return;
    if (saved.some((s) => s.text === text)) {
      setSelected("");
      return;
    }
    addItem({
      id: newEntityId(),
      text,
      source: "preset",
      presetKey: tip.key,
      createdAt: new Date().toISOString(),
    });
    setSelected("");
  };

  const addCustom = () => {
    const text = custom.trim();
    if (!text) return;
    if (saved.some((s) => s.text === text)) {
      setCustom("");
      return;
    }
    addItem({
      id: newEntityId(),
      text,
      source: "custom",
      createdAt: new Date().toISOString(),
    });
    setCustom("");
  };

  const removeItem = (id: string) => {
    const nextItems = saved.filter((a) => a.id !== id);
    void onChange({
      ...contact,
      adviceItems: nextItems.length > 0 ? nextItems : undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <section className="space-y-3 rounded-2xl border bg-white/60 p-4">
      <div>
        <h2 className="text-base font-medium">{t("adviceTitle")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("adviceDisclaimer")}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          className="flex h-9 min-w-0 flex-1 rounded-md border bg-white px-3 text-sm"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          aria-label={t("adviceSelectPlaceholder")}
        >
          <option value="">{t("adviceSelectPlaceholder")}</option>
          {options.contextual.length > 0 ? (
            <optgroup label={t("adviceContextualGroup")}>
              {options.contextual.map((a) => (
                <option key={a.key} value={a.key} title={formatTip(locale, a)}>
                  {shortOptionLabel(a.key, locale)}
                </option>
              ))}
            </optgroup>
          ) : null}
          {options.common.length > 0 ? (
            <optgroup label={t("adviceCommonGroup")}>
              {options.common.map((a) => (
                <option key={a.key} value={a.key} title={formatTip(locale, a)}>
                  {shortOptionLabel(a.key as StaticAdviceKey, locale)}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <Button
          type="button"
          className="shrink-0 rounded-full"
          disabled={!selected}
          onClick={addFromSelect}
        >
          {t("adviceAdd")}
        </Button>
      </div>

      <div className="space-y-2">
        <textarea
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          rows={2}
          placeholder={t("adviceCustomPlaceholder")}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={!custom.trim()}
          onClick={addCustom}
        >
          {t("adviceCustomAdd")}
        </Button>
      </div>

      {saved.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("adviceSavedEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {saved.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-[#E8DFD4] bg-[#F7F3EE] px-3 py-2.5"
            >
              <p className="min-w-0 flex-1 text-sm leading-relaxed">
                {item.source === "custom" ? (
                  <span className="mr-1.5 text-xs text-muted-foreground">[{t("adviceCustomTag")}]</span>
                ) : null}
                {item.text}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 rounded-full text-destructive"
                onClick={() => removeItem(item.id)}
              >
                {t("adviceRemove")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
