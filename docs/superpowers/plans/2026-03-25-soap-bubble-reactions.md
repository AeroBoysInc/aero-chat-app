# Soap Bubble Reactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user adds an emoji reaction to a message, a translucent soap bubble containing that emoji rises from the message and pops at the top of the chat area — purely visual, ephemeral, using existing CSS assets.

**Architecture:** A new `BubbleLayer` component manages an array of in-flight bubble instances rendered as absolutely-positioned elements inside the chat message list. `ChatWindow` spawns a bubble by resolving the message element's DOM position via `data-msg-id` + `closest('[data-bubble-container]')`. Bubbles run a two-phase animation (rise → pop) managed via `onAnimationEnd`, then self-remove from state. Remote reactions (real-time Supabase INSERT) also trigger bubbles so both sides see the effect.

**Tech Stack:** React 19, existing `.soap-bubble` CSS class, new `@keyframes reaction-bubble-rise` keyframe, existing `@keyframes bubble-pop` / `particle-fly` / `pop-ring` keyframes (all in `src/index.css`).

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `src/index.css` | Modify | Add `@keyframes reaction-bubble-rise` (shorter, px-based, for use inside chat pane) |
| `src/components/chat/BubbleLayer.tsx` | **Create** | Renders ephemeral bubble instances; handles rise → pop state machine |
| `src/components/chat/ChatWindow.tsx` | Modify | Add `data-msg-id` on inner message flex divs; `data-bubble-container` on scroll div; add `bubbles` state + `spawnBubble`; call on add-reaction + remote INSERT |

---

## Task 1 — CSS keyframe for chat reaction bubbles

**Files:**
- Modify: `src/index.css` (insert immediately before `@keyframes bubble-pop`, around line 586)

The existing `bubble-float-up` uses `vh` units spanning 0→−116vh — far too large for a chat pane. We need a compact px-based version that rises ~260 px with gentle side-wobble.

- [ ] **Step 1: Add the keyframe**

Find the line `@keyframes bubble-pop {` in `src/index.css` and insert the new keyframe immediately before it:

```css
@keyframes reaction-bubble-rise {
  0%   { transform: translateY(0px)    translateX(0px)   scale(0.55); opacity: 0; }
  7%   { transform: translateY(-18px)  translateX(4px)   scale(1.00); opacity: 1; }
  25%  { transform: translateY(-70px)  translateX(9px)   scale(1.00); opacity: 1; }
  45%  { transform: translateY(-135px) translateX(5px)   scale(1.00); opacity: 1; }
  65%  { transform: translateY(-195px) translateX(-6px)  scale(1.00); opacity: 1; }
  85%  { transform: translateY(-245px) translateX(-9px)  scale(1.00); opacity: 1; }
  100% { transform: translateY(-268px) translateX(-3px)  scale(1.05); opacity: 0; }
}
```

- [ ] **Step 2: Verify the file saved correctly**

Run: `grep -n "reaction-bubble-rise" src/index.css`
Expected: one match at the correct line.

---

## Task 2 — BubbleLayer component

**Files:**
- Create: `src/components/chat/BubbleLayer.tsx`

**Important CSS note:** The existing `.soap-bubble` class declares `position: absolute`. The outer container div (the 42×42 px positioner) is already `position: absolute`. So `.soap-bubble` will be absolute relative to that 42×42 div — which is fine as long as we give it `width: 100%; height: 100%` (we do). However, to avoid fighting with `.soap-bubble`'s built-in positioning, the outer container div must **not** be a flex container; just let `.soap-bubble` fill it via percentage sizing.

- [ ] **Step 1: Create the file**

```tsx
import { useEffect, useState } from 'react';

export interface BubbleInstance {
  id: string;
  emoji: string;
  /** px from left edge of the chat message-list container */
  x: number;
  /** px from top edge of the chat message-list container */
  y: number;
}

interface Props {
  bubbles: BubbleInstance[];
  onRemove: (id: string) => void;
}

/** Angles for 8 pop-particles (consumed by the particle-fly keyframe via --a CSS var) */
const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function Bubble({ inst, onRemove }: { inst: BubbleInstance; onRemove: (id: string) => void }) {
  const [phase, setPhase] = useState<'rising' | 'popping'>('rising');

  // Rise animation ends → switch to pop phase
  const handleRiseEnd = () => setPhase('popping');

  // Pop animation ends → remove bubble from parent state.
  // We use onAnimationEnd on the pop phase too (see sphere div below) for robustness
  // rather than a fixed timeout, so tab-backgrounding doesn't leave ghost elements.
  const handlePopEnd = () => onRemove(inst.id);

  const BUBBLE_SIZE = 42;

  return (
    // Outer positioner — position: absolute places this relative to data-bubble-container
    <div
      style={{
        position: 'absolute',
        left: inst.x - BUBBLE_SIZE / 2,
        top:  inst.y - BUBBLE_SIZE / 2,
        width: BUBBLE_SIZE,
        height: BUBBLE_SIZE,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {/* Soap bubble sphere.
          .soap-bubble has position:absolute built in; we let it fill the outer 42×42 div. */}
      <div
        className="soap-bubble"
        onAnimationEnd={phase === 'rising' ? handleRiseEnd : handlePopEnd}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          animation: phase === 'rising'
            ? 'reaction-bubble-rise 2.2s cubic-bezier(0.3, 0, 0.7, 1) forwards'
            : 'bubble-pop 0.42s ease-out forwards',
        }}
      >
        {inst.emoji}
      </div>

      {/* Pop particles — only during pop phase */}
      {phase === 'popping' && PARTICLE_ANGLES.map(angle => (
        <div
          key={angle}
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: 6, height: 6,
            borderRadius: '50%',
            background: 'rgba(0,200,255,0.85)',
            animation: 'particle-fly 0.42s ease-out forwards',
            ['--a' as string]: `${angle}deg`,
            ['--d' as string]: '28px',
          }}
        />
      ))}

      {/* Shockwave ring — only during pop phase */}
      {phase === 'popping' && (
        <div
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: BUBBLE_SIZE,
            height: BUBBLE_SIZE,
            borderRadius: '50%',
            border: '1.5px solid rgba(0,200,255,0.6)',
            animation: 'pop-ring 0.42s ease-out forwards',
          }}
        />
      )}
    </div>
  );
}

export function BubbleLayer({ bubbles, onRemove }: Props) {
  if (bubbles.length === 0) return null;
  return (
    <>
      {bubbles.map(inst => (
        <Bubble key={inst.id} inst={inst} onRemove={onRemove} />
      ))}
    </>
  );
}
```

- [ ] **Step 2: Verify the file exists**

Run: `ls src/components/chat/BubbleLayer.tsx`
Expected: file listed.

---

## Task 3 — Wire up in ChatWindow

**Files:**
- Modify: `src/components/chat/ChatWindow.tsx`

Four changes needed:
1. Import `BubbleLayer`
2. Add `bubbles` state + `spawnBubble` / `removeBubble` helpers
3. Call `spawnBubble` on add-reaction path and on remote INSERT
4. Add `data-msg-id` / `data-bubble-container` attributes and render `<BubbleLayer>`

### 3a — Import

- [ ] **Step 1: Add import at the top of ChatWindow.tsx (after existing imports)**

```tsx
import { BubbleLayer, type BubbleInstance } from './BubbleLayer';
```

### 3b — Add state and helpers

- [ ] **Step 2: Add `bubbles` state next to existing reaction state**

Find:
```tsx
const [reactions,         setReactions]         = useState<ReactionsMap>({});
const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
```

Add immediately after:
```tsx
const [bubbles, setBubbles] = useState<BubbleInstance[]>([]);
```

- [ ] **Step 3: Add `spawnBubble` and `removeBubble` helpers**

Place these inside the component body, after the existing `toggleReaction` `useCallback`:

```tsx
const spawnBubble = useCallback((emoji: string, messageId: string) => {
  const msgEl = document.querySelector(`[data-msg-id="${messageId}"]`);
  // Use closest() so it works even if multiple ChatWindows mount simultaneously
  const containerEl = msgEl?.closest('[data-bubble-container]');
  if (!msgEl || !containerEl) return; // message not in DOM (safe no-op)

  const msgRect       = msgEl.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();

  setBubbles(prev => [...prev, {
    id:    `${messageId}-${Date.now()}-${Math.random()}`,
    emoji,
    x: msgRect.left - containerRect.left + msgRect.width * 0.75,
    y: msgRect.top  - containerRect.top  + msgRect.height * 0.5,
  }]);
}, []); // stable — no external deps captured

const removeBubble = useCallback((id: string) => {
  setBubbles(prev => prev.filter(b => b.id !== id));
}, []);
```

### 3c — Add `spawnBubble` to `toggleReaction` dep array and call it on add

- [ ] **Step 4: Update `toggleReaction`**

`toggleReaction` currently ends with `}, [user, reactions]);`. Change its dep array to include `spawnBubble`:
```tsx
}, [user, reactions, spawnBubble]);
```

Then find the `else` (add-reaction) branch inside `toggleReaction`:
```tsx
  } else {
    await supabase.from('reactions').insert({ message_id: messageId, user_id: user.id, emoji });
    setReactions(prev => {
      const next = { ...prev, [messageId]: { ...prev[messageId] } };
      next[messageId][emoji] = [...(next[messageId][emoji] ?? []), user.id];
      return next;
    });
  }
```

Replace with:
```tsx
  } else {
    await supabase.from('reactions').insert({ message_id: messageId, user_id: user.id, emoji });
    setReactions(prev => {
      const next = { ...prev, [messageId]: { ...prev[messageId] } };
      next[messageId][emoji] = [...(next[messageId][emoji] ?? []), user.id];
      return next;
    });
    spawnBubble(emoji, messageId);
  }
```

### 3d — Add `spawnBubble` to real-time subscription dep array and call it on remote INSERT

- [ ] **Step 5: Update the real-time reaction INSERT handler**

Find the `useEffect` that sets up the real-time Supabase subscription (it has `[contact.id, user]` in its dependency array). Change the dep array to:
```tsx
}, [contact.id, user, spawnBubble]);
```

Then find the INSERT payload handler inside that effect:
```tsx
}, (payload) => {
  const r = payload.new as { message_id: string; user_id: string; emoji: string };
  setReactions(prev => {
    const next = { ...prev, [r.message_id]: { ...prev[r.message_id] } };
    if (!next[r.message_id][r.emoji]) next[r.message_id][r.emoji] = [];
    next[r.message_id][r.emoji] = [...next[r.message_id][r.emoji], r.user_id];
    return next;
  });
})
```

Replace with:
```tsx
}, (payload) => {
  const r = payload.new as { message_id: string; user_id: string; emoji: string };
  setReactions(prev => {
    const next = { ...prev, [r.message_id]: { ...prev[r.message_id] } };
    if (!next[r.message_id][r.emoji]) next[r.message_id][r.emoji] = [];
    next[r.message_id][r.emoji] = [...next[r.message_id][r.emoji], r.user_id];
    return next;
  });
  spawnBubble(r.emoji, r.message_id);
})
```

### 3e — Add `data-msg-id` to the inner message flex div

- [ ] **Step 6: Add `data-msg-id` attribute**

Each message renders two nested divs: an outer wrapper (keyed, may include date separator padding) and an **inner flex div** (`className="relative flex items-end gap-2 ..."`). Place `data-msg-id` on the **inner** flex div, not the outer keyed wrapper, so the Y origin is the actual bubble row and not the date separator padding:

```tsx
<div
  data-msg-id={msg.id}
  className="relative flex items-end gap-2 ..."
  ...
>
```

### 3f — Add `data-bubble-container` to the scroll div and render `<BubbleLayer>`

- [ ] **Step 7: Locate the scrollable message list div**

It is the `<div>` with `overflow-y: auto` (or `overflow-y: scroll`) that wraps the `.map(msg => ...)` list. It should already have `position: relative` (if not, add it). Add `data-bubble-container=""` to it, then render `<BubbleLayer>` as a direct child before the message map:

```tsx
<div
  data-bubble-container=""
  style={{ position: 'relative', flex: 1, overflowY: 'auto', .../* keep all existing styles */ }}
>
  {/* Ephemeral reaction bubbles — pointer-events:none, z-index 50 */}
  <BubbleLayer bubbles={bubbles} onRemove={removeBubble} />

  {/* existing message list — SoapBubbles, message map, etc. */}
  ...
</div>
```

---

## Task 4 — Build and commit

- [ ] **Step 1: TypeScript check + build**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && pnpm build
```

Expected: `✓ built in X.XXs` with zero TypeScript errors.

Common issues to watch for:
- `spawnBubble` used before declaration → move `spawnBubble` above the `useEffect` that references it
- `BubbleInstance` import error → check the named export in `BubbleLayer.tsx`

- [ ] **Step 2: Quick smoke test on localhost**

```bash
pnpm dev
```

Open http://localhost:1420, open two accounts in separate browsers, react to a message with any emoji — confirm:
- A bubble appears on the sender's side (own reaction)
- A bubble appears on the recipient's side (remote reaction via real-time INSERT)
- The bubble rises with a gentle wobble then pops with particles

- [ ] **Step 3: Commit**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app"
git add src/index.css src/components/chat/BubbleLayer.tsx src/components/chat/ChatWindow.tsx
git commit -m "feat(reactions): soap bubble rise-and-pop animation on emoji reactions

When a user adds a reaction, a translucent soap bubble with the emoji
rises ~260px from the message and pops with particles and a shockwave
ring. Remote reactions (real-time Supabase INSERT) also spawn bubbles
so both sides see the effect.

- Add @keyframes reaction-bubble-rise (compact px-based wobble rise)
- New BubbleLayer component: manages BubbleInstance array, two-phase
  rise→pop state machine via onAnimationEnd, particle burst, pop-ring
- ChatWindow: data-msg-id on inner flex message div, data-bubble-container
  on scroll div, spawnBubble (stable useCallback, empty deps), wired to
  toggleReaction add-path and real-time reaction INSERT handler;
  spawnBubble added to both dep arrays"
```

- [ ] **Step 4: Deploy**

```bash
cd "/home/dejanandovski/Code Repo/aero-chat-app" && git push origin main && vercel --prod --yes
```

---

## Verification Checklist

1. **Own reaction** — click "+" on a message, pick an emoji → bubble rises from that message row, wobbles gently, pops with cyan particles and shockwave ring near where it fades out
2. **Remote reaction** — second browser/account reacts to one of your messages → bubble appears on your screen too
3. **Multiple bubbles** — react rapidly with different emojis → each spawns its own bubble, they rise independently without interfering
4. **Pop cleanup** — after pop, no orphaned DOM elements remain (check React DevTools → BubbleLayer should show 0 children)
5. **Remove reaction** — clicking an existing reaction pill (to toggle it off) → **no** bubble spawns
6. **Day theme** — bubbles visible and clean-looking on the light theme
7. **No console errors** — especially no `Cannot read properties of null` from `spawnBubble` when message is off-screen (the `if (!msgEl || !containerEl) return` guard handles this silently)
