"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ClearFlashParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const p = new URLSearchParams(searchParams);
    let changed = false;
    if (p.has("success")) {
      p.delete("success");
      changed = true;
    }
    if (p.has("error")) {
      p.delete("error");
      changed = true;
    }
    if (!changed) return;

    // 让提示可见一小段时间后再消失（同时清理 URL 参数，避免刷新后重复出现）
    const t = window.setTimeout(() => {
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname);
    }, 6500);
    return () => window.clearTimeout(t);
  }, [pathname, router, searchParams]);

  return null;
}

