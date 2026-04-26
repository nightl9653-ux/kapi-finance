/** 生成 Excel 可识别的 UTF-8 CSV 单元格（适当时加引号转义） */
export function escapeCsvField(value: string | number | boolean): string {
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsvTable(rows: (string | number | boolean)[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
}

export const UTF8_BOM = "\uFEFF";
