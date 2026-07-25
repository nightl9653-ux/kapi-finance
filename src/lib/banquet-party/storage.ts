import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { FoodFlavorTag, Material, MiscType, Party, PartyRow, TextureTag } from "@/lib/banquet-party/types";
import { calculateColorPalette } from "@/lib/banquet-party/palette";
import { sanitizeFoodFlavors } from "@/lib/banquet-party/flavors";
import { createDefaultTimeline } from "@/lib/banquet-party/timeline";
import { isKnownMiscType } from "@/lib/banquet-party/misc";
import { BASE_CURRENCY, coerceCurrency } from "@/lib/fx";

const TABLE = "banquet_parties";
const LOCAL_STORAGE_KEY = "kapi-banquet-parties";
const LOCAL_MIGRATED_KEY = "kapi-banquet-migrated";

function throwIfError(error: { message?: string; code?: string } | null) {
  if (!error) return;
  const err = new Error(error.message || "Database error");
  (err as Error & { code?: string }).code = error.code;
  throw err;
}

const LEGACY_TEXTURE_TO_MISC: Partial<Record<TextureTag, MiscType>> = {
  soft: "favor",
  natural: "logistics",
  metal: "venue",
  glossy: "media",
  transparent: "other",
};

function normalizeMaterial(material: Material): Material {
  let next: Material = { ...material };

  if (next.category === "food") {
    const flavors = sanitizeFoodFlavors(next.flavor as FoodFlavorTag | FoodFlavorTag[] | undefined);
    next = { ...next, flavor: flavors.length > 0 ? flavors : undefined };
  } else if (next.flavor) {
    const { flavor: _f, ...rest } = next;
    next = rest;
  }

  const { texture, ...withoutTexture } = next;
  next = withoutTexture;

  if (next.category !== "misc") {
    return next;
  }
  if (next.miscType && isKnownMiscType(next.miscType)) {
    return next;
  }
  if (texture && LEGACY_TEXTURE_TO_MISC[texture]) {
    return { ...next, miscType: LEGACY_TEXTURE_TO_MISC[texture] };
  }
  return next;
}

function localStorageKey(userId: string) {
  return `${LOCAL_STORAGE_KEY}:${userId}`;
}

function migratedKey(userId: string) {
  return `${LOCAL_MIGRATED_KEY}:${userId}`;
}

function loadLocalParties(userId: string): Party[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(localStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Party[];
    return parsed.map(normalizeParty);
  } catch {
    return [];
  }
}

function parseNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function refreshPartyPalette(party: Party): Party {
  const colorPalette = calculateColorPalette(party.materials);
  return { ...party, colorPalette };
}

export function normalizeParty(party: Party): Party {
  const materials = party.materials.map(normalizeMaterial);
  const base = refreshPartyPalette({ ...party, materials });
  const budgetCap = parseNumber(base.budgetCap);
  return {
    ...base,
    currency: coerceCurrency(base.currency ?? BASE_CURRENCY),
    budgetCap: budgetCap != null && budgetCap > 0 ? budgetCap : undefined,
    guests: base.guests ?? [],
    timeline: base.timeline?.length ? base.timeline : createDefaultTimeline(newTimelineTaskId),
  };
}

export function normalizePartyFromRow(row: PartyRow): Party {
  const materials = Array.isArray(row.materials) ? row.materials.map(normalizeMaterial) : [];
  const guests = Array.isArray(row.guests) ? row.guests : [];
  const timeline = Array.isArray(row.timeline) ? row.timeline : [];
  return normalizeParty({
    id: row.id,
    name: row.name,
    date: row.party_date,
    characterId: row.character_id,
    partyTypeId: row.party_type_id ?? undefined,
    currency: coerceCurrency(row.currency),
    budgetCap: parseNumber(row.budget_cap),
    materials,
    colorPalette: { primary: null, secondaries: [], accents: [], distribution: [] },
    guests,
    timeline,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  });
}

function partyToInsert(party: Party, userId: string) {
  const next = normalizeParty(party);
  return {
    user_id: userId,
    name: next.name,
    party_date: next.date,
    character_id: next.characterId,
    party_type_id: next.partyTypeId ?? null,
    currency: coerceCurrency(next.currency),
    budget_cap: next.budgetCap ?? null,
    materials: next.materials,
    color_palette: next.colorPalette,
    guests: next.guests ?? [],
    timeline: next.timeline ?? [],
    completed_at: next.completedAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

function partyToUpdate(party: Party) {
  const next = normalizeParty(party);
  return {
    name: next.name,
    party_date: next.date,
    character_id: next.characterId,
    party_type_id: next.partyTypeId ?? null,
    currency: coerceCurrency(next.currency),
    budget_cap: next.budgetCap ?? null,
    materials: next.materials,
    color_palette: next.colorPalette,
    guests: next.guests ?? [],
    timeline: next.timeline ?? [],
    completed_at: next.completedAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

async function migrateLocalPartiesIfNeeded(userId: string, cloudEmpty: boolean): Promise<void> {
  if (!cloudEmpty || typeof window === "undefined") return;
  if (localStorage.getItem(migratedKey(userId))) return;

  const local = loadLocalParties(userId);
  if (local.length === 0) {
    localStorage.setItem(migratedKey(userId), "1");
    return;
  }

  const supabase = createSupabaseBrowserClient();
  const rows = local.map((p) => partyToInsert(p, userId));
  const { error } = await supabase.from(TABLE).insert(rows);
  throwIfError(error);

  localStorage.setItem(migratedKey(userId), "1");
  localStorage.removeItem(localStorageKey(userId));
}

export async function loadParties(userId: string): Promise<Party[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  throwIfError(error);

  const rows = (data as PartyRow[]) ?? [];
  if (rows.length === 0) {
    await migrateLocalPartiesIfNeeded(userId, true);
    const { data: after, error: afterErr } = await supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    throwIfError(afterErr);
    return ((after as PartyRow[]) ?? []).map(normalizePartyFromRow);
  }

  if (typeof window !== "undefined" && !localStorage.getItem(migratedKey(userId))) {
    localStorage.setItem(migratedKey(userId), "1");
  }

  return rows.map(normalizePartyFromRow);
}

export async function upsertParty(userId: string, party: Party): Promise<Party[]> {
  const supabase = createSupabaseBrowserClient();
  const isNew = party.id.startsWith("party_");

  if (isNew) {
    const { error } = await supabase.from(TABLE).insert(partyToInsert(party, userId));
    throwIfError(error);
    return loadParties(userId);
  }

  const { error } = await supabase.from(TABLE).update(partyToUpdate(party)).eq("id", party.id).eq("user_id", userId);
  throwIfError(error);
  return loadParties(userId);
}

export async function deleteParty(userId: string, partyId: string): Promise<Party[]> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", partyId).eq("user_id", userId);
  throwIfError(error);
  return loadParties(userId);
}

export function newPartyId(): string {
  return `party_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function newMaterialId(): string {
  return `mat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function newGuestId(): string {
  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function newTimelineTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
