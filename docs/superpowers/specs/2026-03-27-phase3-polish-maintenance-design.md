# Phase 3 — Polish & Maintenance Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Two surgical fixes — scope localStorage message cache keys per user ID (privacy/security), and remove the two ChatWindow depth orbs (GPU compositor layer reduction).

**Architecture:** Both changes are independent and touch different files. No new dependencies required.

**Tech Stack:** React, TypeScript, localStorage API

---

## Scope

Three items were considered for Phase 3. Two are implemented here:

- ✅ Scope localStorage cache keys per user ID
- ✅ Remove ChatWindow depth orbs (orb count 5 → 3)
- ❌ DevTools rendering baseline — manual measurement task, no code change; noted in roadmap only

---

## Item 1 — Scope localStorage Message Cache Keys Per User ID

### Problem

`chatCache.ts` produces cache keys as `aero-chat-{contactId}`. On a shared device where two users log in sequentially, user B can read user A's decrypted message cache. The clear-timestamp keys are already correctly scoped (`aero-clear-{userId}-{contactId}`), but the message cache is not.

### Fix

**`src/lib/chatCache.ts`**

- Change `msgKey(contactId: string)` → `msgKey(userId: string, contactId: string)`, returning `` `aero-chat-${userId}:${contactId}` ``.
- Update `loadChatCache`, `saveChatCache`, `clearChatCache` signatures to accept `userId` as first argument. Pass it through to `msgKey`.
- Add `pruneUnscopedCaches()` — sweeps all localStorage keys starting with `aero-chat-` that do **not** contain `:`. These are old-format keys (no user scope). Deletes them silently.
- `clearAllChatCaches()` stays unchanged — it already sweeps all `aero-chat-` prefix keys, covering both old and new formats. Called on keypair rotation.

**`src/components/chat/ChatWindow.tsx`**

- All `loadChatCache`, `saveChatCache`, `clearChatCache` calls already have access to `user.id` (the authenticated user prop). Add `user.id` as the first argument to every call site.

**`src/App.tsx`**

- In `resolveSession`, after `setUser(profile)` and before returning, call `pruneUnscopedCaches()`. This runs once per login, silently removes any legacy unscoped keys. Users lose their local message cache once on first login after the update; Supabase re-populates history on next chat open.

### Key format summary

| Key type | Old format | New format |
|---|---|---|
| Message cache | `aero-chat-{contactId}` | `aero-chat-{userId}:{contactId}` |
| Clear timestamp | `aero-clear-{userId}-{contactId}` | *(unchanged — already scoped)* |
| Selected contact | `aero-selected-contact-id` | *(removed in Phase 0)* |

---

## Item 2 — Remove ChatWindow Depth Orbs

### Problem

When a chat is active, 5 `.orb` divs are live simultaneously:
- 3 background orbs in `ChatLayout.tsx` (always rendered behind both glass panels)
- 2 depth orbs inside `ChatWindow.tsx` (inside the message scroll area)

Each `.orb` has `filter: blur(55px)` which forces a separate GPU compositor layer. 5 layers is unnecessary overhead.

### Fix

**`src/components/chat/ChatWindow.tsx`**

Delete the `pointer-events-none absolute inset-0 overflow-hidden` wrapper `<div>` and its two `.orb` children that sit alongside `<SoapBubbles>` inside the message area container. (~7 lines removed, 0 added.)

The 3 background orbs in `ChatLayout` already bleed through the semi-transparent `glass-chat` panel and provide the full atmospheric depth effect. The ChatWindow depth orbs were additive but not perceptibly distinct from the background orbs showing through.

**Result:** Active orb count drops from 5 → 3 when chatting.

---

## Roadmap Update

**`docs/performance-roadmap.html`**

- Phase 3 timeline dot: `later` → `done`
- Phase 3 title: add "(shipped 2026-03-27)"
- Stats pills: update shipped/planned counts
- Footer: bump "Last updated" date
- The three Phase 3 items in the item list: mark cache key and orb items as `Shipped`; DevTools baseline stays as `Later` with a note that it's a manual measurement task

---

## Testing

1. Log in as user A, open a chat — confirm messages load and save (check localStorage in DevTools; keys should be `aero-chat-{userId}:{contactId}`)
2. Log out, log in as user B — confirm user A's messages are not accessible; confirm user B gets a fresh empty cache that re-populates from Supabase
3. Open a chat — confirm no depth orbs visible inside the message area (only the background orbs drift behind the glass panels)
4. `pnpm build` passes with no TypeScript errors
