import type { Party } from "@/lib/banquet-party/types";
import { calculateColorPalette } from "@/lib/banquet-party/palette";
import { createDefaultTimeline } from "@/lib/banquet-party/timeline";

const STORAGE_KEY = "kapi-banquet-parties";

function storageKey(userId: string) {
  return `${STORAGE_KEY}:${userId}`;
}

export function loadParties(userId: string): Party[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Party[];
    return parsed.map(normalizeParty);
  } catch {
    return [];
  }
}

export function saveParties(userId: string, parties: Party[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(userId), JSON.stringify(parties));
}

export function refreshPartyPalette(party: Party): Party {
  const colorPalette = calculateColorPalette(party.materials);
  return { ...party, colorPalette };
}

export function normalizeParty(party: Party): Party {
  const base = refreshPartyPalette(party);
  return {
    ...base,
    guests: base.guests ?? [],
    timeline: base.timeline?.length ? base.timeline : createDefaultTimeline(newTimelineTaskId),
  };
}

export function upsertParty(userId: string, party: Party): Party[] {
  const parties = loadParties(userId);
  const next = normalizeParty(party);
  const idx = parties.findIndex((p) => p.id === next.id);
  const updated = idx >= 0 ? parties.map((p, i) => (i === idx ? next : p)) : [next, ...parties];
  saveParties(userId, updated);
  return updated;
}

export function deleteParty(userId: string, partyId: string): Party[] {
  const updated = loadParties(userId).filter((p) => p.id !== partyId);
  saveParties(userId, updated);
  return updated;
}

export function getParty(userId: string, partyId: string): Party | undefined {
  return loadParties(userId).find((p) => p.id === partyId);
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
