"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

import {
  readDressupImportFromHash,
  stashDressupImport,
  type DressupImportKind,
} from "@/lib/dressup-import/codec";

/**
 * 公开中转页：把宅宴草稿写入咔账同源 sessionStorage，再跳进工作室。
 * 未登录时会再被 proxy 转到 auth，登录后仍能读到 sessionStorage。
 */
export default function ImportDressupPage() {
  const locale = useLocale();
  const router = useRouter();
  const [message, setMessage] = useState("正在导入宅宴草稿…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kindParam = params.get("kind");
    const fromHash = readDressupImportFromHash(window.location.hash);

    if (!fromHash) {
      setMessage("未找到可导入的草稿，请从宅宴重新点「导入咔账」。");
      return;
    }

    const kind: DressupImportKind =
      kindParam === "banquet" || kindParam === "house" ? kindParam : fromHash.kind;

    stashDressupImport({ ...fromHash, kind });

    const target =
      kind === "banquet"
        ? `/${locale}/banquet-studio?from=kapi-dressup`
        : `/${locale}/renovation-studio?from=kapi-dressup`;

    // 清掉 hash，避免刷新重复解析大段编码
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    router.replace(target);
  }, [locale, router]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </main>
  );
}
