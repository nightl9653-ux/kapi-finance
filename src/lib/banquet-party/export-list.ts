import { getPartyBudgetSummary } from "@/lib/banquet-party/budget";
import type { Party } from "@/lib/banquet-party/types";
import { downloadCsv, escapeHtml, htmlTable, openPrintableHtml, safeFileSlug } from "@/lib/export-download";
import { formatProjectMoney, formatProjectMoneyForCsv, coerceCurrency, BASE_CURRENCY } from "@/lib/fx";

type TFn = (key: string, values?: Record<string, string | number>) => string;

export type ListExportLabels = {
  sectionBudget: string;
  sectionItems: string;
  colCategory: string;
  colPlanned: string;
  colPurchased: string;
  colItems: string;
  colPending: string;
  colName: string;
  colQty: string;
  colUnitPrice: string;
  colLineTotal: string;
  colStatus: string;
  colNote: string;
  statusPurchased: string;
  statusPending: string;
  total: string;
  currency: string;
  partyDate: string;
  budgetCap: string;
  printBlocked: string;
};

function categoryLabel(t: TFn, category: string) {
  return t(`materialCategory.${category}`);
}

function materialNote(m: Party["materials"][number]) {
  return m.characterNote?.trim() || "";
}

function isPurchased(m: Party["materials"][number]) {
  return Boolean(m.transactionId) || m.isPurchased;
}

export function buildPartyExportRows(party: Party, t: TFn, labels: ListExportLabels) {
  const currency = coerceCurrency(party.currency ?? BASE_CURRENCY);
  const budget = getPartyBudgetSummary(party);
  const money = (n: number) => formatProjectMoney(n, currency);
  const moneyPrint = (n: number) => {
    const v = Number.isFinite(n) ? n : 0;
    const digits = Math.round(v * 100) % 100 === 0 ? 0 : 2;
    return formatProjectMoney(v, currency, { digits });
  };
  const csvMoney = (n: number) => formatProjectMoneyForCsv(n, currency);
  const hasNotes = party.materials.some((m) => Boolean(materialNote(m)));

  const summaryRows: (string | number | boolean)[][] = [
    [party.name],
    [labels.partyDate, party.date],
    [labels.currency, currency],
    ...(budget.budgetCap != null && budget.budgetCap > 0
      ? [[labels.budgetCap, csvMoney(budget.budgetCap)] as (string | number)[]]
      : []),
    [],
    [labels.sectionBudget],
    [labels.colPlanned, csvMoney(budget.totalPlanned)],
    [labels.colPurchased, csvMoney(budget.totalPurchased)],
    [labels.colPending, budget.totalPending],
    [],
    [labels.colCategory, labels.colPlanned, labels.colPurchased, labels.colItems, labels.colPending],
    ...budget.byCategory.map((c) => [
      categoryLabel(t, c.category),
      csvMoney(c.planned),
      csvMoney(c.purchased),
      c.itemCount,
      c.pendingCount,
    ]),
    [labels.total, csvMoney(budget.totalPlanned), csvMoney(budget.totalPurchased), party.materials.length, budget.totalPending],
    [],
    [labels.sectionItems],
    [
      labels.colName,
      labels.colCategory,
      labels.colQty,
      labels.colUnitPrice,
      labels.colLineTotal,
      labels.colStatus,
      ...(hasNotes ? [labels.colNote] : []),
    ],
    ...party.materials.map((m) => [
      m.name,
      categoryLabel(t, m.category),
      m.quantity,
      csvMoney(m.price),
      csvMoney(m.quantity * m.price),
      isPurchased(m) ? labels.statusPurchased : labels.statusPending,
      ...(hasNotes ? [materialNote(m)] : []),
    ]),
  ];

  const budgetTableRows = budget.byCategory.map((c) => [
    categoryLabel(t, c.category),
    moneyPrint(c.planned),
    moneyPrint(c.purchased),
    String(c.itemCount),
    String(c.pendingCount),
  ]);
  budgetTableRows.push([
    labels.total,
    moneyPrint(budget.totalPlanned),
    moneyPrint(budget.totalPurchased),
    String(party.materials.length),
    String(budget.totalPending),
  ]);

  const itemTableRows = party.materials.map((m) => {
    const row: (string | number)[] = [
      m.name,
      categoryLabel(t, m.category),
      String(m.quantity),
      moneyPrint(m.price),
      moneyPrint(m.quantity * m.price),
      isPurchased(m) ? labels.statusPurchased : labels.statusPending,
    ];
    if (hasNotes) row.push(materialNote(m));
    return row;
  });
  const itemHeaders = [
    labels.colName,
    labels.colCategory,
    labels.colQty,
    labels.colUnitPrice,
    labels.colLineTotal,
    labels.colStatus,
    ...(hasNotes ? [labels.colNote] : []),
  ];

  const printHtml = `
    <h1>${escapeHtml(party.name)}</h1>
    <p class="meta">${escapeHtml(labels.partyDate)}: ${escapeHtml(party.date)} · ${escapeHtml(labels.currency)}: ${escapeHtml(currency)}${
      budget.budgetCap != null && budget.budgetCap > 0
        ? ` · ${escapeHtml(labels.budgetCap)}: ${escapeHtml(money(budget.budgetCap))}`
        : ""
    }</p>
    <h2>${escapeHtml(labels.sectionBudget)}</h2>
    ${htmlTable(
      [labels.colCategory, labels.colPlanned, labels.colPurchased, labels.colItems, labels.colPending],
      budgetTableRows,
      [1, 2, 3, 4],
      { colWidths: ["18%", "22%", "22%", "18%", "20%"] },
    )}
    <h2>${escapeHtml(labels.sectionItems)}</h2>
    ${htmlTable(itemHeaders, itemTableRows, [2, 3, 4], {
      noteCols: hasNotes ? [6] : [],
      colWidths: hasNotes
        ? ["28%", "12%", "8%", "14%", "14%", "10%", "14%"]
        : ["32%", "14%", "8%", "16%", "16%", "14%"],
    })}
  `;

  return { summaryRows, printHtml, currency, budget };
}

export function exportPartyCsv(party: Party, t: TFn, labels: ListExportLabels, locale: string) {
  const { summaryRows } = buildPartyExportRows(party, t, labels);
  const lang = locale === "zh" ? "zh" : "en";
  downloadCsv(`kash-party-${safeFileSlug(party.name)}-${lang}.csv`, summaryRows);
}

export function exportPartyPdf(party: Party, t: TFn, labels: ListExportLabels) {
  const { printHtml } = buildPartyExportRows(party, t, labels);
  const ok = openPrintableHtml(party.name, printHtml);
  if (!ok) alert(labels.printBlocked);
}

export type GuestExportLabels = {
  sectionGuests: string;
  colName: string;
  colCount: string;
  colRsvp: string;
  colTable: string;
  colDietary: string;
  colContact: string;
  partyDate: string;
  headcount: string;
  empty: string;
  printBlocked: string;
};

function guestContact(g: { contact?: string; phone?: string; email?: string }): string {
  return g.contact?.trim() || g.phone?.trim() || g.email?.trim() || "";
}

export function exportPartyGuestsPdf(party: Party, t: TFn, labels: GuestExportLabels) {
  const guests = party.guests ?? [];

  const headers = [
    labels.colName,
    labels.colCount,
    labels.colRsvp,
    labels.colTable,
    labels.colDietary,
    labels.colContact,
  ];
  const rows = guests.map((g) => [
    g.name,
    String(g.count),
    t(`rsvp.${g.rsvp}`),
    g.tableLabel?.trim() || "",
    g.dietaryNotes?.trim() || "",
    guestContact(g),
  ]);

  const printHtml = `
    <h1>${escapeHtml(party.name)}</h1>
    <p class="meta">${escapeHtml(labels.partyDate)}: ${escapeHtml(party.date)} · ${escapeHtml(labels.headcount)}</p>
    <h2>${escapeHtml(labels.sectionGuests)}</h2>
    ${
      guests.length === 0
        ? `<p>${escapeHtml(labels.empty)}</p>`
        : htmlTable(headers, rows, [1], {
            colWidths: ["22%", "8%", "12%", "14%", "22%", "22%"],
          })
    }
  `;

  const ok = openPrintableHtml(`${party.name} · ${labels.sectionGuests}`, printHtml);
  if (!ok) alert(labels.printBlocked);
}

