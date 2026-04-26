"use client";

import { useRouter } from "next/navigation";

export function DashboardMonthPicker({
  locale,
  value,
  ariaLabel,
  hrefPrefix,
  extraParams,
}: {
  locale: string;
  value: string;
  ariaLabel: string;
  /** 默认为 `/${locale}`（仪表盘）；报表页可传 `/${locale}/reports` */
  hrefPrefix?: string;
  /** 与 `month` 一并保留在查询串，例如 `months: "12"` */
  extraParams?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const base = hrefPrefix ?? `/${locale}`;

  // `value` 来自 query；若仅用 defaultValue 而不 remount，客户端在 Next 导航后
  // 会保留上一次选择的月份，出现「URL 是 3 月、选择器却显示 4 月」的不一致
  return (
    <input
      key={value}
      type="month"
      aria-label={ariaLabel}
      defaultValue={value}
      className="h-9 max-w-full rounded-full border border-input bg-white px-3 text-sm font-medium text-foreground shadow-sm outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring"
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return;
        const next = new URLSearchParams();
        next.set("month", v);
        for (const [k, val] of Object.entries(extraParams ?? {})) {
          if (val !== undefined && val !== "") next.set(k, val);
        }
        router.push(`${base}?${next.toString()}`);
      }}
    />
  );
}
