"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

const SHEET_SRC = "/ornaments/motif-sheet.png";
const SHEET_W = 375;
const SHEET_H = 372;
const COLS = 5;
const ROWS = 4;
const TILE_W = SHEET_W / COLS; // 75
const TILE_H = SHEET_H / ROWS; // 93

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function threadY(x: number) {
  // 贴近正弦，但加入轻微二次谐波与相位偏移，让它不至于“数学感太强”
  // 对齐 `OrnamentDivider` 里的金丝线起伏观感。
  const t = x / 1200;
  const w = Math.PI * 2 * 2;
  return 40 + 3.1 * Math.sin(w * t + 0.22) + 0.7 * Math.sin(w * 2 * t - 0.35);
}

function isNearWhite(r: number, g: number, b: number) {
  return r >= 248 && g >= 248 && b >= 248;
}

function isInkLike(r: number, g: number, b: number) {
  // 只把“墨色/深灰线条”当作可上色的纹路；避免染到浅灰底块
  // - 亮度低（深色）
  // - 颜色差值小（接近灰/黑，而非彩色）
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const chroma = max - min;
  return luma < 120 && chroma < 35;
}

function useRecoloredTileDataUrl({
  sheetSrc,
  sx,
  sy,
  sw,
  sh,
  tint,
}: {
  sheetSrc: string;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  tint: { r: number; g: number; b: number };
}) {
  const [url, setUrl] = useState<string | null>(null);

  const key = useMemo(() => `${sheetSrc}:${sx},${sy},${sw},${sh}:${tint.r},${tint.g},${tint.b}`, [
    sheetSrc,
    sx,
    sy,
    sw,
    sh,
    tint.r,
    tint.g,
    tint.b,
  ]);

  useEffect(() => {
    let cancelled = false;

    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    img.src = sheetSrc;

    img.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.clearRect(0, 0, sw, sh);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const data = ctx.getImageData(0, 0, sw, sh);
      const d = data.data;

      // 目标：只改“纹路”，不改底块；同时不带白底。
      // 做法：纯白背景抠透明；仅将深色墨线像素染为目标色（保留原 alpha）。
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i]!;
        const g = d[i + 1]!;
        const b = d[i + 2]!;
        const a = d[i + 3]!;
        if (a === 0) continue;

        if (isNearWhite(r, g, b)) {
          d[i + 3] = 0;
          continue;
        }

        if (isInkLike(r, g, b)) {
          d[i] = tint.r;
          d[i + 1] = tint.g;
          d[i + 2] = tint.b;
        }
      }

      ctx.putImageData(data, 0, 0);
      const out = canvas.toDataURL("image/png");
      if (!cancelled) setUrl(out);
    };

    img.onerror = () => {
      if (!cancelled) setUrl(null);
    };

    return () => {
      cancelled = true;
    };
  }, [key, sheetSrc, sh, sw, sx, sy, tint.b, tint.g, tint.r]);

  return url;
}

export function MotifAlongThread({ className }: { className?: string }) {
  const motifs = Array.from({ length: COLS * ROWS }).map((_, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return { i, sx: col * TILE_W, sy: row * TILE_H };
  });

  // 黑色团花：第 1 行第 5 个（0-based: row=0,col=4）=> i=4
  const blackMotif = { i: 4, sx: 4 * TILE_W, sy: 0 * TILE_H };
  const recoloredBlackMotif = useRecoloredTileDataUrl({
    sheetSrc: SHEET_SRC,
    sx: blackMotif.sx,
    sy: blackMotif.sy,
    sw: TILE_W,
    sh: TILE_H,
    tint: { r: 134, g: 239, b: 172 }, // light green (#86EFAC)
  });

  // 均匀撒在 1200 宽的坐标系上
  const leftPad = 110;
  const rightPad = 110;
  const usable = 1200 - leftPad - rightPad;

  // 每个纹样的“原始裁切框”按 tile；再缩放到 divider 高度内
  const scale = 0.34; // 放大：让原图纹样“看得见”，同时仍能排下 20 个
  const w = TILE_W * scale;
  const h = TILE_H * scale;
  const sheetWScaled = SHEET_W * scale;
  const sheetHScaled = SHEET_H * scale;

  return (
    <div
      className={cn("pointer-events-none absolute inset-0", className)}
      aria-hidden="true"
      style={{
        // 让混合模式只在本组件内部生效，避免影响外层
        isolation: "isolate",
      }}
    >
      {/* 连续底色带：用接近原图“浅灰底”的色调铺满全宽，弱化“块状分割” */}
      <div
        style={{
          position: "absolute",
          left: "0",
          right: "0",
          top: "50%",
          transform: "translateY(-50%)",
          // 上下留白加大 1.5x（原 +10 -> +15）
          height: `${Math.max(30, h + 10)}px`,
          // 更轻盈的浅灰底带（让整体不“沉”）
          background: "linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(241, 245, 249, 0.98))",
          borderRadius: "10px",
          opacity: 1,
        }}
      />
      {motifs.map((m) => {
        const x = leftPad + (usable * m.i) / (motifs.length - 1);
        const y = threadY(x);
        const px = x / 1200;
        const py = y / 80;
        const isBlackMotif = m.i === blackMotif.i;

        const commonStyle: Record<string, string | number> = {
          position: "absolute",
          left: `${clamp(px * 100, 0, 100)}%`,
          top: `${clamp(py * 100, 0, 100)}%`,
          width: `${w}px`,
          height: `${h}px`,
          transform: "translate(-50%, -50%)",
          opacity: 1,
        };

        if (isBlackMotif && recoloredBlackMotif) {
          return (
            <img
              key={m.i}
              src={recoloredBlackMotif}
              alt=""
              draggable={false}
              style={{
                ...commonStyle,
                imageRendering: "auto",
              }}
            />
          );
        }

        return (
          <div
            key={m.i}
            style={{
              ...commonStyle,
              backgroundImage: `url(${SHEET_SRC})`,
              backgroundRepeat: "no-repeat",
              // 关键：按同一比例缩放整张雪碧图，确保每个 tile 在容器里“完整可见”
              backgroundSize: `${sheetWScaled}px ${sheetHScaled}px`,
              backgroundPosition: `${-m.sx * scale}px ${-m.sy * scale}px`,
              // 视觉消除白色方块底：用 darken 更接近“只把白底变成底带颜色”
              mixBlendMode: "darken",
            }}
          />
        );
      })}
    </div>
  );
}

