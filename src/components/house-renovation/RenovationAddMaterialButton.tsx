"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export function RenovationAddMaterialButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("houseRenovation");
  const locale = useLocale();
  const [spinLeft, setSpinLeft] = useState(true);
  const [spinRight, setSpinRight] = useState(true);
  const rubyPauseLabel = t.has("rubyStarPause") ? t("rubyStarPause") : locale === "zh" ? "暂停旋转" : "Pause spin";
  const rubySpinLabel = t.has("rubyStarSpin") ? t("rubyStarSpin") : locale === "zh" ? "开始旋转" : "Start spin";

  return (
    <div className="relative isolate shrink-0">
      {/* 绿色四叶草 */}
      <span aria-hidden className="pointer-events-none absolute -left-4 -top-4">
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px] -rotate-[14deg] drop-shadow-[0_0_3px_rgba(74,222,128,0.55)]"
        >
          <defs>
            <linearGradient id="renoCloverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#bbf7d0" />
              <stop offset="45%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
          </defs>
          <ellipse cx="12" cy="6.2" rx="3.1" ry="4.2" fill="url(#renoCloverGrad)" />
          <ellipse cx="12" cy="17.8" rx="3.1" ry="4.2" fill="url(#renoCloverGrad)" opacity="0.95" />
          <ellipse cx="6.2" cy="12" rx="4.2" ry="3.1" fill="url(#renoCloverGrad)" opacity="0.92" />
          <ellipse cx="17.8" cy="12" rx="4.2" ry="3.1" fill="url(#renoCloverGrad)" opacity="0.92" />
          <circle cx="12" cy="12" r="1.6" fill="#86efac" />
          <circle cx="11.4" cy="5.2" r="0.55" fill="#fff" fillOpacity="0.8" />
          <path d="M12 14.5V21" stroke="#15803d" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute right-1 -top-3.5 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-amber-200 via-orange-300 to-rose-300 opacity-90"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-2 -left-1 h-2 w-2 rounded-full bg-gradient-to-br from-cyan-300 via-sky-300 to-blue-400 opacity-85"
      />
      {/* 绣球花 · 蓝紫风 · 微倾 */}
      <span aria-hidden className="pointer-events-none absolute -bottom-4 -right-3.5">
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px] rotate-[16deg] drop-shadow-[0_0_3px_rgba(167,139,250,0.55)]"
        >
          <defs>
            <radialGradient id="hydrangeaCore" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#e9d5ff" />
              <stop offset="50%" stopColor="#a5b4fc" />
              <stop offset="100%" stopColor="#818cf8" />
            </radialGradient>
          </defs>
          <circle cx="12" cy="8" r="3.1" fill="#ddd6fe" />
          <circle cx="16.2" cy="10.2" r="3" fill="#c4b5fd" />
          <circle cx="16" cy="14.5" r="3.1" fill="#a5b4fc" />
          <circle cx="12" cy="16.5" r="3" fill="#818cf8" />
          <circle cx="7.8" cy="14.5" r="3.1" fill="#a78bfa" />
          <circle cx="7.6" cy="10.2" r="3" fill="#c4b5fd" />
          <circle cx="12" cy="12" r="3.4" fill="url(#hydrangeaCore)" />
          <circle cx="10.5" cy="11" r="0.7" fill="#fff" fillOpacity="0.9" />
          <circle cx="13.2" cy="12.5" r="0.55" fill="#e0e7ff" />
          <circle cx="11.8" cy="13.8" r="0.45" fill="#fff" fillOpacity="0.65" />
          <path d="M12 17.5 V22" stroke="#6366f1" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute -right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-gradient-to-br from-pink-200 via-rose-300 to-pink-400 opacity-90"
      />
      {/* 粉星：点击切换旋转 */}
      <button
        type="button"
        aria-pressed={spinLeft}
        aria-label={spinLeft ? rubyPauseLabel : rubySpinLabel}
        title={spinLeft ? rubyPauseLabel : rubySpinLabel}
        className="pointer-events-auto absolute -left-8 top-1/2 z-10 flex min-h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-full"
        onClick={() => setSpinLeft((v) => !v)}
      >
        <svg
          viewBox="0 0 24 24"
          className={cn(
            "h-[18px] w-[18px] drop-shadow-[0_0_5px_rgba(251,113,133,0.65)]",
            spinLeft && "animate-[spin_7s_linear_infinite] motion-reduce:animate-none",
          )}
        >
          <defs>
            <linearGradient id="rubyStarA" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffe4e8" />
              <stop offset="28%" stopColor="#fda4af" />
              <stop offset="55%" stopColor="#fb7185" />
              <stop offset="78%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#fecdd3" />
            </linearGradient>
            <linearGradient id="rubyFacetA" x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
              <stop offset="40%" stopColor="#ffe4e8" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#fb7185" stopOpacity="0.22" />
            </linearGradient>
          </defs>
          <path
            d="M12 1.2 14.2 8.4 21.8 8.8 15.8 13.4 18.2 20.8 12 16.6 5.8 20.8 8.2 13.4 2.2 8.8 9.8 8.4Z"
            fill="url(#rubyStarA)"
          />
          <path d="M12 1.2 14.2 8.4 12 16.6 9.8 8.4Z" fill="url(#rubyFacetA)" />
          <path d="M12 1.2 14.2 8.4 21.8 8.8Z" fill="#fff" fillOpacity="0.55" />
          <path d="M2.2 8.8 9.8 8.4 12 16.6Z" fill="#e11d48" fillOpacity="0.18" />
          <circle cx="11.2" cy="6.2" r="0.7" fill="#fff" fillOpacity="0.95" />
        </svg>
      </button>
      {/* 海洋之心：点击切换旋转 */}
      <button
        type="button"
        aria-pressed={spinRight}
        aria-label={spinRight ? rubyPauseLabel : rubySpinLabel}
        title={spinRight ? rubyPauseLabel : rubySpinLabel}
        className="pointer-events-auto absolute -right-9 -top-5 z-10 flex min-h-9 min-w-9 items-center justify-center rounded-full"
        onClick={() => setSpinRight((v) => !v)}
      >
        <svg
          viewBox="0 0 22 26"
          className={cn(
            "h-[24px] w-[18px] drop-shadow-[0_0_5px_rgba(14,165,233,0.7)]",
            spinRight && "animate-[spin_10s_linear_infinite] motion-reduce:animate-none",
          )}
        >
          <defs>
            <linearGradient id="oceanHeartBody" x1="15%" y1="0%" x2="85%" y2="100%">
              <stop offset="0%" stopColor="#e0f2fe" />
              <stop offset="30%" stopColor="#38bdf8" />
              <stop offset="55%" stopColor="#0ea5e9" />
              <stop offset="78%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#7dd3fc" />
            </linearGradient>
            <linearGradient id="oceanHeartFacet" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#bae6fd" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0.25" />
            </linearGradient>
          </defs>
          <path
            d="M11 24.2 C11 24.2 3.4 16.8 3.4 9.6 C3.4 6.4 5.6 4.3 8.1 4.3 C9.6 4.3 10.6 5.1 11 6.2 C11.4 5.1 12.4 4.3 13.9 4.3 C16.4 4.3 18.6 6.4 18.6 9.6 C18.6 16.8 11 24.2 11 24.2 Z"
            fill="url(#oceanHeartBody)"
            stroke="#0369a1"
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
          <path
            d="M11 6.2 C10.3 7.3 9.1 8.1 7.6 8.5 L11 13.2 L14.4 8.5 C12.9 8.1 11.7 7.3 11 6.2 Z"
            fill="url(#oceanHeartFacet)"
          />
          <path
            d="M8.1 4.3 C9.2 4.3 10.2 4.9 11 6.2 L7.6 8.5 C5.8 7.7 4.6 6.4 5 5.3 C5.3 4.6 6.4 4.3 8.1 4.3 Z"
            fill="#fff"
            fillOpacity="0.42"
          />
          <path d="M11 13.2 L8.2 17.2 L11 24 L13.8 17.2 Z" fill="#0284c7" fillOpacity="0.26" />
          <circle cx="8.6" cy="7" r="0.7" fill="#fff" fillOpacity="0.95" />
          <circle cx="13.4" cy="10.8" r="0.35" fill="#e0f2fe" fillOpacity="0.85" />
        </svg>
      </button>
      <button
        type="button"
        className="relative min-w-[11rem] rounded-full border border-transparent bg-white bg-clip-padding px-5 py-1.5 text-center text-sm text-pink-700 shadow-[0_0_0_2px_rgba(251,207,232,0.55),0_0_12px_rgba(167,139,250,0.25),0_0_18px_rgba(125,211,252,0.2)] [background:linear-gradient(#fff,#fff)_padding-box,linear-gradient(135deg,#fda4af,#f0abfc,#a5b4fc,#7dd3fc,#86efac,#fcd34d,#fda4af)_border-box] hover:brightness-[0.99]"
        onClick={onClick}
      >
        + {t("addMaterial")}
      </button>
    </div>
  );
}
