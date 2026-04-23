"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { BulkTransactionsForm } from "@/components/transactions/BulkTransactionsForm";
import { Button } from "@/components/ui/button";
import { readImageFileFromClipboard } from "@/lib/clipboard-image";
import type { ScanReceiptBulkRow } from "@/lib/scan-receipt-ai";
import { AiErrorNotice } from "@/components/ai/AiErrorNotice";
import { mapAiErrorCode } from "@/lib/ai-error";
import { useAiUsage } from "@/lib/use-ai-usage";
import { localTodayISO } from "@/lib/local-date";

import { QuickRecordPlatformTips } from "./QuickRecordPlatformTips";

async function downscaleForScan(file: File): Promise<File> {
  if (file.size <= 1_500_000) return file;

  const blobUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = blobUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image_load_failed"));
    });

    const maxSide = 1600;
    const w0 = img.naturalWidth || img.width;
    const h0 = img.naturalHeight || img.height;
    if (!w0 || !h0) return file;

    const scale = Math.min(1, maxSide / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8),
    );
    if (!blob) return file;

    return new File([blob], "scan.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

const SHARE_CACHE = "pwa-share-v1";
const PENDING_PATH = "/__shared_image_pending";

export function QuickRecordClient({
  locale,
  action,
  scanDailyLimit,
}: {
  locale: string;
  action: (formData: FormData) => void;
  scanDailyLimit: number;
}) {
  const t = useTranslations("quickRecord");
  const tTx = useTranslations("transactions");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formKey, setFormKey] = useState(0);
  const [initialRows, setInitialRows] = useState<ScanReceiptBulkRow[] | undefined>();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  /** 避免 Strict Mode 或参数未清理前重复震动 */
  const lastVibratedSuccess = useRef<string | null>(null);
  const [autoPastePhase, setAutoPastePhase] = useState<"off" | "running" | "need_tap">("off");
  const autoPasteGen = useRef(0);
  const { scanRemaining, setScanRemaining, refreshUsage } = useAiUsage({
    getUsageDate: localTodayISO,
    includeVoice: false,
  });

  const runScan = useCallback(
    async (file: File) => {
      setScanError(null);
      setScanning(true);
      try {
        const scaled = await downscaleForScan(file);
        const fd = new FormData();
        fd.append("file", scaled);
        fd.append("usage_date", localTodayISO());
        fd.append("locale", locale);
        const res = await fetch("/api/scan-receipt", { method: "POST", body: fd });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          transactions?: ScanReceiptBulkRow[];
          remaining?: number;
          limit?: number;
        };
        if (!res.ok) {
          if (data.error === "rate_limit") {
            setScanRemaining(0);
            setScanError(
              mapAiErrorCode({
                kind: "scan",
                code: data.error,
                limit: data.limit,
                dailyLimit: scanDailyLimit,
                t: tTx,
              }),
            );
          } else {
            await refreshUsage();
            setScanError(
              mapAiErrorCode({
                kind: "scan",
                code: data.error,
                limit: data.limit,
                dailyLimit: scanDailyLimit,
                t: tTx,
              }),
            );
          }
          return;
        }
        if (!data.ok || !data.transactions?.length) {
          setScanError(tTx("scanErrorUnrecognized"));
          return;
        }
        if (typeof data.remaining === "number") setScanRemaining(data.remaining);
        setInitialRows(data.transactions);
        setFormKey((k) => k + 1);
        setSheetOpen(true);
      } catch {
        setScanError(tTx("scanErrorNetwork"));
      } finally {
        setScanning(false);
      }
    },
    [locale, scanDailyLimit, tTx, refreshUsage, setScanRemaining],
  );

  /** 从系统「分享到应用」经 Service Worker 写入 Cache 的图片 */
  useEffect(() => {
    const shared = searchParams.get("shared");
    if (shared !== "1") return;

    let cancelled = false;
    (async () => {
      try {
        const cache = await caches.open(SHARE_CACHE);
        const pendingUrl = `${window.location.origin}${PENDING_PATH}`;
        const hit = await cache.match(new Request(pendingUrl));
        if (!hit) return;
        const blob = await hit.blob();
        await cache.delete(new Request(pendingUrl));
        if (cancelled || !blob.size) return;
        const mime = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
        const file = new File([blob], "shared.jpg", { type: mime });
        await runScan(file);
        router.replace(`/${locale}/quick-record`, { scroll: false });
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, locale, router, runScan]);

  /** iOS 官方推荐：快捷指令打开 ?autoPaste=1 后尝试读取剪贴板图片并 OCR（gen 防 Strict Mode 双跑） */
  useEffect(() => {
    const ap = searchParams.get("autoPaste");
    const shared = searchParams.get("shared");
    if (ap !== "1" || shared === "1") {
      if (ap !== "1") setAutoPastePhase("off");
      return;
    }

    const gen = ++autoPasteGen.current;
    setAutoPastePhase("running");
    (async () => {
      const file = await readImageFileFromClipboard();
      if (gen !== autoPasteGen.current) return;
      if (file) {
        await runScan(file);
        if (gen !== autoPasteGen.current) return;
        router.replace(`/${locale}/quick-record`, { scroll: false });
        setAutoPastePhase("off");
        return;
      }
      setAutoPastePhase("need_tap");
    })();
  }, [searchParams, locale, router, runScan]);

  const onAutoPasteButton = async () => {
    setScanError(null);
    const file = await readImageFileFromClipboard();
    if (!file) {
      setScanError(t("autoPasteEmpty"));
      return;
    }
    setAutoPastePhase("off");
    await runScan(file);
    router.replace(`/${locale}/quick-record`, { scroll: false });
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it?.kind === "file" && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            e.preventDefault();
            void runScan(f);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [runScan]);

  useEffect(() => {
    const s = searchParams.get("success");
    if (s === "bulk_created" && lastVibratedSuccess.current !== "bulk_created") {
      lastVibratedSuccess.current = "bulk_created";
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate([25, 40, 25]);
        } catch {
          // 非安全上下文或设备不支持
        }
      }
    }
    if (!s) lastVibratedSuccess.current = null;
  }, [searchParams]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = Array.from(e.target.files ?? [])[0];
    e.target.value = "";
    if (!file) return;
    await runScan(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = Array.from(e.dataTransfer.files ?? []).find((f) => f.type.startsWith("image/"));
    if (file) void runScan(file);
  };

  const success = searchParams.get("success");
  const errorFlash = searchParams.get("error");

  return (
    <div className="space-y-6">
      <QuickRecordPlatformTips locale={locale} />

      {autoPastePhase === "running" ? (
        <div className="rounded-2xl border bg-white/80 p-3 text-center text-sm text-muted-foreground">{t("autoPasteRunning")}</div>
      ) : null}
      {autoPastePhase === "need_tap" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm">
          <p className="text-amber-950">{t("autoPasteNeedTap")}</p>
          <Button type="button" className="mt-3 w-full rounded-full sm:w-auto" onClick={() => void onAutoPasteButton()}>
            {t("autoPasteButton")}
          </Button>
        </div>
      ) : null}

      {success === "bulk_created" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {tTx("successBulkCreated")}
        </div>
      ) : null}
      {errorFlash === "invalid" || errorFlash === "unknown" ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorFlash === "invalid" ? tTx("errorInvalid") : tTx("scanErrorGeneric")}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white/70 p-6">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("hintQuota", { remaining: scanRemaining ?? scanDailyLimit, n: scanDailyLimit })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t("aiPrivacyHint")}</p>

        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className="mt-6 flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-yellow-700/30 bg-[#FAF9F7] p-6 text-center transition hover:border-yellow-700/50"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            capture="environment"
            className="hidden"
            onChange={onFile}
          />
          <span className="text-3xl" aria-hidden>
            ⚡
          </span>
          <p className="mt-2 text-sm font-medium">{t("dropTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("dropHint")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("pasteFallbackHint")}</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4 rounded-full"
            disabled={scanning}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            {scanning ? t("scanning") : t("chooseImage")}
          </Button>
        </div>

        <AiErrorNotice message={scanError} className="mt-3" />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        <Link href={`/${locale}/transactions`} className="underline underline-offset-4">
          {t("backToTransactions")}
        </Link>
      </p>

      {sheetOpen && initialRows?.length ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40"
            aria-label={t("closeSheet")}
            onClick={() => setSheetOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t bg-[#FAF9F7] p-4 shadow-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto w-full max-w-lg">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{t("confirmTitle")}</h3>
                <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => setSheetOpen(false)}>
                  {t("closeSheet")}
                </Button>
              </div>
              <BulkTransactionsForm
                key={formKey}
                locale={locale}
                action={action}
                initialRows={initialRows}
                returnTo="quick"
                embedded
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
