"use client";

import { Button } from "@/components/ui/button";

export function ListExportButtons({
  exportCsvLabel,
  exportPdfLabel,
  exportGuestPdfLabel,
  onCsv,
  onPdf,
  onGuestPdf,
}: {
  exportCsvLabel: string;
  exportPdfLabel: string;
  exportGuestPdfLabel?: string;
  onCsv: () => void;
  onPdf: () => void;
  onGuestPdf?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onCsv}>
        {exportCsvLabel}
      </Button>
      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onPdf}>
        {exportPdfLabel}
      </Button>
      {exportGuestPdfLabel && onGuestPdf ? (
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onGuestPdf}>
          {exportGuestPdfLabel}
        </Button>
      ) : null}
    </div>
  );
}
