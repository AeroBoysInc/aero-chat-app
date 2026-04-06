# Emoji & GIF Picker — Design Spec

**Date:** 2026-04-06
**Scope:** Add emoji picker + Tenor GIF search/send to both DM ChatWindow and server BubbleChat.

---

## Decisions

| Decision | Choice |
|----------|--------|
| GIF provider | Tenor (Google) — free, no rate limit issues, simple REST API |
| Picker approach | Custom-built glass panel (Frutiger Aero style) with two tabs |
| GIF display in chat | Inline auto-play, max-width 280px, paused when offscreen |
| Picker trigger location | Smiley icon inside the text input (right edge) |

---

## 1. Picker Component — `EmojiGifPicker`

A single reusable popover panel used in both ChatWindow and BubbleChat.

### Structure
- **Trigger:** 😊 icon button inside the input field, right edge. Clicking toggles the picker open/closed. Clicking outside or pressing Escape closes it.
- **Panel:** Positioned above the input, anchored to the right edge. 340px wide, max-height ~380px. Glass background (`rgba(12,20,45,0.95)`, `backdrop-filter: blur(20px)`, `border: 1px solid rgba(80,145,255,0.12)`). Rounded 16px.
- **Tabs:** Two tabs at the top — "😊 Emoji" and "GIF". Active tab has cyan underline + bold text.

### Emoji Tab
- **Search bar:** Text input at top, filters emojis by name/keyword as user types. Placeholder: "Search emoji..."
- **Category bar:** Row of category icon buttons below search. Categories: Smileys & Emotion, People & Body, Animals & Nature, Food & Drink, Activities, Travel & Places, Objects, Symbols, Flags. Active category highlighted with `rgba(0,212,255,0.12)` background.
- **Emoji grid:** 8 columns, scrollable. Each cell is 36x36px with the emoji rendered at 20px. Hover: `rgba(255,255,255,0.08)` background, slight scale-up.
- **Category label:** Small uppercase label above each group when scrolling through all emojis.
- **Behavior:** Clicking an emoji inserts it into the text input at the current cursor position. The picker stays open so the user can insert multiple emojis. Clicking outside closes it.
- **Frequently used:** Top row shows the user's 8 most recently used emojis (persisted in localStorage keyed by user ID).

### GIF Tab
- **Search bar:** Text input, placeholder "Search Tenor...". Debounced at 300ms.
- **Initial state:** Shows trending GIFs from Tenor on load (cached for the session).
- **Grid:** 2-column masonry layout. GIF thumbnails rendered as `<img>` with `tinygif` format (low-res preview from Tenor, ~100KB each). Hover: slight scale-up, border glow.
- **Behavior:** Clicking a GIF sends it immediately as a message (not inserted into text input). The picker closes after sending.
- **Attribution:** "Powered by Tenor" text at the bottom-right of the panel (required by Tenor ToS).
- **Loading state:** Skeleton placeholders while GIFs load.
- **Error state:** "Couldn't load GIFs" with retry button.

---

## 2. Tenor API Integration

### API Setup
- **API endpoint:** `https://tenor.googleapis.com/v2/`
- **API key:** Stored as `VITE_TENOR_API_KEY` env var. Added to `.env.example`.
- **Endpoints used:**
  - `GET /featured` — trending GIFs (on tab open, no search query)
  - `GET /search?q={query}` — search GIFs by keyword
- **Parameters:** `key`, `q`, `limit=20`, `media_filter=tinygif,gif` (tinygif for preview thumbnails, gif for full-size send), `client_key=aero-chat`.

### Data Flow
1. User opens GIF tab → fetch `featured` → render thumbnails (`tinygif` format)
2. User types search query → debounce 300ms → fetch `search` → render results
3. User clicks a GIF → extract the full `gif` URL from the response → send as message

### Message Format
GIF messages use the existing encrypted message content format with a `_gif` flag:
```json
{
  "_gif": true,
  "url": "https://media.tenor.com/...",
  "width": 320,
  "height": 240,
  "previewUrl": "https://media.tenor.com/...tinygif..."
}
```

In DMs, this JSON is encrypted like any other message. In BubbleChat, it's sent as plaintext content (matching existing bubble message behavior).

---

## 3. GIF Rendering in Chat

### Display Rules
- **Max-width:** 280px. Height scales proportionally from the GIF's native aspect ratio.
- **Container:** Rounded corners matching the message bubble radius. `overflow: hidden`.
- **"GIF" badge:** Small label top-left corner — `rgba(0,0,0,0.5)` background, `backdrop-filter: blur(4px)`, 9px bold white text.
- **Timestamp:** Below the GIF image, inside the bubble.
- **Auto-play:** GIFs play automatically using `<img src={url}>` (browsers auto-animate GIFs).
- **Offscreen pause:** Use `IntersectionObserver` to swap the `src` to the static `previewUrl` (tinygif, first frame) when the GIF scrolls out of the viewport. Swap back to the animated `url` when it re-enters. This saves CPU/memory for long chat histories.

### Detection
Both ChatWindow and BubbleChat need a `isGifMessage(content)` helper that checks for `_gif: true` in parsed JSON, similar to existing `isVoiceMessage` and `isServerInvite` helpers.

---

## 4. Emoji Data

### Source
Use a static JSON file bundled in the app with the full Unicode emoji list (v15.1). Structure:
```ts
interface EmojiEntry {
  emoji: string;       // "😀"
  name: string;        // "grinning face"
  keywords: string[];  // ["happy", "smile", "grin"]
  category: string;    // "Smileys & Emotion"
}
```

This file is ~80KB gzipped. Import it statically (it's needed immediately when the picker opens).

### Search
Client-side filter: match the search query against `name` and `keywords` fields. Case-insensitive substring match. Results replace the category grid with a flat filtered list.

### Recently Used
- Stored in localStorage: `aero-emoji-recent:${userId}` — JSON array of emoji strings, max 16, most recent first.
- Displayed as the first row in the picker when no search is active.

---

## 5. Integration Points

### ChatWindow (DMs)
- Add 😊 trigger button inside the `<input>` element's wrapper.
- `onEmojiSelect(emoji)` → insert emoji string into `input` state at cursor position.
- `onGifSelect(gifData)` → call `sendEncryptedContent(JSON.stringify({ _gif: true, ...gifData }))`.
- Add `isGifMessage` check in the message rendering logic, alongside `isVoiceMessage`, `isServerInvite`, etc.

### BubbleChat (Servers)
- Same 😊 trigger button inside the input wrapper.
- `onEmojiSelect(emoji)` → insert into `input` state.
- `onGifSelect(gifData)` → call `sendContent(JSON.stringify({ _gif: true, ...gifData }))`.
- Add `isGifMessage` check in message rendering.

### Shared Component
`EmojiGifPicker` is a single component in `src/components/ui/EmojiGifPicker.tsx`. Both ChatWindow and BubbleChat import and render it. Props:
```ts
interface EmojiGifPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onGifSelect: (gif: { url: string; width: number; height: number; previewUrl: string }) => void;
  userId: string;  // for recently-used persistence
}
```

---

## 6. Performance Considerations

- **Emoji data:** Static import, ~80KB gzipped. Loaded once.
- **GIF thumbnails:** Use `tinygif` format (first frame, ~100KB per GIF). Only 20 loaded at a time.
- **Offscreen GIF pause:** `IntersectionObserver` swaps animated GIF to static preview when offscreen.
- **Tenor requests:** Debounced search at 300ms. Trending results cached in component state for the session (not refetched on every tab switch).
- **Picker lazy render:** The picker panel is only mounted when open (not hidden with CSS). Unmounted on close to free memory.

---

## 7. Files to Create/Modify

### New Files
- `src/components/ui/EmojiGifPicker.tsx` — the picker component
- `src/lib/emojiData.ts` — static emoji dataset + search helper
- `src/lib/tenor.ts` — Tenor API client (featured, search)

### Modified Files
- `src/components/chat/ChatWindow.tsx` — add picker trigger, emoji insert, GIF send, GIF message rendering
- `src/components/servers/BubbleChat.tsx` — same as above
- `.env.example` — add `VITE_TENOR_API_KEY`
