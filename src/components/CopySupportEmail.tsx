"use client";

import { useState, type MouseEvent, type PointerEvent } from "react";
import { useTranslations } from "next-intl";

import { SUPPORT_EMAIL, formatDetectionOff, maskedEmail } from "@/lib/site";

export function CopySupportEmail() {
  const t = useTranslations("footer");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function copySupport() {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopyError(true);
      window.setTimeout(() => setCopyError(false), 2800);
    }
  }

  function onCopyPointer(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    void copySupport();
  }

  function onCopyClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    void copySupport();
  }

  return (
    <span className="inline-flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        className="select-none font-medium text-foreground hover:underline"
        aria-label={SUPPORT_EMAIL}
        {...formatDetectionOff()}
        onPointerDownCapture={onCopyPointer}
        onClick={onCopyClick}
      >
        {maskedEmail(SUPPORT_EMAIL)}
      </button>
      {copied ? <span className="text-xs text-foreground">{t("copied", { email: SUPPORT_EMAIL })}</span> : null}
      {copyError ? (
        <span className="text-xs text-foreground">{t("copyFail", { email: SUPPORT_EMAIL })}</span>
      ) : null}
    </span>
  );
}
