import { getProjectBudgetSummary } from "@/lib/house-renovation/budget";
import { categoryLabel, phaseLabel, projectTypeLabel, roomLabel, supplyTypeLabel } from "@/lib/house-renovation/labels";
import type { RenovationProject } from "@/lib/house-renovation/types";
import { downloadCsv, escapeHtml, htmlTable, openPrintableHtml, safeFileSlug } from "@/lib/export-download";
import { BASE_CURRENCY, coerceCurrency, formatProjectMoney, formatProjectMoneyForCsv } from "@/lib/fx";

type TFn = (key: string, values?: Record<string, string | number>) => string;

export type RenovationExportLabels = {
  sectionBudget: string;
  sectionByCategory: string;
  sectionByPhase: string;
  sectionItems: string;
  colCategory: string;
  colPhase: string;
  colPlanned: string;
  colPurchased: string;
  colItems: string;
  colPending: string;
  colName: string;
  colQty: string;
  colUnitPrice: string;
  colLineTotal: string;
  colRoom: string;
  colSupply: string;
  colStatus: string;
  colNote: string;
  statusPurchased: string;
  statusPending: string;
  total: string;
  currency: string;
  budgetCap: string;
  projectType: string;
  printBlocked: string;
};

export function buildProjectExportRows(project: RenovationProject, t: TFn, labels: RenovationExportLabels) {
  const currency = coerceCurrency(project.currency ?? BASE_CURRENCY);
  const budget = getProjectBudgetSummary(project);
  const money = (n: number) => formatProjectMoney(n, currency);
  /** PDF：整数不带小数，有分才显示两位 */
  const moneyPrint = (n: number) => {
    const v = Number.isFinite(n) ? n : 0;
    const digits = Math.round(v * 100) % 100 === 0 ? 0 : 2;
    return formatProjectMoney(v, currency, { digits });
  };
  const csvMoney = (n: number) => formatProjectMoneyForCsv(n, currency);

  const summaryRows: (string | number | boolean)[][] = [
    [project.name],
    [labels.projectType, projectTypeLabel(t, project.projectType)],
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
    [labels.sectionByCategory],
    [labels.colCategory, labels.colPlanned, labels.colPurchased, labels.colItems, labels.colPending],
    ...budget.byCategory.map((c) => [
      categoryLabel(t, c.category),
      csvMoney(c.planned),
      csvMoney(c.purchased),
      c.itemCount,
      c.pendingCount,
    ]),
    [],
    [labels.sectionByPhase],
    [labels.colPhase, labels.colPlanned, labels.colPurchased, labels.colItems],
    ...budget.byPhase.map((p) => [
      phaseLabel(t, p.phase),
      csvMoney(p.planned),
      csvMoney(p.purchased),
      p.itemCount,
    ]),
    [],
    [labels.sectionItems],
    [
      labels.colName,
      labels.colCategory,
      labels.colPhase,
      labels.colRoom,
      labels.colSupply,
      labels.colQty,
      labels.colUnitPrice,
      labels.colLineTotal,
      labels.colStatus,
      labels.colNote,
    ],
    ...project.materials.map((m) => [
      m.name,
      categoryLabel(t, m.category),
      phaseLabel(t, m.phase),
      m.room ? roomLabel(t, m.room) : "",
      m.supplyType ? supplyTypeLabel(t, m.supplyType) : "",
      m.quantity,
      csvMoney(m.price),
      csvMoney(m.quantity * m.price),
      m.isPurchased || m.transactionId ? labels.statusPurchased : labels.statusPending,
      m.note ?? "",
    ]),
  ];

  const catRows = budget.byCategory.map((c) => [
    categoryLabel(t, c.category),
    moneyPrint(c.planned),
    moneyPrint(c.purchased),
    String(c.itemCount),
    String(c.pendingCount),
  ]);
  const phaseRows = budget.byPhase.map((p) => [
    phaseLabel(t, p.phase),
    moneyPrint(p.planned),
    moneyPrint(p.purchased),
    String(p.itemCount),
  ]);
  const hasNotes = project.materials.some((m) => Boolean(m.note?.trim()));
  const itemRows = project.materials.map((m) => {
    const row: (string | number)[] = [
      m.name,
      categoryLabel(t, m.category),
      phaseLabel(t, m.phase),
      m.room ? roomLabel(t, m.room) : "",
      String(m.quantity),
      moneyPrint(m.price),
      moneyPrint(m.quantity * m.price),
      m.isPurchased || m.transactionId ? labels.statusPurchased : labels.statusPending,
    ];
    if (hasNotes) row.push(m.note?.trim() || "");
    return row;
  });
  const itemHeaders = [
    labels.colName,
    labels.colCategory,
    labels.colPhase,
    labels.colRoom,
    labels.colQty,
    labels.colUnitPrice,
    labels.colLineTotal,
    labels.colStatus,
    ...(hasNotes ? [labels.colNote] : []),
  ];

  const printHtml = `
    <h1>${escapeHtml(project.name)}</h1>
    <p class="meta">${escapeHtml(labels.projectType)}: ${escapeHtml(projectTypeLabel(t, project.projectType))} · ${escapeHtml(labels.currency)}: ${escapeHtml(currency)}
    ${budget.budgetCap != null && budget.budgetCap > 0 ? ` · ${escapeHtml(labels.budgetCap)}: ${escapeHtml(money(budget.budgetCap))}` : ""}</p>
    <h2>${escapeHtml(labels.sectionByCategory)}</h2>
    ${htmlTable(
      [labels.colCategory, labels.colPlanned, labels.colPurchased, labels.colItems, labels.colPending],
      catRows,
      [1, 2, 3, 4],
      { colWidths: ["18%", "22%", "22%", "18%", "20%"] },
    )}
    <h2>${escapeHtml(labels.sectionByPhase)}</h2>
    ${htmlTable([labels.colPhase, labels.colPlanned, labels.colPurchased, labels.colItems], phaseRows, [1, 2, 3], {
      colWidths: ["22%", "26%", "26%", "26%"],
    })}
    <h2>${escapeHtml(labels.sectionItems)}</h2>
    ${htmlTable(itemHeaders, itemRows, [4, 5, 6], {
      noteCols: hasNotes ? [8] : [],
      colWidths: hasNotes
        ? ["22%", "10%", "9%", "7%", "5%", "13%", "13%", "8%", "13%"]
        : ["26%", "12%", "10%", "8%", "5%", "14%", "14%", "11%"],
    })}
  `;

  return { summaryRows, printHtml };
}

export function exportProjectCsv(project: RenovationProject, t: TFn, labels: RenovationExportLabels, locale: string) {
  const { summaryRows } = buildProjectExportRows(project, t, labels);
  const lang = locale === "zh" ? "zh" : "en";
  downloadCsv(`kash-renovation-${safeFileSlug(project.name)}-${lang}.csv`, summaryRows);
}

export function exportProjectPdf(project: RenovationProject, t: TFn, labels: RenovationExportLabels) {
  const { printHtml } = buildProjectExportRows(project, t, labels);
  const ok = openPrintableHtml(project.name, printHtml);
  if (!ok) alert(labels.printBlocked);
}
