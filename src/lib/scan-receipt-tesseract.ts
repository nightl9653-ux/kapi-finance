import Tesseract from "tesseract.js";

import type { ScanReceiptBulkRow } from "@/lib/scan-receipt-ai";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function pickBestAmount(text: string): number | null {
  // Very simple heuristic: pick the largest plausible amount.
  // Examples: 12.34, 56, 1,234.56, 98.7
  const cleaned = text.replace(/[,，]/g, "");
  const matches = cleaned.match(/\b\d{1,7}(?:\.\d{1,2})?\b/g) ?? [];
  let best: number | null = null;
  for (const m of matches) {
    const n = Number(m);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (best == null || n > best) best = n;
  }
  return best;
}

export async function extractTransactionsFromImageTesseract(params: {
  file: File;
  locale: string;
}): Promise<{ rows: ScanReceiptBulkRow[] }> {
  const { data } = await Tesseract.recognize(params.file, "eng+chi_sim", {
    logger: () => undefined,
  });

  const text = String(data?.text ?? "");
  const amount = pickBestAmount(text);
  if (!amount) {
    return { rows: [] };
  }

  // Minimal row: we can improve parsing later, but keep it free/offline.
  const zh = params.locale.toLowerCase().startsWith("zh");
  const note = zh ? "来源：本地 OCR（Tesseract）" : "Source: local OCR (Tesseract)";

  return {
    rows: [
      {
        occurred_on: todayISO(),
        type: "expense",
        amount: String(amount),
        categoryPreset: "other",
        categoryCustom: "",
        note,
      },
    ],
  };
}

