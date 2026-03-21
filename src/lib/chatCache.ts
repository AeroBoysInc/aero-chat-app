/**
 * Direct localStorage cache for chat messages and selected contact.
 * Using raw localStorage instead of zustand persist because zustand v5
 * hydrates asynchronously — direct reads are guaranteed synchronous.
 */

const MAX_PER_CHAT = 300;
const CONTACT_KEY  = 'aero-selected-contact-id';

export interface CachedMessage {
  id: string;
  sender_id: string;
  content: string;       // decrypted plaintext
  created_at: string;
  read_at?: string | null;
}

// ── Selected contact ────────────────────────────────────────────────────────

export function saveSelectedContactId(id: string | null) {
  try {
    if (id) localStorage.setItem(CONTACT_KEY, id);
    else    localStorage.removeItem(CONTACT_KEY);
  } catch {}
}

export function loadSelectedContactId(): string | null {
  try { return localStorage.getItem(CONTACT_KEY); } catch { return null; }
}

// ── Message cache ────────────────────────────────────────────────────────────

function msgKey(contactId: string) { return `aero-chat-${contactId}`; }

export function loadChatCache(contactId: string): CachedMessage[] {
  try {
    const raw = localStorage.getItem(msgKey(contactId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveChatCache(contactId: string, messages: CachedMessage[]) {
  try {
    localStorage.setItem(
      msgKey(contactId),
      JSON.stringify(messages.slice(-MAX_PER_CHAT)),
    );
  } catch {}
}

export function clearChatCache(contactId: string) {
  try { localStorage.removeItem(msgKey(contactId)); } catch {}
}

// ── Per-user clear timestamps ────────────────────────────────────────────────
// Stores the ISO timestamp of when a user last cleared a specific chat.
// History loads filter out messages older than this timestamp so cleared
// messages never reappear on refresh — without touching the other user's data.

function clearTsKey(userId: string, contactId: string) {
  return `aero-clear-${userId}-${contactId}`;
}

export function saveClearTimestamp(userId: string, contactId: string) {
  try { localStorage.setItem(clearTsKey(userId, contactId), new Date().toISOString()); } catch {}
}

export function loadClearTimestamp(userId: string, contactId: string): string | null {
  try { return localStorage.getItem(clearTsKey(userId, contactId)); } catch { return null; }
}

export function clearAllChatCaches() {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('aero-chat-')) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
}
