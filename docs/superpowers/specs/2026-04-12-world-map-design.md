# World Map — Sub-project 3 Design Spec

**Parent spec:** `2026-04-11-dungeons-and-servers-design.md` (sections 3a–3c)  
**Brainstormed:** 2026-04-12  
**Interactive mockup:** `.superpowers/brainstorm/2171941-1775951560/content/worldmap-interactive.html`

---

## Overview

The World Map is a tab in the DnD toolkit (`DndTabBar`) that lets DMs upload map images and place interactive pins on them. Players can browse visible maps, hover pins for quick info, and click pins for full rich-text detail popups. DMs manage maps, set per-map visibility, and create/edit/delete pins with a Tiptap WYSIWYG editor.

This is a single-page tab — no sub-routes. A map switcher dropdown lets users toggle between maps.

---

## 1. Database Schema

### 1a. `dnd_maps`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid | `gen_random_uuid()` | PK |
| `server_id` | uuid | | FK → `servers(id)` ON DELETE CASCADE |
| `name` | text | | e.g. "Overworld", "The Underdark" |
| `image_url` | text | | Supabase Storage — `dnd-assets` bucket |
| `sort_order` | int | `0` | Controls order in map switcher |
| `created_by` | uuid | | FK → `profiles(id)` |
| `created_at` | timestamptz | `now()` | |

**Indexes:** `(server_id)`, `(server_id, sort_order)`

**RLS:**
- SELECT: server members can read maps (visibility filtering is client-side, not RLS, because it depends on role logic)
- INSERT/UPDATE/DELETE: DM only (check `dnd_characters.is_dm = true` for the user in that server)

### 1b. `dnd_map_pins`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid | `gen_random_uuid()` | PK |
| `map_id` | uuid | | FK → `dnd_maps(id)` ON DELETE CASCADE |
| `x` | float | | 0–100 percentage coordinate |
| `y` | float | | 0–100 percentage coordinate |
| `pin_type` | text | `'custom'` | Preset key or `'custom'` |
| `emoji` | text | `'📍'` | Emoji icon for the pin |
| `name` | text | | Pin title (required) |
| `subtitle` | text | `''` | Short one-liner below title |
| `description` | jsonb | `'{}'` | Tiptap rich text JSON document |
| `header_image_url` | text | | Optional header image for popup |
| `color` | text | `'#00b4ff'` | Hex color for pin ring, glow, label |
| `created_by` | uuid | | FK → `profiles(id)` |
| `created_at` | timestamptz | `now()` | |

**Indexes:** `(map_id)`

**RLS:**
- SELECT: server members can read all pins (visibility filtering happens client-side at the map level)
- INSERT/UPDATE/DELETE: DM only

### 1c. `dnd_map_visibility`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid | `gen_random_uuid()` | PK |
| `map_id` | uuid | | FK → `dnd_maps(id)` ON DELETE CASCADE |
| `target_type` | text | | `'role'` or `'member'` |
| `target_id` | uuid | | Role ID or user ID |

**Unique constraint:** `(map_id, target_type, target_id)`

**Visibility rules:**
- Zero rows for a map → visible to **everyone** in the server (public)
- One or more rows → restricted to listed roles/members only
- The DM **always** sees all maps regardless of visibility rows

### 1d. Supabase Storage

- Bucket: `dnd-assets` (already exists from character portraits)
- Map images stored at: `maps/{server_id}/{map_id}.{ext}`
- Pin header images stored at: `pins/{server_id}/{pin_id}.{ext}`
- Max file size: 5 MB
- Accepted types: JPEG, PNG, WebP

### 1e. Migration file

Single migration: `supabase/migrations/XXX_dnd_world_maps.sql`

Creates all three tables, indexes, unique constraints, and RLS policies.

---

## 2. Pin Type Presets

A fixed set of ~12 fantasy-themed pin type presets. These are **not** stored in the database — they live as a constant in the frontend (`src/lib/pinTypePresets.ts`).

| Key | Emoji | Default Color | Label |
|-----|-------|---------------|-------|
| `city` | 🏰 | `#FFD700` | City / Capital |
| `town` | 🏘️ | `#D4A87A` | Town / Village |
| `dungeon` | ⚔️ | `#E05050` | Dungeon |
| `forest` | 🌲 | `#66CC66` | Forest / Wilderness |
| `tavern` | 🍺 | `#FFAA33` | Tavern / Inn |
| `temple` | 🏛️ | `#AA99EE` | Temple / Shrine |
| `mountain` | ⛰️ | `#AAAAAA` | Mountain / Cave |
| `port` | ⚓ | `#55BBEE` | Port / Harbor |
| `camp` | 🏕️ | `#CC8844` | Camp / Outpost |
| `ruins` | 🏚️ | `#998866` | Ruins |
| `lake` | 🌊 | `#4488CC` | Lake / River |
| `custom` | 📍 | `#00B4FF` | Custom (DM picks emoji + color) |

When creating a pin, the DM selects a preset type from the right-click menu. The preset auto-fills emoji and color, which the DM can override in the pin editor.

---

## 3. Zustand Store — `dndMapStore`

File: `src/store/dndMapStore.ts`

```
interface DndMapStoreState {
  maps: DndMap[]
  pins: Record<string, DndMapPin[]>   // keyed by map_id
  activeMapId: string | null
  loading: boolean

  loadMaps(serverId: string): Promise<void>
  loadPins(mapId: string): Promise<void>
  createMap(data: { server_id, name, image_url }): Promise<{ error?: string }>
  updateMap(id: string, fields: Partial<DndMap>): Promise<{ error?: string }>
  deleteMap(id: string): Promise<{ error?: string }>
  reorderMaps(serverId: string, orderedIds: string[]): Promise<void>

  createPin(data: Omit<DndMapPin, 'id' | 'created_at'>): Promise<{ error?: string }>
  updatePin(id: string, fields: Partial<DndMapPin>): Promise<{ error?: string }>
  deletePin(id: string): Promise<{ error?: string }>

  setActiveMap(mapId: string): void
  subscribeRealtime(serverId: string): () => void
  reset(): void
}
```

**Realtime:** Subscribe to `postgres_changes` on both `dnd_maps` and `dnd_map_pins` filtered by server_id (maps) and via a join/channel pattern for pins. Same pattern as `dndCharacterStore`.

**Visibility filtering:** `loadMaps` fetches all maps + their visibility rows. Filters client-side based on the current user's ID and roles. DM check uses `dndCharacterStore.characters` to see if the user has `is_dm = true`.

---

## 4. Component Architecture

### 4a. Component Tree

```
WorldMapTab                          (tab root, lives in DndTabBar)
├── MapSwitcher                      (top-left HUD dropdown)
│   └── MapManager (DM only)         (gear icon → modal for upload/reorder/visibility)
├── MapViewer                        (pan/zoom container, full tab height)
│   ├── MapWorld                     (inner div with CSS transform)
│   │   ├── <img> map image          (fills 100% of world)
│   │   ├── MapPin[]                 (absolute positioned by x%, y%)
│   │   │   └── PinTooltip           (hover: image + title + type above pin)
│   │   └── AddPinMenu (DM only)     (right-click context menu)
│   ├── Minimap                      (bottom-left corner)
│   └── ZoomControls                 (top-right: +/−/percentage)
├── PinPopup                         (fixed overlay on pin click)
│   └── Edit button (DM only)        (opens PinEditor)
└── PinEditor                        (modal: create/edit pin with Tiptap)
```

### 4b. MapViewer — Pan & Zoom

- Outer container: `overflow: hidden`, captures mouse/wheel events
- Inner `MapWorld` div: `transform-origin: 0 0`, rendered with `transform: translate(Xpx, Ypx) scale(S)`
- **Pan:** mousedown + mousemove on container (not on HUD/pins). Track `dragMoved` flag to distinguish drag from click.
- **Zoom:** wheel event with `preventDefault()`. Zoom toward cursor position (recalculate panX/panY to keep world point under cursor stable). Range: 1x–3x.
- **+/− buttons:** zoom toward center of viewport
- **Clamp:** `panX/panY` clamped so the map can't scroll past its edges
- Map image fills the world div at 100% width/height. Pins use `left: X%`, `top: Y%` with `transform: translate(-50%, -50%)`.

### 4c. MapPin

- Renders emoji in a colored circle with glow, pulse ring animation, and label below
- `mouseenter` → show PinTooltip above the pin (in world-space so it transforms with zoom)
- `mouseleave` → hide PinTooltip
- `click` → open PinPopup (only if `dragMoved === false`)
- Pin click zones stay the same pixel size regardless of zoom (apply inverse scale to the pin container) so they remain tappable at all zoom levels

### 4d. PinTooltip

- Positioned above the pin using the pin's `left`/`top` percentages + `translateY(-100%)`
- Shows: header image (or gradient), title (colored), and pin type label
- Non-interactive (pointer-events: none) — clicking through it hits the pin and opens the popup
- Fades in/out with CSS transition

### 4e. PinPopup

- Fixed overlay with backdrop blur, centered card
- Header image area (160px) with pin type badge and close button
- Title (Georgia serif, pin color), subtitle (italic), rich text body (rendered from Tiptap JSON), footer
- **DM sees:** an "Edit" button in the header that opens PinEditor with existing data
- **DM sees:** a "Delete" button with confirmation
- Close via: X button, click outside, or Escape

### 4f. PinEditor (DM only)

- Modal form for creating or editing a pin
- Fields:
  - **Name** (text input, required)
  - **Subtitle** (text input, optional)
  - **Pin type** (dropdown of presets, selecting one auto-fills emoji + color)
  - **Emoji** (editable, pre-filled from preset)
  - **Color** (color picker, pre-filled from preset)
  - **Header image** (file upload, optional)
  - **Description** (Tiptap rich text editor — bold, italic, headings, links, lists)
- On create: coordinates (x, y) pre-filled from right-click position
- On edit: all fields pre-filled from existing pin data
- Save button calls `createPin` or `updatePin`
- Delete button (edit mode only) calls `deletePin` with confirmation

### 4g. AddPinMenu (DM only)

- Right-click context menu showing pin type presets (emoji + label for each)
- Positioned at cursor, clamped to viewport edges
- Selecting a type opens PinEditor with that preset's emoji/color and the right-click coordinates
- Closes on click outside or Escape

### 4h. MapSwitcher

- Top-left HUD element showing current map name with dropdown arrow
- Click to open dropdown listing all visible maps
- Active map highlighted
- **DM sees:** a gear icon that opens MapManager

### 4i. MapManager (DM only)

- Modal accessed from gear icon in MapSwitcher
- **Upload map:** file picker → uploads to `dnd-assets` bucket → names the map → creates row
- **Reorder maps:** drag handle list to reorder (updates `sort_order`)
- **Visibility per map:** toggle between "Everyone" and "Restricted". Restricted mode shows multiselect for roles and members.
- **Delete map:** with confirmation (cascades to all pins)

### 4j. Minimap

- Bottom-left corner HUD element (140×95px)
- Renders: scaled terrain/image background + colored dots for each pin + viewport rectangle
- **Click** on minimap → centers the map viewport on that point
- **Drag** on minimap → continuously pans the map
- Viewport rectangle updates in real-time as user pans/zooms

### 4k. ZoomControls

- Top-right HUD: +/− buttons + percentage label
- Zoom toward center of viewport
- Shows current zoom level (100%–300%)

---

## 5. Visibility System

### How it works:

1. `loadMaps(serverId)` fetches all maps for the server
2. Fetches `dnd_map_visibility` rows for those maps
3. Determines if current user is DM (via `dndCharacterStore`)
4. Filters maps client-side:
   - **DM:** sees all maps
   - **Player:** sees maps with zero visibility rows (public) OR maps where `target_type='member'` and `target_id=userId` OR `target_type='role'` and `target_id` matches one of the user's role IDs
5. MapSwitcher dropdown only renders visible maps
6. Pins inherit parent map visibility — no per-pin visibility

### DM visibility management:

- In MapManager, each map has a visibility toggle
- "Everyone" = delete all visibility rows for that map
- "Restricted" = show multiselect of server roles + individual members
- Adding/removing entries inserts/deletes `dnd_map_visibility` rows

---

## 6. Tiptap Rich Text Editor

**Package:** `@tiptap/react` + `@tiptap/starter-kit`

**Extensions enabled:**
- Bold, Italic, Underline
- Headings (H2, H3)
- Bullet list, Ordered list
- Links (with URL input)
- Blockquote
- Text align (left, center)

**Storage format:** Tiptap JSON document stored in `dnd_map_pins.description` as JSONB.

**Rendering:** In the PinPopup, use Tiptap's `generateHTML()` to render the stored JSON to HTML. Style with the existing popup text styles (Georgia serif, muted colors, centered).

**Toolbar:** Compact floating toolbar above the editor in PinEditor modal. Icon buttons for each formatting option.

---

## 7. Real-time Sync

Subscribe to two Supabase Realtime channels:

1. **`dnd-maps:{serverId}`** — listens to `postgres_changes` on `dnd_maps` table filtered by `server_id`
   - INSERT → add map to store (re-check visibility)
   - UPDATE → update map in store
   - DELETE → remove map + its pins from store; if it was active, switch to first available map

2. **`dnd-pins:{serverId}`** — listens to `postgres_changes` on `dnd_map_pins` table
   - Supabase Realtime can't join tables, so subscribe without a server filter and filter client-side: on each event, check if the pin's `map_id` belongs to a map currently in the store
   - INSERT → add pin to the correct map's pin array
   - UPDATE → update pin in place
   - DELETE → remove pin

This ensures all connected members see pin additions, edits, and deletions in real-time without refreshing.

---

## 8. Performance Considerations

- **Map images** can be large. Use `object-fit: contain` and let the browser handle scaling. Consider lazy-loading pins for maps not currently active.
- **Pin rendering:** Each pin is a lightweight DOM element (emoji + label). At ≤50 pins per map this is fine without virtualization.
- **Zoom:** CSS `transform: scale()` is GPU-accelerated. The map image rasterizes at the original resolution — at 3x zoom, large images will look better than small ones. Recommend DMs upload at least 2000px wide.
- **Tiptap:** Lazy-load the Tiptap editor (`React.lazy`) since it's only needed when the DM opens PinEditor. The renderer (`generateHTML`) is lightweight and can be eagerly loaded.
- **Minimap:** Re-renders on pan/zoom via a lightweight CSS position update (no canvas needed).
- **Pulse ring animations:** Each pin has one `@keyframes pulse-out` animation. With ≤50 pins, this is well within budget. Animations auto-pause via the existing `.paused *` idle rule.

---

## 9. Files to Create/Modify

### New files:
- `supabase/migrations/XXX_dnd_world_maps.sql` — tables, indexes, RLS
- `src/lib/pinTypePresets.ts` — preset constants
- `src/lib/serverTypes.ts` — add `DndMap`, `DndMapPin`, `DndMapVisibility` types
- `src/store/dndMapStore.ts` — Zustand store
- `src/components/servers/toolkits/worldmap/WorldMapTab.tsx` — tab root
- `src/components/servers/toolkits/worldmap/MapViewer.tsx` — pan/zoom container
- `src/components/servers/toolkits/worldmap/MapPin.tsx` — individual pin
- `src/components/servers/toolkits/worldmap/PinTooltip.tsx` — hover tooltip
- `src/components/servers/toolkits/worldmap/PinPopup.tsx` — detail overlay
- `src/components/servers/toolkits/worldmap/PinEditor.tsx` — create/edit form with Tiptap
- `src/components/servers/toolkits/worldmap/AddPinMenu.tsx` — right-click context menu
- `src/components/servers/toolkits/worldmap/MapSwitcher.tsx` — dropdown
- `src/components/servers/toolkits/worldmap/MapManager.tsx` — DM map management modal
- `src/components/servers/toolkits/worldmap/Minimap.tsx` — corner minimap
- `src/components/servers/toolkits/worldmap/ZoomControls.tsx` — +/−/percentage

### Modified files:
- `src/components/servers/toolkits/DndTabBar.tsx` — add World Map tab
- `src/lib/serverTypes.ts` — add new type definitions

---

## 10. Interaction Summary

| Action | Who | Result |
|--------|-----|--------|
| Hover pin | Everyone | Tooltip appears above pin (image + title + type) |
| Click pin | Everyone | Full popup overlay with rich text description |
| Right-click map | DM only | Pin type context menu → opens PinEditor |
| Click pin edit button (in popup) | DM only | PinEditor modal with existing data |
| Scroll wheel on map | Everyone | Zoom in/out toward cursor (1x–3x) |
| Left-click drag on map | Everyone | Pan the map |
| Click/drag minimap | Everyone | Navigate to that map region |
| Click +/− buttons | Everyone | Zoom toward center |
| Map switcher dropdown | Everyone | Switch between visible maps |
| Gear icon in switcher | DM only | Open MapManager modal |
| Escape | Everyone | Close popup → close tooltip |
