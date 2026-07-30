import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  clampMeetingScore,
  newEntityId,
  type Contact,
  type ContactAdviceItem,
  type Meeting,
  type MeetingsStore,
} from "@/lib/meetings/types";

const CONTACTS_TABLE = "social_contacts";
const MEETINGS_TABLE = "social_meetings";
const LOCAL_STORAGE_KEY = "kapi-meetings";
const LOCAL_MIGRATED_KEY = "kapi-meetings-migrated";

type ContactRow = {
  id: string;
  user_id: string;
  name: string;
  alias: string | null;
  relation: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  advice_items: unknown;
  created_at: string;
  updated_at: string;
};

type MeetingRow = {
  id: string;
  user_id: string;
  contact_id: string;
  met_on: string;
  occasion: string | null;
  score: number;
  feeling: string | null;
  created_at: string;
  updated_at: string;
};

function throwIfError(error: { message?: string; code?: string } | null) {
  if (!error) return;
  const err = new Error(error.message || "Database error");
  (err as Error & { code?: string }).code = error.code;
  throw err;
}

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function ensureUuid(id: string): string {
  return isUuid(id) ? id : newEntityId();
}

function localStorageKey(userId: string) {
  return `${LOCAL_STORAGE_KEY}:${userId}`;
}

function migratedKey(userId: string) {
  return `${LOCAL_MIGRATED_KEY}:${userId}`;
}

function emptyStore(): MeetingsStore {
  return { contacts: [], meetings: [] };
}

function normalizeAdviceItem(raw: Partial<ContactAdviceItem>): ContactAdviceItem | null {
  const id = String(raw.id ?? "").trim();
  const text = String(raw.text ?? "").trim();
  if (!id || !text) return null;
  const source = raw.source === "custom" ? "custom" : "preset";
  return {
    id: ensureUuid(id),
    text,
    source,
    presetKey: raw.presetKey?.trim() || undefined,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function normalizeAdviceList(raw: unknown): ContactAdviceItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => normalizeAdviceItem(a as ContactAdviceItem))
    .filter((a): a is ContactAdviceItem => !!a);
}

function contactFromRow(row: ContactRow): Contact {
  const adviceItems = normalizeAdviceList(row.advice_items);
  return {
    id: row.id,
    name: row.name,
    alias: row.alias?.trim() || undefined,
    relation: row.relation?.trim() || undefined,
    phone: row.phone?.trim() || undefined,
    email: row.email?.trim() || undefined,
    notes: row.notes?.trim() || undefined,
    adviceItems: adviceItems.length > 0 ? adviceItems : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function meetingFromRow(row: MeetingRow): Meeting {
  return {
    id: row.id,
    contactId: row.contact_id,
    metOn: row.met_on,
    occasion: row.occasion?.trim() || undefined,
    score: clampMeetingScore(Number(row.score)),
    feeling: row.feeling?.trim() || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeContactLocal(raw: Partial<Contact> & { id?: string; name?: string }): Contact | null {
  const id = String(raw.id ?? "").trim();
  const name = String(raw.name ?? "").trim();
  if (!id || !name) return null;
  const now = new Date().toISOString();
  const adviceItems = normalizeAdviceList(raw.adviceItems);
  return {
    id,
    name,
    alias: raw.alias?.trim() || undefined,
    relation: raw.relation?.trim() || undefined,
    phone: raw.phone?.trim() || undefined,
    email: raw.email?.trim() || undefined,
    notes: raw.notes?.trim() || undefined,
    adviceItems: adviceItems.length > 0 ? adviceItems : undefined,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  };
}

function normalizeMeetingLocal(
  raw: Partial<Meeting> & { id?: string; contactId?: string },
): Meeting | null {
  const id = String(raw.id ?? "").trim();
  const contactId = String(raw.contactId ?? "").trim();
  const metOn = String(raw.metOn ?? "").trim();
  if (!id || !contactId || !/^\d{4}-\d{2}-\d{2}$/.test(metOn)) return null;
  const now = new Date().toISOString();
  return {
    id,
    contactId,
    metOn,
    occasion: raw.occasion?.trim() || undefined,
    score: clampMeetingScore(Number(raw.score)),
    feeling: raw.feeling?.trim() || undefined,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  };
}

function loadLocalStore(userId: string): MeetingsStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(localStorageKey(userId));
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as { contacts?: unknown; meetings?: unknown };
    const contacts = Array.isArray(parsed.contacts)
      ? parsed.contacts.map((c) => normalizeContactLocal(c as Contact)).filter((c): c is Contact => !!c)
      : [];
    const contactIds = new Set(contacts.map((c) => c.id));
    const meetings = Array.isArray(parsed.meetings)
      ? parsed.meetings
          .map((m) => normalizeMeetingLocal(m as Meeting))
          .filter((m): m is Meeting => !!m && contactIds.has(m.contactId))
      : [];
    return { contacts, meetings };
  } catch {
    return emptyStore();
  }
}

function contactToRow(contact: Contact, userId: string) {
  const now = new Date().toISOString();
  return {
    id: ensureUuid(contact.id),
    user_id: userId,
    name: contact.name.trim(),
    alias: contact.alias?.trim() || null,
    relation: contact.relation?.trim() || null,
    phone: contact.phone?.trim() || null,
    email: contact.email?.trim() || null,
    notes: contact.notes?.trim() || null,
    advice_items: normalizeAdviceList(contact.adviceItems),
    created_at: contact.createdAt || now,
    updated_at: now,
  };
}

function meetingToRow(meeting: Meeting, userId: string, contactId: string) {
  const now = new Date().toISOString();
  return {
    id: ensureUuid(meeting.id),
    user_id: userId,
    contact_id: contactId,
    met_on: meeting.metOn,
    occasion: meeting.occasion?.trim() || null,
    score: clampMeetingScore(meeting.score),
    feeling: meeting.feeling?.trim() || null,
    created_at: meeting.createdAt || now,
    updated_at: now,
  };
}

async function fetchStore(userId: string): Promise<MeetingsStore> {
  const supabase = createSupabaseBrowserClient();
  const [contactsRes, meetingsRes] = await Promise.all([
    supabase.from(CONTACTS_TABLE).select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
    supabase.from(MEETINGS_TABLE).select("*").eq("user_id", userId).order("met_on", { ascending: false }),
  ]);
  throwIfError(contactsRes.error);
  throwIfError(meetingsRes.error);

  const contacts = ((contactsRes.data as ContactRow[]) ?? []).map(contactFromRow);
  const contactIds = new Set(contacts.map((c) => c.id));
  const meetings = ((meetingsRes.data as MeetingRow[]) ?? [])
    .map(meetingFromRow)
    .filter((m) => contactIds.has(m.contactId));

  return { contacts, meetings };
}

async function migrateLocalIfNeeded(userId: string, cloudEmpty: boolean): Promise<void> {
  if (!cloudEmpty || typeof window === "undefined") return;
  if (localStorage.getItem(migratedKey(userId))) return;

  const local = loadLocalStore(userId);
  if (local.contacts.length === 0 && local.meetings.length === 0) {
    localStorage.setItem(migratedKey(userId), "1");
    return;
  }

  const supabase = createSupabaseBrowserClient();
  const idMap = new Map<string, string>();

  const contactRows = local.contacts.map((c) => {
    const newId = ensureUuid(c.id);
    idMap.set(c.id, newId);
    return contactToRow({ ...c, id: newId }, userId);
  });

  if (contactRows.length > 0) {
    const { error } = await supabase.from(CONTACTS_TABLE).insert(contactRows);
    throwIfError(error);
  }

  const meetingRows = local.meetings
    .map((m) => {
      const contactId = idMap.get(m.contactId);
      if (!contactId) return null;
      return meetingToRow({ ...m, id: ensureUuid(m.id), contactId }, userId, contactId);
    })
    .filter((r): r is NonNullable<typeof r> => !!r);

  if (meetingRows.length > 0) {
    const { error } = await supabase.from(MEETINGS_TABLE).insert(meetingRows);
    throwIfError(error);
  }

  localStorage.setItem(migratedKey(userId), "1");
  localStorage.removeItem(localStorageKey(userId));
}

export async function loadMeetingsStore(userId: string): Promise<MeetingsStore> {
  const store = await fetchStore(userId);
  if (store.contacts.length === 0 && store.meetings.length === 0) {
    await migrateLocalIfNeeded(userId, true);
    return fetchStore(userId);
  }
  if (typeof window !== "undefined" && !localStorage.getItem(migratedKey(userId))) {
    localStorage.setItem(migratedKey(userId), "1");
  }
  return store;
}

export async function upsertContact(userId: string, contact: Contact): Promise<MeetingsStore> {
  const supabase = createSupabaseBrowserClient();
  const row = contactToRow(contact, userId);
  const exists = isUuid(contact.id);

  if (exists) {
    const { data: found } = await supabase
      .from(CONTACTS_TABLE)
      .select("id")
      .eq("id", contact.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (found) {
      const { error } = await supabase
        .from(CONTACTS_TABLE)
        .update({
          name: row.name,
          alias: row.alias,
          relation: row.relation,
          phone: row.phone,
          email: row.email,
          notes: row.notes,
          advice_items: row.advice_items,
          updated_at: row.updated_at,
        })
        .eq("id", contact.id)
        .eq("user_id", userId);
      throwIfError(error);
      return fetchStore(userId);
    }
  }

  const { error } = await supabase.from(CONTACTS_TABLE).insert(row);
  throwIfError(error);
  return fetchStore(userId);
}

export async function deleteContact(userId: string, contactId: string): Promise<MeetingsStore> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from(CONTACTS_TABLE)
    .delete()
    .eq("id", contactId)
    .eq("user_id", userId);
  throwIfError(error);
  return fetchStore(userId);
}

export async function upsertMeeting(userId: string, meeting: Meeting): Promise<MeetingsStore> {
  const supabase = createSupabaseBrowserClient();
  const contactId = ensureUuid(meeting.contactId);
  const row = meetingToRow({ ...meeting, contactId }, userId, contactId);

  const { data: contact } = await supabase
    .from(CONTACTS_TABLE)
    .select("id")
    .eq("id", contactId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!contact) throw new Error("contact_not_found");

  if (isUuid(meeting.id)) {
    const { data: found } = await supabase
      .from(MEETINGS_TABLE)
      .select("id")
      .eq("id", meeting.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (found) {
      const { error } = await supabase
        .from(MEETINGS_TABLE)
        .update({
          contact_id: row.contact_id,
          met_on: row.met_on,
          occasion: row.occasion,
          score: row.score,
          feeling: row.feeling,
          updated_at: row.updated_at,
        })
        .eq("id", meeting.id)
        .eq("user_id", userId);
      throwIfError(error);
      return fetchStore(userId);
    }
  }

  const { error } = await supabase.from(MEETINGS_TABLE).insert(row);
  throwIfError(error);
  return fetchStore(userId);
}

export async function deleteMeeting(userId: string, meetingId: string): Promise<MeetingsStore> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from(MEETINGS_TABLE)
    .delete()
    .eq("id", meetingId)
    .eq("user_id", userId);
  throwIfError(error);
  return fetchStore(userId);
}
