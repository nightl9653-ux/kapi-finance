"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { PartyAestheticsTab } from "@/components/banquet-party/party-detail/PartyAestheticsTab";
import { PartyGuestsTab } from "@/components/banquet-party/party-detail/PartyGuestsTab";
import { PartyOverviewTab } from "@/components/banquet-party/party-detail/PartyOverviewTab";
import { PartyPrepTab } from "@/components/banquet-party/party-detail/PartyPrepTab";
import { PartyTabBar } from "@/components/banquet-party/party-detail/PartyTabBar";
import { PartyTimelineTab } from "@/components/banquet-party/party-detail/PartyTimelineTab";
import { ColorComposition } from "@/components/banquet-party/ColorCarousel";
import { MaterialFormDialog } from "@/components/banquet-party/MaterialFormDialog";
import { PartyForm } from "@/components/banquet-party/PartyForm";
import { Button } from "@/components/ui/button";
import { getPartyBudgetSummary } from "@/lib/banquet-party/budget";
import { getSoulCharacter } from "@/lib/banquet-party/characters";
import { computeWildnessIndex } from "@/lib/banquet-party/palette";
import { newMaterialId, upsertParty } from "@/lib/banquet-party/storage";
import type { Guest, Material, Party, PartyDetailTab, TimelineTask } from "@/lib/banquet-party/types";

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
  const [party, setParty] = useState(initial);
  const [tab, setTab] = useState<PartyDetailTab>("overview");
  const [showAdd, setShowAdd] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [showEditParty, setShowEditParty] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const character = getSoulCharacter(party.characterId);
  const wildness = useMemo(() => computeWildnessIndex(party.materials), [party.materials]);
  const budget = getPartyBudgetSummary(party);

  const persist = (next: Party) => {
    const updated = upsertParty(userId, next);
    setParty(updated.find((p) => p.id === next.id) ?? next);
    onPartyUpdated?.(updated);
  };

  const addMaterial = (mat: Omit<Material, "id">) => {
    persist({ ...party, materials: [...party.materials, { ...mat, id: newMaterialId() }] });
    setShowAdd(false);
  };

  const updateMaterial = (id: string, mat: Omit<Material, "id">) => {
    persist({
      ...party,
      materials: party.materials.map((m) => (m.id === id ? { ...mat, id } : m)),
    });
    setEditingMaterial(null);
  };

  const deleteMaterial = (id: string) => {
    if (!confirm(t("deleteMaterialConfirm"))) return;
    persist({ ...party, materials: party.materials.filter((m) => m.id !== id) });
  };

  const togglePurchased = (id: string) => {
    persist({
      ...party,
      materials: party.materials.map((m) => (m.id === id ? { ...m, isPurchased: !m.isPurchased } : m)),
    });
  };

  const toggleSetup = (id: string) => {
    persist({
      ...party,
      materials: party.materials.map((m) => (m.id === id ? { ...m, isSetup: !m.isSetup } : m)),
    });
  };

  const completeParty = () => {
    persist({ ...party, completedAt: new Date().toISOString() });
    setShowSummary(true);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t("backToList")}
        </button>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setShowEditParty(true)}>
          {t("editParty")}
        </Button>
      </div>

      {showEditParty ? (
        <PartyForm
          mode="edit"
          initial={party}
          onCancel={() => setShowEditParty(false)}
          onSave={(next) => {
            persist(next);
            setShowEditParty(false);
          }}
        />
      ) : (
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">{party.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {party.date} · {t("spendTotal", { amount: budget.totalPlanned.toFixed(2), purchased: budget.totalPurchased.toFixed(2) })}
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
          onAddMaterial={() => setShowAdd(true)}
          onTogglePurchased={togglePurchased}
          onToggleSetup={toggleSetup}
          onEditMaterial={setEditingMaterial}
          onDeleteMaterial={deleteMaterial}
        />
      ) : null}

      {tab === "guests" ? (
        <PartyGuestsTab party={party} onChange={(guests: Guest[]) => persist({ ...party, guests })} />
      ) : null}

      {tab === "timeline" ? (
        <PartyTimelineTab
          party={party}
          onChange={(timeline: TimelineTask[]) => persist({ ...party, timeline })}
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
