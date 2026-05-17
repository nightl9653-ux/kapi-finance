"use client";

import { useEffect } from "react";

/**
 * 带 `?edit=` 进入页面或切换编辑行时，把对应条目滚入视口（不强行滚到页面最顶）。
 */
export function ScrollTransactionEditIntoView({ rowId }: { rowId: string | undefined }) {
  useEffect(() => {
    if (!rowId) return;
    const el = document.getElementById(`tx-edit-${rowId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [rowId]);

  return null;
}
