"use client";

import { useRouter } from "next/navigation";

export function DashboardMonthPicker({
  locale,
  value,
  ariaLabel,
}: {
  locale: string;
  value: string;
  ariaLabel: string;
}) {
  const router = useRouter();

  return (
    <input
      type="month"
      aria-label={ariaLabel}
      defaultValue={value}
      className="h-9 max-w-full rounded-full border border-input bg-white px-3 text-sm font-medium text-foreground shadow-sm outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring"
      onChange={(e) => {
        const v = e.target.value;
        if (v) router.push(`/${locale}?month=${encodeURIComponent(v)}`);
      }}
    />
  );
}
