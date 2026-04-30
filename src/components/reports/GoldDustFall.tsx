"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Particle = {
  leftPct: number;
  size: number;
  delay: number;
  dur: number;
  opacity: number;
  blur: number;
  drift: number;
};

type Rose = {
  leftPct: number;
  size: number;
  delay: number;
  dur: number;
  opacity: number;
  drift: number;
  spin: number;
  tone: number;
  petal: number;
};

const ROSE_TONES = [
  // red
  { a: "rgba(254, 226, 226, 0.96)", b: "rgba(239, 68, 68, 0.72)", c: "rgba(190, 18, 60, 0.48)" },
  // deep rose
  { a: "rgba(255, 228, 230, 0.96)", b: "rgba(244, 63, 94, 0.74)", c: "rgba(190, 18, 60, 0.50)" },
  // rose
  { a: "rgba(255, 228, 230, 0.96)", b: "rgba(251, 113, 133, 0.76)", c: "rgba(225, 29, 72, 0.52)" },
  // magenta
  { a: "rgba(253, 242, 248, 0.96)", b: "rgba(217, 70, 239, 0.66)", c: "rgba(190, 24, 93, 0.40)" },
  // pink
  { a: "rgba(252, 231, 243, 0.96)", b: "rgba(236, 72, 153, 0.72)", c: "rgba(190, 24, 93, 0.46)" },
  // light pink
  { a: "rgba(253, 242, 248, 0.96)", b: "rgba(244, 114, 182, 0.66)", c: "rgba(236, 72, 153, 0.38)" },
  // lavender
  { a: "rgba(245, 243, 255, 0.96)", b: "rgba(196, 181, 253, 0.72)", c: "rgba(147, 51, 234, 0.38)" },
  // light purple
  { a: "rgba(243, 232, 255, 0.96)", b: "rgba(168, 85, 247, 0.62)", c: "rgba(124, 58, 237, 0.42)" },
] as const;

export function GoldDustFall({
  className,
  count = 28,
  height = 90,
  seed = 20260425,
}: {
  className?: string;
  /** 粒子数量 */
  count?: number;
  /** 掉落层高度（px） */
  height?: number;
  /** 固定随机种子，保证稳定 */
  seed?: number;
}) {
  const particles = useMemo(() => {
    const rand = mulberry32(seed);
    const list: Particle[] = [];
    for (let i = 0; i < count; i++) {
      list.push({
        leftPct: rand() * 100,
        size: 1.2 + rand() * 2.6,
        delay: rand() * 2.2,
        dur: 2.8 + rand() * 2.6,
        opacity: 0.35 + rand() * 0.45,
        blur: rand() * 0.6,
        drift: (rand() - 0.5) * 28,
      });
    }
    return list;
  }, [count, seed]);

  const [roses, setRoses] = useState<Rose[]>([]);

  useEffect(() => {
    // 掉落位置不固定：定时“刷新一批”花瓣，让下一轮位置/颜色变化
    const gen = () => {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      const rand = mulberry32(buf[0] ^ 0x9e3779b9);
      const n = 2 + Math.floor(rand() * 3); // 2-4 朵
      const list: Rose[] = [];
      for (let i = 0; i < n; i++) {
        list.push({
          leftPct: 6 + rand() * 88,
          size: 10 + rand() * 12,
          delay: rand() * 3.5,
          dur: 6.8 + rand() * 5.2,
          opacity: 0.55 + rand() * 0.35,
          drift: (rand() - 0.5) * 72,
          spin: (rand() - 0.5) * 36,
          tone: Math.floor(rand() * ROSE_TONES.length),
          petal: Math.floor(rand() * 3),
        });
      }
      setRoses(list);
    };

    gen();
    const id = window.setInterval(gen, 9000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className={cn("pointer-events-none absolute inset-x-0 -top-2 overflow-hidden", className)}
      aria-hidden="true"
      style={{ height }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-transparent" />
      {particles.map((p, i) => (
        <span
          key={i}
          className="kapi-gold-dust absolute top-0 rounded-full"
          style={{
            left: `${p.leftPct}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            filter: p.blur > 0 ? `blur(${p.blur}px)` : undefined,
            boxShadow:
              "0 0 0.6px rgba(250, 204, 21, 0.55), 0 0 10px rgba(250, 204, 21, 0.18)",
            background:
              "radial-gradient(circle at 30% 30%, rgba(254, 243, 199, 0.95), rgba(250, 204, 21, 0.55) 45%, rgba(180, 83, 9, 0.1) 78%, rgba(0,0,0,0) 100%)",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            // 横向轻微漂移
            ...({ ["--kapi-drift"]: `${p.drift}px` } as CSSProperties),
          }}
        />
      ))}

      {roses.map((r, i) => (
        <span
          key={`r-${i}`}
          className="kapi-rose absolute top-0"
          style={{
            left: `${r.leftPct}%`,
            width: `${r.size}px`,
            height: `${r.size}px`,
            opacity: r.opacity,
            animationDelay: `${r.delay}s`,
            animationDuration: `${r.dur}s`,
            ...({
              ["--kapi-drift"]: `${r.drift}px`,
              ["--kapi-spin"]: `${r.spin}deg`,
              ["--kapi-base-rot"]: `155deg`,
            } as CSSProperties),
          }}
        >
          {/* 花瓣：更纤细、更像玫瑰的“旋涡花瓣”层叠（只花瓣，不画花托/枝叶） */}
          <svg viewBox="0 0 24 24" className="h-full w-full">
            <defs>
              {(() => {
                const t = ROSE_TONES[r.tone] ?? ROSE_TONES[1];
                return (
                  <radialGradient id={`kapi-rose-g-${i}`} cx="35%" cy="35%" r="78%">
                    <stop offset="0" stopColor={t.a} />
                    <stop offset="0.46" stopColor={t.b} />
                    <stop offset="0.82" stopColor={t.c} />
                    <stop offset="1" stopColor="rgba(0,0,0,0)" />
                  </radialGradient>
                );
              })()}
              <radialGradient id={`kapi-rose-core-${i}`} cx="45%" cy="40%" r="65%">
                <stop offset="0" stopColor="rgba(255,255,255,0.32)" />
                <stop offset="0.55" stopColor="rgba(255,255,255,0.10)" />
                <stop offset="1" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
            </defs>
            {r.petal === 0 ? (
              <>
                {/* 菊花：5 片细长卷瓣（只花瓣） */}
                <g fill={`url(#kapi-rose-g-${i})`} opacity="0.9">
                  <path d="M12 5.1c1.5 1.4 2.2 3.0 2.0 4.4-.2 1.6-1.1 2.6-2.0 4.8-.9-2.2-1.8-3.2-2.0-4.8-.2-1.4.5-3.0 2.0-4.4Z" transform="rotate(-40 12 12)" />
                  <path d="M12 5.1c1.5 1.4 2.2 3.0 2.0 4.4-.2 1.6-1.1 2.6-2.0 4.8-.9-2.2-1.8-3.2-2.0-4.8-.2-1.4.5-3.0 2.0-4.4Z" transform="rotate(-15 12 12)" opacity="0.88" />
                  <path d="M12 5.1c1.5 1.4 2.2 3.0 2.0 4.4-.2 1.6-1.1 2.6-2.0 4.8-.9-2.2-1.8-3.2-2.0-4.8-.2-1.4.5-3.0 2.0-4.4Z" transform="rotate(10 12 12)" opacity="0.84" />
                  <path d="M12 5.1c1.5 1.4 2.2 3.0 2.0 4.4-.2 1.6-1.1 2.6-2.0 4.8-.9-2.2-1.8-3.2-2.0-4.8-.2-1.4.5-3.0 2.0-4.4Z" transform="rotate(35 12 12)" opacity="0.80" />
                  <path d="M12 5.1c1.5 1.4 2.2 3.0 2.0 4.4-.2 1.6-1.1 2.6-2.0 4.8-.9-2.2-1.8-3.2-2.0-4.8-.2-1.4.5-3.0 2.0-4.4Z" transform="rotate(60 12 12)" opacity="0.76" />
                </g>
              </>
            ) : r.petal === 1 ? (
              <>
                {/* 芙蓉：固定 5 片大瓣（只花瓣） */}
                <g fill={`url(#kapi-rose-g-${i})`} opacity="0.92">
                  <path d="M12 5.2c2.1 1.5 3.2 3.4 3.0 5.0-.2 1.7-1.4 2.8-3.0 5.2-1.6-2.4-2.8-3.5-3.0-5.2-.2-1.6.9-3.5 3.0-5.0Z" transform="rotate(-72 12 12)" />
                  <path d="M12 5.2c2.1 1.5 3.2 3.4 3.0 5.0-.2 1.7-1.4 2.8-3.0 5.2-1.6-2.4-2.8-3.5-3.0-5.2-.2-1.6.9-3.5 3.0-5.0Z" transform="rotate(0 12 12)" opacity="0.9" />
                  <path d="M12 5.2c2.1 1.5 3.2 3.4 3.0 5.0-.2 1.7-1.4 2.8-3.0 5.2-1.6-2.4-2.8-3.5-3.0-5.2-.2-1.6.9-3.5 3.0-5.0Z" transform="rotate(72 12 12)" opacity="0.88" />
                  <path d="M12 5.2c2.1 1.5 3.2 3.4 3.0 5.0-.2 1.7-1.4 2.8-3.0 5.2-1.6-2.4-2.8-3.5-3.0-5.2-.2-1.6.9-3.5 3.0-5.0Z" transform="rotate(144 12 12)" opacity="0.86" />
                  <path d="M12 5.2c2.1 1.5 3.2 3.4 3.0 5.0-.2 1.7-1.4 2.8-3.0 5.2-1.6-2.4-2.8-3.5-3.0-5.2-.2-1.6.9-3.5 3.0-5.0Z" transform="rotate(216 12 12)" opacity="0.84" />
                </g>
              </>
            ) : (
              <>
                {/* 百合：三片长瓣（只花瓣），强调长瓣脉络 */}
                <g fill={`url(#kapi-rose-g-${i})`} opacity="0.88">
                  <path d="M12 4.0c2.2 2.2 3.2 4.8 3.0 7.1-.2 2.5-1.7 4.7-3.0 8.2-1.3-3.5-2.8-5.7-3.0-8.2-.2-2.3.8-4.9 3.0-7.1Z" />
                  <path d="M7.4 6.3c2.2 1.6 3.5 3.6 3.8 5.5.4 2.2-.4 4.5-.8 7.7-1.9-2.5-3.4-4.4-4.0-6.5-.6-2.1-.2-4.5 1.0-6.7Z" opacity="0.82" />
                  <path d="M16.6 6.3c1.2 2.2 1.6 4.6 1.0 6.7-.6 2.1-2.1 4.0-4.0 6.5-.4-3.2-1.2-5.5-.8-7.7.3-1.9 1.6-3.9 3.8-5.5Z" opacity="0.82" />
                </g>
                <path
                  d="M12 6.5 L12 17.8 M9.9 8.0 L10.7 17.4 M14.1 8.0 L13.3 17.4"
                  fill="none"
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="0.85"
                  strokeLinecap="round"
                  opacity="0.9"
                />
              </>
            )}
          </svg>
        </span>
      ))}

      <style jsx>{`
        .kapi-gold-dust {
          animation-name: kapi-dust-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform, opacity;
        }
        .kapi-rose {
          animation-name: kapi-rose-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform, opacity;
          filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.14));
        }
        @keyframes kapi-dust-fall {
          0% {
            transform: translate3d(0, -8px, 0);
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--kapi-drift, 0px), ${height + 16}px, 0);
            opacity: 0;
          }
        }
        @keyframes kapi-rose-fall {
          0% {
            transform: translate3d(0, -12px, 0)
              rotate(calc(var(--kapi-base-rot, 155deg) + (var(--kapi-spin, 0deg) * -1)));
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          88% {
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--kapi-drift, 0px), ${height + 24}px, 0)
              rotate(calc(var(--kapi-base-rot, 155deg) + var(--kapi-spin, 0deg)));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

