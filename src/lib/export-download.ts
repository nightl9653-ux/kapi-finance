import { UTF8_BOM, toCsvTable } from "@/lib/csv";

/** 触发浏览器下载文本文件（CSV 等） */
export function downloadTextFile(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text.startsWith(UTF8_BOM) ? text : UTF8_BOM + text], { type: mime });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, rows: (string | number | boolean)[][]) {
  downloadTextFile(filename.endsWith(".csv") ? filename : `${filename}.csv`, toCsvTable(rows));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { escapeHtml };

/** 打开可打印预览；用户可在系统对话框中「另存为 PDF」 */
export function openPrintableHtml(title: string, bodyHtml: string) {
  // 打印必须在预览页自身上下文调用；从 opener 跨窗口 print 会报
  // “The provided callback is no longer runnable”（尤其 Edge）。
  // 不用 blob: URL：Edge 对 blob 页自动 print 常出现「打印预览失败」。
  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
    .meta { color: #555; font-size: 0.85rem; margin-bottom: 1.25rem; }
    h2 { font-size: 1rem; margin: 1.25rem 0 0.5rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 1rem; table-layout: fixed; }
    th, td {
      border: 1px solid #ccc; padding: 7px 8px; text-align: left;
      vertical-align: top; overflow-wrap: break-word; word-break: break-word;
    }
    th { background: #f4f4f4; font-weight: 600; }
    td.num, th.num {
      text-align: right; font-variant-numeric: tabular-nums;
      white-space: nowrap; overflow-wrap: normal; word-break: normal;
    }
    .hint { margin-top: 1.5rem; color: #666; font-size: 0.8rem; }
    .actions { margin: 1rem 0 1.5rem; }
    .actions button {
      font: inherit; font-size: 0.9rem; padding: 0.45rem 0.9rem;
      border: 1px solid #ccc; border-radius: 999px; background: #111; color: #fff; cursor: pointer;
    }
    @media print {
      body { padding: 0; }
      .hint, .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  ${bodyHtml}
  <div class="actions no-print">
    <button type="button" id="print-btn">打印 / 另存为 PDF</button>
  </div>
  <p class="hint no-print">
    横向：点左侧「更多设置」→「方向」或「布局」→「横向」。
    若仍显示「打印预览失败」，先关掉对话框，再点上方黑色按钮重试。
  </p>
  <script>
    (function () {
      var btn = document.getElementById("print-btn");
      var printed = false;
      function doPrint() {
        try { window.focus(); window.print(); } catch (e) {}
      }
      if (btn) btn.addEventListener("click", doPrint);
      function autoPrint() {
        if (printed) return;
        printed = true;
        setTimeout(doPrint, 300);
      }
      if (document.readyState === "complete") autoPrint();
      else window.addEventListener("load", autoPrint);
    })();
  <\/script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

export function htmlTable(
  headers: string[],
  rows: (string | number)[][],
  numCols: number[] = [],
  noteColsOrOptions?:
    | number[]
    | {
        noteCols?: number[];
        colWidths?: string[];
      },
): string {
  const options = Array.isArray(noteColsOrOptions)
    ? { noteCols: noteColsOrOptions }
    : (noteColsOrOptions ?? {});
  const noteCols = Array.isArray(options.noteCols) ? options.noteCols : [];
  const colWidths = options.colWidths;
  const cellClass = (i: number) => {
    if (numCols.includes(i)) return ' class="num"';
    if (noteCols.includes(i)) return ' class="note"';
    return "";
  };
  const colgroup =
    colWidths && colWidths.length === headers.length
      ? `<colgroup>${colWidths.map((w) => `<col style="width:${w}" />`).join("")}</colgroup>`
      : "";
  const th = headers.map((h, i) => `<th${cellClass(i)}>${escapeHtml(h)}</th>`).join("");
  const trs = rows
    .map(
      (r) =>
        `<tr>${r.map((c, i) => `<td${cellClass(i)}>${escapeHtml(String(c))}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table>${colgroup}<thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

export function safeFileSlug(name: string): string {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 60) || "export";
}
