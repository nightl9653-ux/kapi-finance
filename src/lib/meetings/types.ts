export type ContactAdviceItem = {
  id: string;
  /** Snapshot text (preset resolved or custom) */
  text: string;
  source: "preset" | "custom";
  presetKey?: string;
  createdAt: string;
};

export type Contact = {
  id: string;
  name: string;
  alias?: string;
  relation?: string;
  phone?: string;
  email?: string;
  notes?: string;
  adviceItems?: ContactAdviceItem[];
  createdAt: string;
  updatedAt: string;
};

export type Meeting = {
  id: string;
  contactId: string;
  metOn: string;
  occasion?: string;
  /** −10 … 10 */
  score: number;
  feeling?: string;
  createdAt: string;
  updatedAt: string;
};

export type MeetingsStore = {
  contacts: Contact[];
  meetings: Meeting[];
};

export const MEETING_SCORE_MIN = -10;
export const MEETING_SCORE_MAX = 10;

export function clampMeetingScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MEETING_SCORE_MAX, Math.max(MEETING_SCORE_MIN, Math.round(n)));
}

export function newEntityId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
