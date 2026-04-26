"use client";

import { useCallback } from "react";

import { UTF8_BOM, toCsvTable } from "@/lib/csv";
import { Button } from "@/components/ui/button";

type TrendRow = { ym: string; income: number; expense: number; net: number };

type CategoryRow = { kind: string; label: string; amount: number; sharePct: number };

type ExportCopy = {
  exportThisMonth: string;
  exportTrend: string;
  colKind: string;
  colLabel: string;
  colAmount: string;
  colShare: string;
  colMonth: string;
  colIncome: string;
  colExpense: string;
  colNet: string;
};

type Props = {
  locale: string;
  viewingYm: string;
  copy: ExportCopy;
  current: {
    totalIncome: number;
    totalExpense: number;
    net: number;
    categoryRows: CategoryRow[];
  };
  trend: TrendRow[];
  trendFileSuffix: string;
};

function downloadBlob(filename: string, text: string) {
  const blob = new Blob([UTF8_BOM + text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportExportButtons({ locale, viewingYm, copy, current, trend, trendFileSuffix }: Props) {
  const safeYm = viewingYm.replace(/[^0-9-]/g, "-");

  const onExportMonth = useCallback(() => {
    const header: (string | number | boolean)[] = [copy.colKind, copy.colLabel, copy.colAmount, copy.colShare];
    const categoryRows = current.categoryRows.map((r) => [r.kind, r.label, r.amount.toFixed(2), r.sharePct.toFixed(1)]);
    const summary: (string | number)[][] = [
      ["", "total_income", current.totalIncome.toFixed(2), ""],
      ["", "total_expense", current.totalExpense.toFixed(2), ""],
      ["", "net", current.net.toFixed(2), ""],
    ];
    const all: (string | number | boolean)[][] = [header, ...categoryRows, ...summary];
    const text = toCsvTable(all);
    const lang = locale === "zh" ? "zh" : "en";
    downloadBlob(`kapi-reports-month-${safeYm}-${lang}.csv`, text);
  }, [copy, current, locale, safeYm]);

  const onExportTrend = useCallback(() => {
    const h = [copy.colMonth, copy.colIncome, copy.colExpense, copy.colNet] as const;
    const dataRows = trend.map((r) => [r.ym, r.income.toFixed(2), r.expense.toFixed(2), r.net.toFixed(2)]);
    const text = toCsvTable([h as unknown as (string | number | boolean)[], ...dataRows]);
    const lang = locale === "zh" ? "zh" : "en";
    downloadBlob(`kapi-reports-trend-${trendFileSuffix}-${lang}.csv`, text);
  }, [copy, locale, trend, trendFileSuffix]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onExportMonth}>
        {copy.exportThisMonth}
      </Button>
      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onExportTrend}>
        {copy.exportTrend}
      </Button>
    </div>
  );
}
