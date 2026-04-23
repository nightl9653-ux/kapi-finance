"use client";

import { useEffect, useRef } from "react";

function formatLocalYYYYMMDD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 提交「记一笔 / 编辑」时附带用户本地日历日（YYYY-MM-DD），供 occurred_on 在时间为空时使用。 */
export function LocalCalendarDateHidden() {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sync = () => {
      el.value = formatLocalYYYYMMDD();
    };

    sync();
    const form = el.closest("form");
    if (!form) return;

    form.addEventListener("submit", sync, true);
    return () => form.removeEventListener("submit", sync, true);
  }, []);

  return <input ref={ref} type="hidden" name="local_calendar_date" defaultValue="" />;
}
