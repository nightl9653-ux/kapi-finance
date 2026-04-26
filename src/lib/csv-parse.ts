export type CsvRow = Record<string, string>;

// Minimal RFC4180-ish CSV parser:
// - Supports quotes with escaped quotes ("")
// - Supports commas and newlines inside quoted fields
// - Trims BOM on first header cell
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };

  const pushRow = () => {
    // Ignore trailing empty row at end-of-file
    if (row.length === 1 && row[0] === "" && out.length === 0) {
      // allow empty file to produce []
    }
    out.push(row);
    row = [];
  };

  // Normalize line endings
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = s[i + 1];
        if (next === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      pushCell();
      i += 1;
      continue;
    }

    if (ch === "\n") {
      pushCell();
      pushRow();
      i += 1;
      continue;
    }

    cell += ch;
    i += 1;
  }

  pushCell();
  // If the file ends with newline, we already pushed an empty row; keep it filtered later by consumer.
  pushRow();

  // Remove a final empty row produced by trailing newline(s)
  while (out.length && out[out.length - 1].every((v) => v === "")) out.pop();
  return out;
}

export function csvTableToObjects(table: string[][]): CsvRow[] {
  if (!table.length) return [];
  const [rawHeader, ...body] = table;
  const header = rawHeader.map((h, idx) => {
    const cleaned = (h ?? "").trim();
    if (idx === 0) return cleaned.replace(/^\uFEFF/, ""); // strip BOM
    return cleaned;
  });
  const rows: CsvRow[] = [];
  for (const r of body) {
    if (!r || r.every((v) => String(v ?? "").trim() === "")) continue;
    const obj: CsvRow = {};
    for (let i = 0; i < header.length; i++) {
      const key = header[i];
      if (!key) continue;
      obj[key] = String(r[i] ?? "").trim();
    }
    rows.push(obj);
  }
  return rows;
}

