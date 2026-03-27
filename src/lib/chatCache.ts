/**
 * Direct localStorage cache for chat messages and selected contact.
 * Using raw localStorage instead of zustand persist because zustand v5
 * hydrates asynchronously — direct reads are guaranteed synchronous.
 *
 * Cache keys are scoped per user: aero-chat-{userId}:{contactId}
 * This prevents cross-user data bleed on shared devices.
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

function msgKey(userId: string, contactId: string) {
  return `aero-chat-${userId}:${contactId}`;
}

export function loadChatCache(userId: string, contactId: string): CachedMessage[] {
  try {
    const raw = localStorage.getItem(msgKey(userId, contactId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveChatCache(userId: string, contactId: string, messages: CachedMessage[]) {
  try {
    localStorage.setItem(
      msgKey(userId, contactId),
      JSON.stringify(messages.slice(-MAX_PER_CHAT)),
    );
  } catch {}
}

export function clearChatCache(userId: string, contactId: string) {
  try { localStorage.removeItem(msgKey(userId, contactId)); } catch {}
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

// ── Bulk operations ──────────────────────────────────────────────────────────

/** Remove all aero-chat- keys. Called on keypair rotation — old ciphertext is unreadable. */
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

/**
 * Remove old-format cache keys that lack a userId scope (no colon in key).
 * Called once on login. Keys of the form `aero-chat-{contactId}` (pre-scoping)
 * are unscoped and may contain another user's decrypted messages.
 */
export function pruneUnscopedCaches() {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('aero-chat-') && !k.includes(':')) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
}
