import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { coerceCurrency } from "@/lib/fx";
import { TRAVEL_ITEM_CATEGORIES, type TravelItem, type TravelTrip, type TravelTripRow } from "@/lib/travel/types";
import { newTravelId } from "@/lib/travel/types";

const TABLE = "travel_trips";

function throwIfError(error: { message?: string; code?: string } | null): asserts error is null {
  if (!error) return;
  const err = new Error(error.message || "Database error");
  (err as Error & { code?: string }).code = error.code;
  throw err;
}

function parseNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeItem(raw: Partial<TravelItem>): TravelItem {
  const category = TRAVEL_ITEM_CATEGORIES.includes(raw.category as TravelItem["category"])
    ? (raw.category as TravelItem["category"])
    : "other";
  const transactionId =
    typeof raw.transactionId === "string" && raw.transactionId.trim() ? raw.transactionId.trim() : undefined;
  return {
    id: raw.id || newTravelId(),
    name: String(raw.name ?? "").trim() || "—",
    category,
    amount: Math.max(0, Number(raw.amount) || 0),
    quantity: Math.max(0, Number(raw.quantity) || 1),
    note: raw.note?.trim() || undefined,
    transactionId,
  };
}

export function normalizeTrip(row: TravelTripRow): TravelTrip {
  const items = Array.isArray(row.items) ? row.items.map((i) => normalizeItem(i)) : [];
  return {
    id: row.id,
    name: row.name,
    destination: row.destination?.trim() || undefined,
    currency: coerceCurrency(row.currency),
    budgetCap: parseNumber(row.budget_cap),
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    notes: row.notes?.trim() || undefined,
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  };
}

function tripToInsert(trip: TravelTrip, userId: string) {
  return {
    user_id: userId,
    name: trip.name.trim(),
    destination: trip.destination?.trim() || null,
    currency: coerceCurrency(trip.currency),
    budget_cap: trip.budgetCap ?? null,
    start_date: trip.startDate || null,
    end_date: trip.endDate || null,
    notes: trip.notes?.trim() || null,
    items: trip.items.map((i) => normalizeItem(i)),
    completed_at: trip.completedAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

function tripToUpdate(trip: TravelTrip) {
  return {
    name: trip.name.trim(),
    destination: trip.destination?.trim() || null,
    currency: coerceCurrency(trip.currency),
    budget_cap: trip.budgetCap ?? null,
    start_date: trip.startDate || null,
    end_date: trip.endDate || null,
    notes: trip.notes?.trim() || null,
    items: trip.items.map((i) => normalizeItem(i)),
    completed_at: trip.completedAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function loadTrips(userId: string): Promise<TravelTrip[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  throwIfError(error);
  return ((data as TravelTripRow[]) ?? []).map(normalizeTrip);
}

export async function upsertTrip(userId: string, trip: TravelTrip): Promise<TravelTrip[]> {
  const supabase = createSupabaseBrowserClient();
  const id = trip.id || newTravelId();

  const { data: found } = await supabase
    .from(TABLE)
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (found) {
    const { error } = await supabase.from(TABLE).update(tripToUpdate({ ...trip, id })).eq("id", id).eq("user_id", userId);
    throwIfError(error);
  } else {
    const { error } = await supabase.from(TABLE).insert({ id, ...tripToInsert({ ...trip, id }, userId) });
    throwIfError(error);
  }
  return loadTrips(userId);
}

export async function deleteTrip(userId: string, tripId: string): Promise<TravelTrip[]> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", tripId).eq("user_id", userId);
  throwIfError(error);
  return loadTrips(userId);
}
