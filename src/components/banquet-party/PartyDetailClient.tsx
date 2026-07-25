"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { PartyAestheticsTab } from "@/components/banquet-party/party-detail/PartyAestheticsTab";
import { PartyGuestsTab } from "@/components/banquet-party/party-detail/PartyGuestsTab";
import { PartyOverviewTab } from "@/components/banquet-party/party-detail/PartyOverviewTab";
import { PartyPrepTab } from "@/components/banquet-party/party-detail/PartyPrepTab";
import { PartyTabBar } from "@/components/banquet-party/party-detail/PartyTabBar";
import { PartyTimelineTab } from "@/components/banquet-party/party-detail/PartyTimelineTab";
import { ColorComposition } from "@/components/banquet-party/ColorCarousel";
import { MaterialFormDialog } from "@/components/banquet-party/MaterialFormDialog";
import { PartyForm } from "@/components/banquet-party/PartyForm";
import { ListExportButtons } from "@/components/shared/ListExportButtons";
import { Button } from "@/components/ui/button";
import { getGuestHeadcount, getPartyBudgetSummary } from "@/lib/banquet-party/budget";
import { getSoulCharacter } from "@/lib/banquet-party/characters";
import { exportPartyCsv, exportPartyGuestsPdf, exportPartyPdf } from "@/lib/banquet-party/export-list";
import { logBanquetMaterialExpense } from "@/lib/banquet-party/log-expense";
import { computeWildnessIndex } from "@/lib/banquet-party/palette";
import { newMaterialId, upsertParty } from "@/lib/banquet-party/storage";
import type { Guest, Material, Party, PartyDetailTab, TimelineTask } from "@/lib/banquet-party/types";
import { BASE_CURRENCY, coerceCurrency, formatProjectMoney } from "@/lib/fx";

export function PartyDetailClient({
  party: initial,
  userId,
  onBack,
  onPartyUpdated,
}: {
  party: Party;
  userId: string;
  onBack: () => void;
  onPartyUpdated?: (parties: Party[]) => void;
}) {
  const t = useTranslations("banquetParty");
  const locale = useLocale();
  const [party, setParty] = useState(initial);
  const [tab, setTab] = useState<PartyDetailTab>("overview");
  const [showAdd, setShowAdd] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [showEditParty, setShowEditParty] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggingMaterialId, setLoggingMaterialId] = useState<string | null>(null);

  const character = getSoulCharacter(party.characterId);
  const wildness = useMemo(() => computeWildnessIndex(party.materials), [party.materials]);
  const budget = getPartyBudgetSummary(party);
  const currency = coerceCurrency(party.currency ?? BASE_CURRENCY);

  const persist = async (next: Party) => {
    const prev = party;
    setParty(next);
    setSaving(true);
    setError(null);
    try {
      const updated = await upsertParty(userId, next);
      const saved = updated.find((p) => p.id === next.id) ?? next;
      setParty(saved);
      onPartyUpdated?.(updated);
    } catch (e) {
      setParty(prev);
      const code = e instanceof Error ? (e as Error & { code?: string }).code : undefined;
      const msg = e instanceof Error ? e.message : "";
      setError(
        code === "PGRST204" && msg.includes("currency")
          ? t("currencyMigrationError")
          : code === "PGRST204" && msg.includes("budget_cap")
            ? t("budgetCapMigrationError")
            : t("saveError"),
      );
    } finally {
      setSaving(false);
    }
  };

  const addMaterial = (mat: Omit<Material, "id">) => {
    void persist({ ...party, materials: [...party.materials, { ...mat, id: newMaterialId() }] });
    setShowAdd(false);
  };

  const updateMaterial = (id: string, mat: Omit<Material, "id">) => {
    void persist({
      ...party,
      materials: party.materials.map((m) => (m.id === id ? { ...mat, id } : m)),
    });
    setEditingMaterial(null);
  };

  const deleteMaterial = (id: string) => {
    if (!confirm(t("deleteMaterialConfirm"))) return;
    void persist({ ...party, materials: party.materials.filter((m) => m.id !== id) });
  };

  const toggleSetup = (id: string) => {
    void persist({
      ...party,
      materials: party.materials.map((m) => (m.id === id ? { ...m, isSetup: !m.isSetup } : m)),
    });
  };

  const completeParty = () => {
    void persist({ ...party, completedAt: new Date().toISOString() });
    setShowSummary(true);
  };

  const exportLabels = {
    sectionBudget: t("export.sectionBudget"),
    sectionItems: t("export.sectionItems"),
    colCategory: t("budgetCategory"),
    colPlanned: t("budgetPlanned"),
    colPurchased: t("budgetPurchased"),
    colItems: t("budgetItems"),
    colPending: t("export.colPending"),
    colName: t("materialName"),
    colQty: t("quantity"),
    colUnitPrice: t("unitPrice"),
    colLineTotal: t("export.colLineTotal"),
    colStatus: t("export.colStatus"),
    colNote: t("characterNoteLabel"),
    statusPurchased: t("purchased"),
    statusPending: t("pending"),
    total: t("budgetTotal"),
    currency: t("currency"),
    partyDate: t("partyDate"),
    budgetCap: t("budgetCap"),
    printBlocked: t("export.printBlocked"),
  };

  const onExportCsv = () => exportPartyCsv(party, t, exportLabels, locale);
  const onExportPdf = () => exportPartyPdf(party, t, exportLabels);
  const onExportGuestsPdf = () => {
    const { confirmed, total } = getGuestHeadcount(party);
    exportPartyGuestsPdf(party, t, {
      sectionGuests: t("export.sectionGuests"),
      colName: t("guestName"),
      colCount: t("guestCount"),
      colRsvp: t("export.colRsvp"),
      colTable: t("guestTableLabel"),
      colDietary: t("guestDietaryLabel"),
      colContact: t("guestContactLabel"),
      partyDate: t("partyDate"),
      headcount: t("overviewGuestCount", { confirmed, total }),
      empty: t("noGuests"),
      printBlocked: t("export.printBlocked"),
    });
  };

  const logExpense = async (materialId: string) => {
    const m = party.materials.find((x) => x.id === materialId);
    if (!m || m.transactionId || loggingMaterialId) return;
    const amount = m.quantity * m.price;
    if (amount <= 0) {
      const msg = t("logExpenseInvalidAmount");
      setError(msg);
      alert(msg);
      return;
    }
    if (!confirm(t("logExpenseConfirm", { name: m.name, amount: formatProjectMoney(amount, currency) }))) return;

    setLoggingMaterialId(materialId);
    setSaving(true);
    setError(null);
    try {
      const result = await logBanquetMaterialExpense({
        partyId: party.id,
        partyName: party.name,
        materialName: m.name,
        amount,
        currency,
        occurredOn: party.date,
        locale,
      });
      if (!result.ok) {
        const msg =
          result.error === "fx_failed"
            ? t("logExpenseFxError")
            : result.error === "unauthorized"
              ? t("logExpenseUnauthorized")
              : result.detail?.includes("party_id")
                ? t("logExpensePartyIdError")
                : t("logExpenseError");
        setError(msg);
        alert(msg);
        return;
      }
      // 先更新本地 UI，再写库（避免「已入账但清单无反应」）
      const next: Party = {
        ...party,
        materials: party.materials.map((row) =>
          row.id === materialId
            ? { ...row, isPurchased: true, transactionId: result.transactionId }
            : row,
        ),
      };
      setParty(next);
      await persist(next);
    } catch {
      const msg = t("logExpenseError");
      setError(msg);
      alert(msg);
    } finally {
      setLoggingMaterialId(null);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t("backToList")}
        </button>
        <div className="flex flex-wrap gap-2">
          <ListExportButtons
            exportCsvLabel={t("export.csv")}
            exportPdfLabel={t("export.pdf")}
            exportGuestPdfLabel={t("export.guestsPdf")}
            onCsv={onExportCsv}
            onPdf={onExportPdf}
            onGuestPdf={onExportGuestsPdf}
          />
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setShowEditParty(true)}>
            {t("editParty")}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="sticky top-2 z-20 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {saving || loggingMaterialId ? (
        <p className="text-xs text-muted-foreground">
          {loggingMaterialId ? t("logExpenseLogging") : t("saving")}
        </p>
      ) : null}

      {showEditParty ? (
        <PartyForm
          mode="edit"
          initial={party}
          onCancel={() => setShowEditParty(false)}
          onSave={async (next) => {
            await persist(next);
            setShowEditParty(false);
          }}
        />
      ) : (
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">{party.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {party.date} · {t("spendTotal", {
              amount: formatProjectMoney(budget.totalPlanned, currency),
              purchased: formatProjectMoney(budget.totalPurchased, currency),
            })}
            {budget.overCap ? ` · ${t("overCap")}` : ""}
            {party.completedAt ? ` · ${t("completed")}` : ""}
          </p>
        </div>
      )}

      <PartyTabBar active={tab} onChange={setTab} />

      {tab === "overview" ? (
        <PartyOverviewTab
          party={party}
          onGoPrep={() => setTab("prep")}
          onGoGuests={() => setTab("guests")}
          onGoTimeline={() => setTab("timeline")}
          onComplete={completeParty}
        />
      ) : null}

      {tab === "aesthetics" ? <PartyAestheticsTab party={party} /> : null}

      {tab === "prep" ? (
        <PartyPrepTab
          party={party}
          loggingMaterialId={loggingMaterialId}
          onAddMaterial={() => setShowAdd(true)}
          onToggleSetup={toggleSetup}
          onEditMaterial={setEditingMaterial}
          onDeleteMaterial={deleteMaterial}
          onLogExpense={(id) => void logExpense(id)}
        />
      ) : null}

      {tab === "guests" ? (
        <PartyGuestsTab party={party} onChange={(guests: Guest[]) => void persist({ ...party, guests })} />
      ) : null}

      {tab === "timeline" ? (
        <PartyTimelineTab
          party={party}
          onChange={(timeline: TimelineTask[]) => void persist({ ...party, timeline })}
        />
      ) : null}

      {showAdd ? <MaterialFormDialog mode="add" onClose={() => setShowAdd(false)} onSave={addMaterial} /> : null}

      {editingMaterial ? (
        <MaterialFormDialog
          mode="edit"
          initial={editingMaterial}
          onClose={() => setEditingMaterial(null)}
          onSave={(mat) => updateMaterial(editingMaterial.id, mat)}
        />
      ) : null}

      {showSummary ? (
        <SummaryOverlay party={party} character={character} wildness={wildness} onClose={() => setShowSummary(false)} />
      ) : null}
    </div>
  );
}

function SummaryOverlay({
  party,
  character,
  wildness,
  onClose,
}: {
  party: Party;
  character: ReturnType<typeof getSoulCharacter>;
  wildness: ReturnType<typeof computeWildnessIndex>;
  onClose: () => void;
}) {
  const t = useTranslations("banquetParty");
  const palette = party.colorPalette;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
      <div className="mx-auto max-w-lg rounded-3xl border bg-gradient-to-br from-[#F4EFEA] via-[#FAF9F7] to-[#EEE7DE] p-6 shadow-2xl">
        <p className="text-center text-2xl">🎉</p>
        <h2 className="mt-2 text-center text-xl font-semibold">{t("summaryTitle")}</h2>
        <p className="text-center text-sm text-muted-foreground">{party.name}</p>

        {character ? (
          <div className="mt-4 rounded-2xl border bg-white/60 p-4 text-center">
            <p className="text-3xl">{character.emoji}</p>
            <p className="mt-1 font-medium">{t(`characters.${character.nameKey}`)}</p>
            <p className="text-xs text-muted-foreground">{t(`characters.${character.jewelryKey}`)}</p>
          </div>
        ) : null}

        <div className="mt-4">
          <ColorComposition
            distribution={palette.distribution}
            primary={palette.primary}
            secondaries={palette.secondaries}
            accents={palette.accents}
          />
        </div>

        <div className="mt-4 rounded-xl border bg-white/50 p-3 text-sm">
          <p className="font-medium">{t("wildnessTitle")}</p>
          <p className="mt-1">
            {"🌿".repeat(Math.round(wildness.score))}
            <span className="text-muted-foreground">
              {" "}
              {wildness.score}/{wildness.max}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t(`wildness.${wildness.reasonKey}`)}</p>
        </div>

        <Button className="mt-6 w-full rounded-full" onClick={onClose}>
          {t("closeSummary")}
        </Button>
      </div>
    </div>
  );
}
