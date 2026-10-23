"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { TripForm } from "@/components/travel/TripForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BASE_CURRENCY, coerceCurrency, formatProjectMoney } from "@/lib/fx";
import { getTripBudgetSummary, itemLineTotal } from "@/lib/travel/budget";
import { loadTripLinkedSpend, logTravelItemExpense } from "@/lib/travel/log-expense";
import { upsertTrip } from "@/lib/travel/storage";
import {
  TRAVEL_ITEM_CATEGORIES,
  newTravelId,
  type TravelItem,
  type TravelItemCategory,
  type TravelTrip,
} from "@/lib/travel/types";
import { cn } from "@/lib/utils";

function categoryLabel(t: (key: string) => string, cat: TravelItemCategory): string {
  return t(`itemCategory.${cat}`);
}

export function TripDetailClient({
  trip,
  userId,
  onBack,
  onTripUpdated,
}: {
  trip: TravelTrip;
  userId: string;
  onBack: () => void;
  onTripUpdated: (trips: TravelTrip[]) => void;
}) {
  const t = useTranslations("travel");
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState<TravelItemCategory>("transport");
  const [itemAmount, setItemAmount] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemNote, setItemNote] = useState("");
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkedSpend, setLinkedSpend] = useState(0);
  const [pending, startTransition] = useTransition();

  const currency = coerceCurrency(trip.currency ?? BASE_CURRENCY);
  const budget = useMemo(() => getTripBudgetSummary(trip), [trip]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const n = await loadTripLinkedSpend(trip.id);
      if (!cancelled) setLinkedSpend(n);
    })();
    return () => {
      cancelled = true;
    };
  }, [trip.id, trip.items]);

  const persist = async (next: TravelTrip) => {
    const list = await upsertTrip(userId, next);
    onTripUpdated(list);
  };

  const clearItemDraft = () => {
    setEditingItemId(null);
    setItemName("");
    setItemCategory("transport");
    setItemAmount("");
    setItemQty("1");
    setItemNote("");
    setAdding(false);
  };

  const openAdd = () => {
    setEditingItemId(null);
    setItemName("");
    setItemCategory("transport");
    setItemAmount("");
    setItemQty("1");
    setItemNote("");
    setError(null);
    setAdding(true);
  };

  const beginEdit = (item: TravelItem) => {
    if (item.transactionId) return;
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemCategory(item.category);
    setItemAmount(String(item.amount));
    setItemQty(String(item.quantity));
    setItemNote(item.note ?? "");
    setError(null);
    setAdding(true);
  };

  const saveItem = () => {
    const amount = Number(itemAmount);
    const quantity = Number(itemQty);
    if (!itemName.trim() || !Number.isFinite(amount) || amount < 0) {
      setError(t("invalidItem"));
      return;
    }
    const quantitySafe = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const note = itemNote.trim() || undefined;
    startTransition(async () => {
      setError(null);
      const items = editingItemId
        ? trip.items.map((row) =>
            row.id === editingItemId
              ? { ...row, name: itemName.trim(), category: itemCategory, amount, quantity: quantitySafe, note }
              : row,
          )
        : [
            ...trip.items,
            {
              id: newTravelId(),
              name: itemName.trim(),
              category: itemCategory,
              amount,
              quantity: quantitySafe,
              note,
            },
          ];
      await persist({ ...trip, items, updatedAt: new Date().toISOString() });
      clearItemDraft();
    });
  };

  const removeItem = (id: string) => {
    if (!window.confirm(t("deleteItemConfirm"))) return;
    startTransition(async () => {
      await persist({
        ...trip,
        items: trip.items.filter((i) => i.id !== id),
        updatedAt: new Date().toISOString(),
      });
    });
  };

  const logItem = (item: TravelItem) => {
    if (item.transactionId || loggingId) return;
    const line = itemLineTotal(item);
    if (line <= 0) {
      setError(t("invalidItem"));
      return;
    }
    setLoggingId(item.id);
    setError(null);
    void (async () => {
      const result = await logTravelItemExpense({
        tripId: trip.id,
        tripName: trip.name,
        itemName: item.name,
        amount: line,
        currency,
        category: item.category,
        occurredOn: trip.startDate,
        locale,
      });
      setLoggingId(null);
      if (!result.ok) {
        setError(
          result.error === "schema_missing"
            ? t("schemaMissing")
            : result.error === "fx_failed"
              ? t("fxError")
              : t("logExpenseError"),
        );
        return;
      }
      await persist({
        ...trip,
        items: trip.items.map((row) =>
          row.id === item.id ? { ...row, transactionId: result.transactionId } : row,
        ),
        updatedAt: new Date().toISOString(),
      });
      setLinkedSpend(await loadTripLinkedSpend(trip.id));
    })();
  };

  if (editing) {
    return (
      <TripForm
        mode="edit"
        initial={trip}
        onCancel={() => setEditing(false)}
        onSave={async (next) => {
          await persist(next);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={onBack}
          >
            ← {t("backToList")}
          </button>
          <h1 className="mt-2 font-serif text-2xl font-semibold tracking-tight">{trip.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[trip.destination, trip.startDate && trip.endDate ? `${trip.startDate} → ${trip.endDate}` : trip.startDate]
              .filter(Boolean)
              .join(" · ") || t("noDates")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => setEditing(true)}>
            {t("editTrip")}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white/60 p-4">
          <p className="text-xs text-muted-foreground">{t("plannedTotal")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatProjectMoney(budget.plannedTotal, currency)}
          </p>
          {budget.budgetCap != null ? (
            <p
              className={cn(
                "mt-1 text-xs",
                budget.overCap ? "text-rose-700" : "text-muted-foreground",
              )}
            >
              {budget.overCap
                ? t("overCap")
                : t("budgetRemaining", { amount: formatProjectMoney(budget.remaining ?? 0, currency) })}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border bg-white/60 p-4">
          <p className="text-xs text-muted-foreground">{t("loggedTotal")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-800">
            {formatProjectMoney(budget.loggedTotal, currency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("overviewLinkedSpend", { amount: formatProjectMoney(linkedSpend, currency) })}
          </p>
        </div>
        <div className="rounded-2xl border bg-white/60 p-4">
          <p className="text-xs text-muted-foreground">{t("pendingTotal")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatProjectMoney(budget.pendingTotal, currency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("pendingCount", { n: budget.pendingCount })}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{t("prepWorkflowHint")}</p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-medium">{t("itemsTitle")}</h2>
        <Button type="button" className="rounded-full" onClick={() => (adding ? clearItemDraft() : openAdd())}>
          {adding ? t("cancel") : t("addItem")}
        </Button>
      </div>

      {adding ? (
        <div className="space-y-3 rounded-2xl border bg-white/70 p-4">
          {editingItemId ? <p className="text-sm font-medium">{t("editItemTitle")}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="travel-item-name">{t("itemName")}</Label>
              <Input
                id="travel-item-name"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder={t("itemNamePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="travel-item-cat">{t("itemCategoryLabel")}</Label>
              <select
                id="travel-item-cat"
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                value={itemCategory}
                onChange={(e) => setItemCategory(e.target.value as TravelItemCategory)}
              >
                {TRAVEL_ITEM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(t, c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="travel-item-amount">{t("itemAmount")}</Label>
              <Input
                id="travel-item-amount"
                type="number"
                min="0"
                step="0.01"
                value={itemAmount}
                onChange={(e) => setItemAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="travel-item-qty">{t("itemQuantity")}</Label>
              <Input
                id="travel-item-qty"
                type="number"
                min="0"
                step="1"
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="travel-item-note">{t("itemNote")}</Label>
              <Input id="travel-item-note" value={itemNote} onChange={(e) => setItemNote(e.target.value)} />
            </div>
          </div>
          <Button type="button" className="rounded-full" disabled={pending} onClick={saveItem}>
            {t("saveItem")}
          </Button>
        </div>
      ) : null}

      {trip.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("emptyItems")}</p>
      ) : (
        <ul className="space-y-2">
          {trip.items.map((item) => {
            const line = itemLineTotal(item);
            const logged = Boolean(item.transactionId);
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border bg-white/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.name}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {categoryLabel(t, item.category)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm tabular-nums">
                    {formatProjectMoney(line, currency)}
                    <span className="text-muted-foreground">
                      {" "}
                      ({item.quantity} × {formatProjectMoney(item.amount, currency)})
                    </span>
                    <span className={cn("ml-2 text-xs", logged ? "text-emerald-700" : "text-amber-700")}>
                      {logged ? t("loggedToTransactions") : t("pending")}
                    </span>
                  </p>
                  {item.note ? <p className="mt-1 text-xs text-muted-foreground">{item.note}</p> : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  {!logged ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      disabled={pending}
                      onClick={() => beginEdit(item)}
                    >
                      {t("editItem")}
                    </Button>
                  ) : null}
                  {!logged ? (
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-full"
                      disabled={loggingId === item.id}
                      onClick={() => logItem(item)}
                    >
                      {loggingId === item.id ? t("logExpenseLogging") : t("logExpense")}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-destructive"
                    disabled={pending || Boolean(item.transactionId)}
                    onClick={() => removeItem(item.id)}
                  >
                    {t("delete")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
