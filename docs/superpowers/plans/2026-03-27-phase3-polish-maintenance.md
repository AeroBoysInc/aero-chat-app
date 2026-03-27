# Phase 3 — Polish & Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope localStorage message cache keys per user ID to prevent cross-user data bleed on shared devices, and remove two redundant ChatWindow depth orbs to cut GPU compositor layers from 5 to 3.

**Architecture:** Two independent changes — `chatCache.ts` key format update with callers updated in `ChatWindow.tsx` and `App.tsx`; and a pure deletion of the depth orb block in `ChatWindow.tsx`. No new dependencies. Vitest tests cover the cache key logic.

**Tech Stack:** TypeScript, React, localStorage API, Vitest

---

## File Map

| File | Change |
|---|---|
| `src/lib/chatCache.ts` | Add `userId` param to `msgKey`, `loadChatCache`, `saveChatCache`, `clearChatCache`; add `pruneUnscopedCaches()` |
| `src/lib/chatCache.test.ts` | New — Vitest tests for scoped key format and prune logic |
| `src/components/chat/ChatWindow.tsx` | Pass `user!.id` to all cache call sites; delete depth orb block |
| `src/App.tsx` | Import and call `pruneUnscopedCaches()` in `resolveSession` |
| `docs/performance-roadmap.html` | Mark Phase 3 done, update stats |

---

## Task 1: Scope localStorage Cache Keys Per User ID

**Files:**
- Modify: `src/lib/chatCache.ts`
- Create: `src/lib/chatCache.test.ts`
- Modify: `src/components/chat/ChatWindow.tsx`
- Modify: `src/App.tsx`

---

- [ ] **Step 1: Write failing tests**

Create `src/lib/chatCache.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadChatCache,
  saveChatCache,
  clearChatCache,
  pruneUnscopedCaches,
  type CachedMessage,
} from './chatCache';

const USER_A = 'user-aaa';
const USER_B = 'user-bbb';
const CONTACT = 'contact-111';

const msg = (id: string): CachedMessage => ({
  id,
  sender_id: USER_A,
  content: 'hello',
  created_at: new Date().toISOString(),
});

beforeEach(() => localStorage.clear());

describe('scoped cache keys', () => {
  it('saves and loads under userId:contactId key', () => {
    saveChatCache(USER_A, CONTACT, [msg('m1')]);
    const result = loadChatCache(USER_A, CONTACT);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m1');
  });

  it('user B cannot read user A cache', () => {
    saveChatCache(USER_A, CONTACT, [msg('m1')]);
    const result = loadChatCache(USER_B, CONTACT);
    expect(result).toHaveLength(0);
  });

  it('clearChatCache removes only the scoped key', () => {
    saveChatCache(USER_A, CONTACT, [msg('m1')]);
    saveChatCache(USER_B, CONTACT, [msg('m2')]);
    clearChatCache(USER_A, CONTACT);
    expect(loadChatCache(USER_A, CONTACT)).toHaveLength(0);
    expect(loadChatCache(USER_B, CONTACT)).toHaveLength(1);
  });

  it('stores key in aero-chat-{userId}:{contactId} format', () => {
    saveChatCache(USER_A, CONTACT, [msg('m1')]);
    expect(localStorage.getItem(`aero-chat-${USER_A}:${CONTACT}`)).not.toBeNull();
  });
});

describe('pruneUnscopedCaches', () => {
  it('removes old-format keys (no colon)', () => {
    localStorage.setItem('aero-chat-contact-111', JSON.stringify([msg('old')]));
    pruneUnscopedCaches();
    expect(localStorage.getItem('aero-chat-contact-111')).toBeNull();
  });

  it('leaves new scoped keys intact', () => {
    saveChatCache(USER_A, CONTACT, [msg('m1')]);
    pruneUnscopedCaches();
    expect(loadChatCache(USER_A, CONTACT)).toHaveLength(1);
  });

  it('leaves unrelated keys intact', () => {
    localStorage.setItem('aero-clear-user-aaa-contact-111', new Date().toISOString());
    pruneUnscopedCaches();
    expect(localStorage.getItem('aero-clear-user-aaa-contact-111')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd aero-chat-app && pnpm test --run src/lib/chatCache.test.ts
```

Expected: failures like `pruneUnscopedCaches is not a function` and signature mismatches.

- [ ] **Step 3: Update `src/lib/chatCache.ts`**

Replace the entire file with:

```typescript
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
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd aero-chat-app && pnpm test --run src/lib/chatCache.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Update `src/App.tsx`**

Add `pruneUnscopedCaches` to the chatCache import at line 14:

```typescript
import { clearAllChatCaches, pruneUnscopedCaches } from './lib/chatCache';
```

Then in `resolveSession`, add the call after `setUser(profile)` (after line 134):

```typescript
      const { encrypted_private_key: _epk, ...profile } = row;
      setUser(profile);
      pruneUnscopedCaches();   // ← add this line
      settled = true;
```

- [ ] **Step 6: Update all cache call sites in `src/components/chat/ChatWindow.tsx`**

`user` is already in scope as `const { user } = useAuthStore()` at the top of `ChatWindow`. Add `user!.id` as the first argument to every cache call. There are 9 call sites:

**Line ~397** — initial state:
```typescript
const [messages, setMessages] = useState<Message[]>(() => loadChatCache(user!.id, contact.id));
```

**Line ~454** — contact change effect:
```typescript
setMessages(loadChatCache(user!.id, contact.id));
```

**Line ~491** — history load (cachedMap):
```typescript
const cachedMap = new Map(loadChatCache(user!.id, contact.id).map(m => [m.id, m.content]));
```

**Line ~507** — save after history load:
```typescript
saveChatCache(user!.id, contact.id, allWithPending);
```

**Line ~609** — save on incoming message:
```typescript
saveChatCache(user!.id, contact.id, next);
```

**Line ~630** — save on read receipt update:
```typescript
saveChatCache(user!.id, contact.id, next);
```

**Line ~741** — save on text message sent:
```typescript
setMessages(prev => { const next = [...prev, sent]; saveChatCache(user!.id, contact.id, next); return next; });
```

**Line ~851** — save on file/voice message sent:
```typescript
setMessages(prev => { const next = [...prev, sent]; saveChatCache(user!.id, contact.id, next); return next; });
```

**Line ~1042** — clear on "Clear chat":
```typescript
clearChatCache(user!.id, contact.id);
```

- [ ] **Step 7: TypeScript check**

```bash
cd aero-chat-app && pnpm build
```

Expected: `tsc` exits 0, Vite build completes with no errors.

- [ ] **Step 8: Commit**

```bash
cd aero-chat-app && git add src/lib/chatCache.ts src/lib/chatCache.test.ts src/components/chat/ChatWindow.tsx src/App.tsx
git commit -m "fix: scope localStorage cache keys per user ID

Cache keys change from aero-chat-{contactId} to
aero-chat-{userId}:{contactId}. pruneUnscopedCaches() runs
once on login to sweep legacy unscoped keys. Prevents cross-user
message cache bleed on shared devices."
```

---

## Task 2: Remove ChatWindow Depth Orbs

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx:1065-1077`

---

- [ ] **Step 1: Delete the depth orb block**

In `src/components/chat/ChatWindow.tsx`, find and remove the following block (lines ~1065–1077). It sits between `<SoapBubbles />` and the empty-state check:

```tsx
        {/* Depth orbs — behind message content */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <div className="orb" style={{
            width: 160, height: 160, right: -20, top: -20,
            background: 'rgba(0,160,255,0.08)',
            animation: 'orb-drift 7s ease-in-out infinite',
          }} />
          <div className="orb" style={{
            width: 120, height: 120, left: -20, bottom: -20,
            background: 'rgba(120,0,255,0.06)',
            animation: 'orb-drift 5s ease-in-out 2s infinite',
          }} />
        </div>
```

After deletion the sequence should read:

```tsx
        <BubbleLayer bubbles={bubbles} onRemove={removeBubble} />
        <SoapBubbles />

        {messages.length === 0 && (
```

- [ ] **Step 2: Build check**

```bash
cd aero-chat-app && pnpm build
```

Expected: clean build, no errors.

- [ ] **Step 3: Commit**

```bash
cd aero-chat-app && git add src/components/chat/ChatWindow.tsx
git commit -m "perf: remove ChatWindow depth orbs

Cuts active GPU compositor layers from 5 to 3. The 3 background
orbs in ChatLayout already bleed through the glass-chat panel —
the depth orbs were redundant."
```

---

## Task 3: Update Performance Roadmap

**Files:**
- Modify: `docs/performance-roadmap.html`

---

- [ ] **Step 1: Update stats pills in the hero section**

Find:
```html
      <div class="stat-pill"><div class="dot" style="background:var(--green)"></div> 7 shipped</div>
      <div class="stat-pill"><div class="dot" style="background:var(--orange)"></div> 0 up next</div>
      <div class="stat-pill"><div class="dot" style="background:var(--muted)"></div> 3 later</div>
```

Replace with:
```html
      <div class="stat-pill"><div class="dot" style="background:var(--green)"></div> 9 shipped</div>
      <div class="stat-pill"><div class="dot" style="background:var(--orange)"></div> 0 up next</div>
      <div class="stat-pill"><div class="dot" style="background:var(--muted)"></div> 1 later</div>
```

- [ ] **Step 2: Mark the two Phase 3 items as Shipped**

Find the cache key item (currently `status planned`):
```html
          <span class="item-title">Scope localStorage message cache keys per user ID</span>
          <span class="status planned">Planned</span>
```
Replace with:
```html
          <span class="item-title">Scope localStorage message cache keys per user ID</span>
          <span class="status done">✓ Shipped</span>
```
Also update its container class from `is-planned` to `is-done` and icon class from `cyan` to `green`.

Find the orb item:
```html
          <span class="item-title">Reduce orb count &amp; compositor layers</span>
          <span class="status planned">Planned</span>
```
Replace with:
```html
          <span class="item-title">Reduce orb count &amp; compositor layers</span>
          <span class="status done">✓ Shipped</span>
```
Also update its container class from `is-planned` to `is-done` and icon class from `cyan` to `green`.

- [ ] **Step 3: Update Phase 3 timeline entry**

Find:
```html
        <div class="phase-dot later">4</div>
```
Replace with:
```html
        <div class="phase-dot done">✓</div>
```

Find:
```html
        <div class="phase-title" style="color:var(--muted)">Phase 3 — Polish &amp; maintenance</div>
```
Replace with:
```html
        <div class="phase-title" style="color:var(--green)">Phase 3 — Polish &amp; maintenance (shipped 2026-03-27)</div>
```

- [ ] **Step 4: Update footer date**

Find:
```html
    AeroChat Performance Roadmap &mdash; Last updated 2026-03-26 &mdash; Phase 1 spec approved
```
Replace with:
```html
    AeroChat Performance Roadmap &mdash; Last updated 2026-03-27 &mdash; Phase 3 complete
```

- [ ] **Step 5: Commit**

```bash
cd aero-chat-app && git add docs/performance-roadmap.html
git commit -m "docs: mark Phase 3 complete on performance roadmap"
```

---

## Final Verification

- [ ] Open the app (`pnpm dev`), log in, open a chat
- [ ] In DevTools → Application → Local Storage: confirm cache keys follow `aero-chat-{userId}:{contactId}` format
- [ ] Log out and log in as a different user — confirm no messages from the first user are visible
- [ ] Confirm no depth orb glows appear inside the message scroll area (only the 3 background orbs drift behind the glass panels)
- [ ] `pnpm build` passes cleanly
