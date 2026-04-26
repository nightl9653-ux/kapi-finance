"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

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

function isNearWhite(r: number, g: number, b: number) {
  return r >= 248 && g >= 248 && b >= 248;
}

function isInkLike(r: number, g: number, b: number) {
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const chroma = max - min;
  return luma < 120 && chroma < 35;
}

function recolorTileToDataUrl({
  sheetSrc,
  sx,
  sy,
  tint,
  simplify,
}: {
  sheetSrc: string;
  sx: number;
  sy: number;
  tint: { r: number; g: number; b: number };
  /** 简化纹路：降采样 + 阈值提取主轮廓，减少细碎线条导致的糊感 */
  simplify?: { downsample: number; inkLuma: number };
}): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    img.src = sheetSrc;
    img.onload = () => {
      const outScale = 2;

      if (simplify) {
        const ds = Math.max(2, Math.min(6, Math.floor(simplify.downsample)));
        const sw = Math.max(10, Math.round(TILE_W / ds));
        const sh = Math.max(10, Math.round(TILE_H / ds));
        const small = document.createElement("canvas");
        small.width = sw;
        small.height = sh;
        const sctx = small.getContext("2d", { willReadFrequently: true });
        if (!sctx) return resolve(null);
        sctx.imageSmoothingEnabled = true;
        sctx.clearRect(0, 0, sw, sh);
        sctx.drawImage(img, sx, sy, TILE_W, TILE_H, 0, 0, sw, sh);

        const data = sctx.getImageData(0, 0, sw, sh);
        const d = data.data;
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
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const min = Math.min(r, g, b);
          const max = Math.max(r, g, b);
          const chroma = max - min;
          const isInk = luma < simplify.inkLuma && chroma < 55;
          if (isInk) {
            d[i] = tint.r;
            d[i + 1] = tint.g;
            d[i + 2] = tint.b;
            d[i + 3] = 255;
          } else {
            d[i + 3] = 0;
          }
        }
        sctx.putImageData(data, 0, 0);

        const out = document.createElement("canvas");
        out.width = TILE_W * outScale;
        out.height = TILE_H * outScale;
        const octx = out.getContext("2d");
        if (!octx) return resolve(small.toDataURL("image/png"));
        // 放大时使用轻微平滑，让轮廓不那么“像素块”
        octx.imageSmoothingEnabled = true;
        octx.clearRect(0, 0, out.width, out.height);
        octx.drawImage(small, 0, 0, out.width, out.height);
        return resolve(out.toDataURL("image/png"));
      }

      const canvas = document.createElement("canvas");
      canvas.width = TILE_W;
      canvas.height = TILE_H;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return resolve(null);
      ctx.drawImage(img, sx, sy, TILE_W, TILE_H, 0, 0, TILE_W, TILE_H);
      const data = ctx.getImageData(0, 0, TILE_W, TILE_H);
      const d = data.data;
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

      const out = document.createElement("canvas");
      out.width = TILE_W * outScale;
      out.height = TILE_H * outScale;
      const octx = out.getContext("2d");
      if (!octx) return resolve(canvas.toDataURL("image/png"));
      octx.imageSmoothingEnabled = false;
      octx.clearRect(0, 0, out.width, out.height);
      octx.drawImage(canvas, 0, 0, out.width, out.height);
      resolve(out.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
  });
}

export function OrnamentDivider({
  className,
  dense,
  scale,
}: {
  className?: string;
  /** 更紧凑的高度（默认更舒展） */
  dense?: boolean;
  /** 整条分隔（底带+金丝线+小花纹）整体缩放 */
  scale?: number;
}) {
  const s = typeof scale === "number" && Number.isFinite(scale) ? scale : 1;
  const threadRef = useRef<SVGPathElement | null>(null);
  const [points, setPoints] = useState<Array<{ x: number; y: number; a: number }>>([]);

  // 20 个纹样，按雪碧图顺序
  const motifs = useMemo(() => {
    // 去掉用户指定的纹样（按雪碧图索引 i）
    // - i=5/6：第 2 行前两个
    const omit = new Set([5, 6]);
    return Array.from({ length: COLS * ROWS })
      .map((_, i) => i)
      .filter((i) => !omit.has(i))
      .map((i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      return { i, sx: col * TILE_W, sy: row * TILE_H };
    });
  }, []);

  // 交互调整：删除最右边那个，并把最左边那个移到它的位置
  // 等价于：把第一个挪到末尾，同时丢弃原本最后一个（总数减少 1）
  const motifsToPlace = useMemo(() => {
    if (motifs.length <= 2) return motifs;
    const list = [...motifs];
    const first = list.shift();
    list.pop();
    if (first) list.push(first);
    return list;
  }, [motifs]);

  // 指定纹样重着色（只改墨线，不改底纹）
  const [recoloredByIndex, setRecoloredByIndex] = useState<Record<number, string | null>>({});
  useLayoutEffect(() => {
    let alive = true;
    (async () => {
      // i=4：顶部右侧黑色团花 -> 淡绿色（沿用之前效果）
      const i4 = await recolorTileToDataUrl({
        sheetSrc: SHEET_SRC,
        sx: 4 * TILE_W,
        sy: 0,
        tint: { r: 134, g: 239, b: 172 }, // #86EFAC (淡绿)
      });
      // i=11：第 3 行第 2 个黑色卷草团花 -> 淡紫色（只改纹路，不改底纹）
      // 0-based row=2,col=1 => i=2*5+1=11
      const i11 = await recolorTileToDataUrl({
        sheetSrc: SHEET_SRC,
        sx: 1 * TILE_W,
        sy: 2 * TILE_H,
        tint: { r: 196, g: 181, b: 253 }, // #C4B5FD (淡紫)
        simplify: { downsample: 3, inkLuma: 150 },
      });
      if (!alive) return;
      setRecoloredByIndex({ 4: i4, 11: i11 });
    })();
    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(() => {
    const path = threadRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    const n = motifsToPlace.length;
    // 横向均分：先在 1200 的 x 坐标上等分，再把 x 映射到 path 的长度采样点。
    // 同时两端留安全边距，减少越界风险。
    const leftPad = 120;
    const rightPad = 120;
    const usable = 1200 - leftPad - rightPad;

    const pts: Array<{ x: number; y: number; a: number }> = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = leftPad + usable * t;
      const len = clamp((x / 1200) * total, 0, total);
      const p = path.getPointAtLength(len);
      const p1 = path.getPointAtLength(clamp(len - 1.5, 0, total));
      const p2 = path.getPointAtLength(clamp(len + 1.5, 0, total));
      const a = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      pts.push({ x: p.x, y: p.y, a });
    }
    setPoints(pts);
    // 仅首次/布局变动触发；本组件尺寸由 viewBox 控制
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motifsToPlace.length]);

  const tileScale = 0.34;
  const w = TILE_W * tileScale;
  const h = TILE_H * tileScale;
  const sheetWScaled = SHEET_W * tileScale;
  const sheetHScaled = SHEET_H * tileScale;

  return (
    <div className={cn("relative w-full overflow-hidden", dense ? "py-2" : "py-3", className)}>
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2"
        style={{
          transform: `translateY(-50%) scale(${s})`,
          transformOrigin: "center",
        }}
      >
        <svg
          viewBox="0 0 1200 80"
          role="presentation"
          aria-hidden="true"
          className={cn("w-full", dense ? "opacity-95" : "opacity-100")}
          style={{ height: `${40}px` }}
          preserveAspectRatio="none"
        >
          <defs>
            {/* 宋/明织锦语汇：回纹、如意头、团花/缠枝；用鎏金勾线 + 流光高光（同一路径叠描） */}
            <linearGradient id="kapi-brocade-ink" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#0B1220" stopOpacity="0.5" />
              <stop offset="0.5" stopColor="#0B1220" stopOpacity="0.35" />
              <stop offset="1" stopColor="#0B1220" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="kapi-gold-line" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#92400E" stopOpacity="0.55" />
              <stop offset="0.25" stopColor="#EAB308" stopOpacity="0.55" />
              <stop offset="0.5" stopColor="#B45309" stopOpacity="0.55" />
              <stop offset="0.75" stopColor="#F59E0B" stopOpacity="0.55" />
              <stop offset="1" stopColor="#92400E" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="kapi-iridescent-hi" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#06B6D4" stopOpacity="0.35" />
              <stop offset="0.2" stopColor="#22C55E" stopOpacity="0.32" />
              <stop offset="0.5" stopColor="#A855F7" stopOpacity="0.32" />
              <stop offset="0.78" stopColor="#F59E0B" stopOpacity="0.32" />
              <stop offset="1" stopColor="#EC4899" stopOpacity="0.35" />
            </linearGradient>

            {/* 织锦底纹：规整回纹（更“织物”，少自由曲线） */}
            <pattern id="kapi-meander" width="72" height="36" patternUnits="userSpaceOnUse">
              <path
                d="M8 10 h18 v16 h14 v-22 h18 v16 h-14 v16 h-36 z"
                fill="none"
                stroke="url(#kapi-brocade-ink)"
                strokeWidth="1.15"
                strokeLinejoin="miter"
                opacity="0.38"
              />
              <path
                d="M54 9 h10 v10 h-10 z M56 11 h6 v6 h-6 z"
                fill="none"
                stroke="url(#kapi-gold-line)"
                strokeWidth="1.05"
                opacity="0.22"
              />
            </pattern>

            {/* 裁切：确保任何旋转/缩放后的纹样都不会溢出画布 */}
            <clipPath id="kapi-divider-clip">
              <rect x="0" y="0" width="1200" height="80" />
            </clipPath>
          </defs>

          {/* 锦缎底纹条 */}
          <rect x="0" y="24" width="1200" height="32" fill="url(#kapi-meander)" opacity="0.72" />

          {/* 贯穿的金丝线：更贴近正弦，但用“微非正弦”的古典起伏（避免过于古板） */}
          <path
            ref={threadRef}
            id="kapi-thread"
            d="
              M0 40
              C120 33, 200 47, 320 40
              C430 34, 500 29, 600 40
              C700 51, 790 47, 920 40
              C1030 34, 1100 33, 1200 40
            "
            fill="none"
            stroke="url(#kapi-gold-line)"
            strokeWidth="1.35"
            strokeLinecap="round"
            opacity="0.8"
          />
          <path
            d="
              M0 40
              C120 33, 200 47, 320 40
              C430 34, 500 29, 600 40
              C700 51, 790 47, 920 40
              C1030 34, 1100 33, 1200 40
            "
            fill="none"
            stroke="url(#kapi-iridescent-hi)"
            strokeWidth="0.85"
            strokeLinecap="round"
            opacity="0.42"
          />

          {/* 纹样：沿 thread path 采样定位 + 轻微随切线旋转 */}
          {points.length === motifsToPlace.length ? (
            <g clipPath="url(#kapi-divider-clip)">
              {motifsToPlace.map((m, idx) => {
                const p = points[idx]!;
                const recolored = recoloredByIndex[m.i] ?? null;
                const hasRecolor = Boolean(recolored);
                const href = hasRecolor ? (recolored as string) : SHEET_SRC;
                const sx = hasRecolor ? 0 : m.sx;
                const sy = hasRecolor ? 0 : m.sy;
                return (
                  <g key={m.i} transform={`translate(${p.x} ${p.y}) rotate(${(p.a * 180) / Math.PI})`}>
                    {/* 用 foreignObject 继续沿用“雪碧图裁切”逻辑（保持纹样不变），但位置/旋转由 path 控制 */}
                    {!hasRecolor ? (
                      <foreignObject x={-w / 2} y={-h / 2} width={w} height={h} style={{ overflow: "visible" }}>
                        <div
                          style={{
                            width: `${w}px`,
                            height: `${h}px`,
                            backgroundImage: `url(${SHEET_SRC})`,
                            backgroundRepeat: "no-repeat",
                            backgroundSize: `${sheetWScaled}px ${sheetHScaled}px`,
                            backgroundPosition: `${-sx * tileScale}px ${-sy * tileScale}px`,
                            mixBlendMode: "darken",
                          }}
                        />
                      </foreignObject>
                    ) : (
                      <foreignObject x={-w / 2} y={-h / 2} width={w} height={h} style={{ overflow: "visible" }}>
                        <img
                          src={href}
                          alt=""
                          draggable={false}
                          style={{
                            width: `${w}px`,
                            height: `${h}px`,
                            display: "block",
                            imageRendering: "crisp-edges",
                          }}
                        />
                      </foreignObject>
                    )}
                  </g>
                );
              })}
            </g>
          ) : null}

          {/* 主纹路径（先鎏金勾线，再用同一路径叠一层“流光”高光） */}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* 1) 外侧如意头（更规整的 ruyi 轮廓） */}
            <path
              id="kapi-ruyi"
              d="
                M120 40
                C168 18, 248 18, 300 40
                C332 56, 318 72, 292 72
                C270 72, 262 58, 276 50
                C244 58, 236 78, 254 86

                M1080 40
                C1032 18, 952 18, 900 40
                C868 56, 882 72, 908 72
                C930 72, 938 58, 924 50
                C956 58, 964 78, 946 86
              "
            />

            {/* 2) 中部对称缠枝（避免“潦草”，用更稳定的曲率） */}
            <path
              id="kapi-scroll"
              d="
                M300 40
                C392 24, 496 24, 560 36
                C580 40, 620 40, 640 36
                C704 24, 808 24, 900 40
              "
            />

            {/* 3) 团花/莲瓣感的中央纹章（更像服饰团纹） */}
            <path
              id="kapi-medallion"
              d="
                M600 40
                m-18 0
                a18 18 0 1 0 36 0
                a18 18 0 1 0 -36 0
                M600 26
                C606 30, 612 34, 618 40
                C612 46, 606 50, 600 54
                C594 50, 588 46, 582 40
                C588 34, 594 30, 600 26
              "
            />

            {/* 4) 细边回纹线（上/下两道），增强“织锦边栏” */}
            <path id="kapi-border-top" d="M80 28 H1120" />
            <path id="kapi-border-bot" d="M80 52 H1120" />

            {/* 鎏金主线 */}
            <use href="#kapi-ruyi" stroke="url(#kapi-gold-line)" strokeWidth="2.35" opacity="0.88" />
            <use href="#kapi-scroll" stroke="url(#kapi-gold-line)" strokeWidth="2.15" opacity="0.85" />
            <use href="#kapi-medallion" stroke="url(#kapi-gold-line)" strokeWidth="2.0" opacity="0.82" />
            <use href="#kapi-border-top" stroke="url(#kapi-gold-line)" strokeWidth="1.15" opacity="0.35" />
            <use href="#kapi-border-bot" stroke="url(#kapi-gold-line)" strokeWidth="1.15" opacity="0.35" />

            {/* 流光高光（同一路径叠描，透明度更低，避免“后现代”感） */}
            <use href="#kapi-ruyi" stroke="url(#kapi-iridescent-hi)" strokeWidth="1.55" opacity="0.55" />
            <use href="#kapi-scroll" stroke="url(#kapi-iridescent-hi)" strokeWidth="1.45" opacity="0.52" />
            <use href="#kapi-medallion" stroke="url(#kapi-iridescent-hi)" strokeWidth="1.35" opacity="0.5" />
          </g>

          {/* 参考你给的“装饰图案合集”：加入两个小型团花徽章（更规整，避免后现代潦草） */}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/*
              这个 motif 是“团花/卷草”抽象：四向卷叶 + 中心小花，
              风格接近图中那些对称装饰章纹（但用更简洁的矢量以适配分隔条）。
            */}
            <g transform="translate(420 40) scale(0.9)">
              <path
                d="
                  M0 -16
                  C6 -16, 10 -12, 10 -8
                  C10 -3, 6 0, 0 2
                  C-6 0, -10 -3, -10 -8
                  C-10 -12, -6 -16, 0 -16

                  M0 16
                  C6 16, 10 12, 10 8
                  C10 3, 6 0, 0 -2
                  C-6 0, -10 3, -10 8
                  C-10 12, -6 16, 0 16

                  M16 0
                  C16 6, 12 10, 8 10
                  C3 10, 0 6, -2 0
                  C0 -6, 3 -10, 8 -10
                  C12 -10, 16 -6, 16 0

                  M-16 0
                  C-16 6, -12 10, -8 10
                  C-3 10, 0 6, 2 0
                  C0 -6, -3 -10, -8 -10
                  C-12 -10, -16 -6, -16 0
                "
                stroke="url(#kapi-gold-line)"
                strokeWidth="1.55"
                opacity="0.85"
              />
              <path
                d="
                  M0 -16
                  C6 -16, 10 -12, 10 -8
                  C10 -3, 6 0, 0 2
                  C-6 0, -10 -3, -10 -8
                  C-10 -12, -6 -16, 0 -16
                "
                stroke="url(#kapi-iridescent-hi)"
                strokeWidth="0.95"
                opacity="0.55"
              />
              <circle cx="0" cy="0" r="3.2" stroke="url(#kapi-gold-line)" strokeWidth="1.2" opacity="0.7" />
              <circle cx="0" cy="0" r="1.6" fill="#EAB308" opacity="0.55" />
            </g>

            <g transform="translate(780 40) scale(0.9)">
              <path
                d="
                  M0 -18
                  C10 -18, 16 -12, 16 -2
                  C16 6, 10 12, 0 14
                  C-10 12, -16 6, -16 -2
                  C-16 -12, -10 -18, 0 -18

                  M0 -10
                  C4 -10, 8 -6, 8 -2
                  C8 2, 4 6, 0 6
                  C-4 6, -8 2, -8 -2
                  C-8 -6, -4 -10, 0 -10
                "
                stroke="url(#kapi-gold-line)"
                strokeWidth="1.5"
                opacity="0.82"
              />
              <path
                d="M-12 0 C-6 -8, 6 -8, 12 0 C6 8, -6 8, -12 0 Z"
                stroke="url(#kapi-iridescent-hi)"
                strokeWidth="0.9"
                opacity="0.5"
              />
              <path
                d="M0 -18 L0 -26 M0 14 L0 22"
                stroke="url(#kapi-brocade-ink)"
                strokeWidth="1.0"
                opacity="0.35"
              />
            </g>
          </g>

          {/* 彩珠点缀（更像织锦的亮丝） */}
          <g>
            <circle cx="600" cy="40" r="2.8" fill="#EAB308" opacity="0.55" />
            <circle cx="548" cy="33" r="2.2" fill="#06B6D4" opacity="0.48" />
            <circle cx="652" cy="33" r="2.2" fill="#EC4899" opacity="0.46" />
            <circle cx="300" cy="40" r="2.0" fill="#22C55E" opacity="0.42" />
            <circle cx="900" cy="40" r="2.0" fill="#A855F7" opacity="0.42" />
          </g>
        </svg>
      </div>

      {/* 留白，避免遮住内容 */}
      <div style={{ height: `${40 * s}px` }} />
    </div>
  );
}

