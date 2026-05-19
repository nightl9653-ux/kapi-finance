"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type { ScanReceiptBulkRow } from "@/lib/scan-receipt-ai";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mapAiErrorCode } from "@/lib/ai-error";
import { AiErrorNotice } from "@/components/ai/AiErrorNotice";
import { useAiUsage } from "@/lib/use-ai-usage";
import { localTodayISO } from "@/lib/local-date";

import { BulkTransactionsForm } from "./BulkTransactionsForm";

function encodeWavFromAudioBuffer(buf: AudioBuffer): ArrayBuffer {
  const numChannels = Math.min(2, Math.max(1, buf.numberOfChannels));
  const sampleRate = buf.sampleRate;
  const numFrames = buf.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;

  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);
  let off = 0;
  const writeU8 = (v: number) => view.setUint8(off++, v);
  const writeU16 = (v: number) => {
    view.setUint16(off, v, true);
    off += 2;
  };
  const writeU32 = (v: number) => {
    view.setUint32(off, v, true);
    off += 4;
  };
  const writeStr = (s: string) => {
    for (let i = 0; i < s.length; i++) writeU8(s.charCodeAt(i));
  };

  writeStr("RIFF");
  writeU32(36 + dataSize);
  writeStr("WAVE");
  writeStr("fmt ");
  writeU32(16);
  writeU16(1); // PCM
  writeU16(numChannels);
  writeU32(sampleRate);
  writeU32(byteRate);
  writeU16(blockAlign);
  writeU16(bytesPerSample * 8);
  writeStr("data");
  writeU32(dataSize);

  const ch: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) ch.push(buf.getChannelData(c));

  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, ch[c]![i]!));
      view.setInt16(off, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
      off += 2;
    }
  }

  return out;
}

async function blobToWavFile(blob: Blob): Promise<File> {
  const ab = await blob.arrayBuffer();
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  try {
    const audio = await ctx.decodeAudioData(ab.slice(0));
    const wav = encodeWavFromAudioBuffer(audio);
    return new File([wav], "voice.wav", { type: "audio/wav" });
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

async function downscaleForScan(file: File): Promise<File> {
  // 经验值：控制在 ~1.5MB 内通常能显著降低超时概率
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

export function BulkTransactionsWithScan({
  locale,
  action,
  prefillDate,
  scanDailyLimit,
  voiceDailyLimit,
}: {
  locale: string;
  action: (formData: FormData) => void;
  prefillDate?: string;
  /** 与 `getAiUsageLimit(isPlus, "scan")` / `FREE_SCAN_DAILY_LIMIT`、`PLUS_SCAN_DAILY_LIMIT` 一致 */
  scanDailyLimit: number;
  /** 与 `getAiUsageLimit(isPlus, "voice")` / `FREE_VOICE_DAILY_LIMIT`、`PLUS_VOICE_DAILY_LIMIT` 一致 */
  voiceDailyLimit: number;
}) {
  const t = useTranslations("transactions");
  const [formKey, setFormKey] = useState(0);
  const [initialRows, setInitialRows] = useState<ScanReceiptBulkRow[] | undefined>();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const {
    scanRemaining,
    voiceRemaining,
    setScanRemaining,
    setVoiceRemaining,
    refreshUsage,
  } = useAiUsage({ getUsageDate: localTodayISO, includeVoice: true });

  const stopVoice = () => {
    const r = recorderRef.current;
    if (r && r.state !== "inactive") r.stop();
  };

  const startVoice = async () => {
    setVoiceError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError(t("voiceErrorUnsupported"));
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];
    const mimeType = types.find((x) => MediaRecorder.isTypeSupported(x)) ?? "";
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    chunksRef.current = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      setVoiceRecording(false);

      const mimeRaw = (recorder.mimeType || "audio/webm").toLowerCase();
      const mime = mimeRaw.split(";", 1)[0]?.trim() || mimeRaw;
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];
      if (!blob.size) return;

      setVoiceBusy(true);
      try {
        const audioFile = mime === "audio/wav" ? new File([blob], "voice.wav", { type: "audio/wav" }) : await blobToWavFile(blob);
        const fd = new FormData();
        fd.append("file", audioFile);
        fd.append("usage_date", localTodayISO());
        fd.append("locale", locale);
        const res = await fetch("/api/voice-transactions", { method: "POST", body: fd });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          transactions?: ScanReceiptBulkRow[];
          remaining?: number;
          limit?: number;
        };
        if (!res.ok) {
          if (data.error === "rate_limit") setVoiceRemaining(0);
          else await refreshUsage();
          setVoiceError(
            mapAiErrorCode({
              kind: "voice",
              code: data.error,
              limit: data.limit,
              dailyLimit: voiceDailyLimit,
              t,
            }),
          );
          return;
        }
        if (!data.ok || !data.transactions?.length) {
          setVoiceError(t("scanErrorUnrecognized"));
          return;
        }
        if (typeof data.remaining === "number") setVoiceRemaining(data.remaining);
        setInitialRows(data.transactions);
        setFormKey((k) => k + 1);
      } catch {
        setVoiceError(t("scanErrorNetwork"));
      } finally {
        setVoiceBusy(false);
      }
    };

    recorderRef.current = recorder;
    setVoiceRecording(true);
    recorder.start();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setScanError(null);
    setScanning(true);
    setScanProgress({ done: 0, total: files.length });
    try {
      const merged: ScanReceiptBulkRow[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
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

        // 更新进度（无论成功失败都推进一格）
        setScanProgress({ done: i + 1, total: files.length });

        if (!res.ok) {
          // 额度用完：保留已识别结果，并提示
          if (data.error === "rate_limit") {
            setScanRemaining(0);
            if (merged.length) {
              setInitialRows(merged);
              setFormKey((k) => k + 1);
            }
            setScanError(
              mapAiErrorCode({
                kind: "scan",
                code: data.error,
                limit: data.limit,
                dailyLimit: scanDailyLimit,
                t,
              }),
            );
            return;
          }
          await refreshUsage();
          setScanError(
            mapAiErrorCode({
              kind: "scan",
              code: data.error,
              limit: data.limit,
              dailyLimit: scanDailyLimit,
              t,
            }),
          );
          return;
        }
        if (!data.ok || !data.transactions?.length) {
          setScanError(t("scanErrorUnrecognized"));
          return;
        }
        if (typeof data.remaining === "number") setScanRemaining(data.remaining);
        merged.push(...data.transactions);
      }

      if (!merged.length) {
        setScanError(t("scanErrorUnrecognized"));
        return;
      }
      setInitialRows(merged);
      setFormKey((k) => k + 1);
    } catch {
      setScanError(t("scanErrorNetwork"));
    } finally {
      setScanning(false);
      setScanProgress(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          // 移动端「拍照」提示：允许直接调起后置相机（不同浏览器支持程度不同）
          capture="environment"
          className="hidden"
          onChange={onFile}
        />
        <Button
          type="button"
          variant="secondary"
          className="rounded-full text-base font-bold text-yellow-700"
          disabled={scanning}
          onClick={() => inputRef.current?.click()}
        >
          {scanning
            ? `${t("scanScanning")}${scanProgress ? ` (${scanProgress.done}/${scanProgress.total})` : ""}`
            : t("scanCta")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="rounded-full text-base font-bold text-yellow-700"
          disabled={voiceBusy || scanning}
          onClick={() => (voiceRecording ? stopVoice() : startVoice().catch(() => setVoiceError(t("voiceErrorMic"))))}
        >
          {voiceRecording ? t("voiceStop") : voiceBusy ? t("voiceUploading") : t("voiceCta")}
        </Button>
        <Link
          href={`/${locale}/quick-record`}
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "rounded-full text-base font-bold text-yellow-700",
          )}
          title={t("quick")}
          aria-label={t("quick")}
        >
          {t("quick")}
        </Link>
        <p className="text-xs text-muted-foreground">
          {t("scanHint", { remaining: scanRemaining ?? scanDailyLimit, n: scanDailyLimit })}
          {" · "}
          {t("voiceHint", { remaining: voiceRemaining ?? voiceDailyLimit, n: voiceDailyLimit })}
        </p>
        <p className="ml-3 text-xs text-muted-foreground">{t("aiPrivacyHint")}</p>
      </div>
      <AiErrorNotice message={scanError} />
      <AiErrorNotice message={voiceError} />
      <BulkTransactionsForm
        key={formKey}
        locale={locale}
        action={action}
        prefillDate={prefillDate}
        initialRows={initialRows}
      />
    </div>
  );
}
