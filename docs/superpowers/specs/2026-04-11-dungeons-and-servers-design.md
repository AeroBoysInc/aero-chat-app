# Dungeons & Servers — Design Spec

## Overview

**Dungeons & Servers** is the first **server toolkit** for AeroChat — a DnD-focused feature pack that transforms a server into a campaign management hub. Premium server owners activate it for free; the entire server membership then sees the DnD-enhanced UI. The toolkit layers medieval-accented visuals on top of the active app theme (day, night, ultra, master) without replacing the Frutiger Aero glass base.

**Target user:** A DnD group that already uses AeroChat for voice/text and wants campaign tools integrated into the same app.

---

## Sub-project Decomposition

This feature is large enough to warrant multiple spec → plan → implementation cycles:

| # | Sub-project | Depends on |
|---|-------------|------------|
| 1 | **Toolkit Infrastructure** — activation system, DM permission, themed UI shell, tab navigation, "More Info" documentation popup | Nothing (foundation) |
| 2 | **Character Cards** — D&D Beyond API integration, manual fallback, sidebar cards, expanded sheet, call tile integration | Sub-project 1 |
| 3 | **World Map** — Image upload, pin placement, pin detail panels, real-time pin sync | Sub-project 1 |
| 4 | **Quest Tracker** — Quest CRUD, public/secret visibility, completion cross-off | Sub-project 1 |
| 5 | **DM Notebook** — Medieval-styled rich text notes, DM-only access | Sub-project 1 |
| 6 | **Dice Roller** — `/roll` command parsing, color-gradient formatted output in chat | Sub-project 1 |

Sub-projects 2–6 are independent of each other and can be built in any order after the infrastructure is in place.

---

## 1. Toolkit Infrastructure

### 1a. Activation Flow

- New **"Toolkits"** tab in `ServerSettings` (alongside Roles, Members, Bubbles, Invites, Events).
- The tab is visible to all members but only the server owner can activate/deactivate.
- Non-premium owners see the toolkit card with a "Requires Aero+" badge; clicking "Activate" opens `PremiumModal`.
- Premium owners see two buttons:
  - **"More Info"** — opens a paginated documentation popup (6 pages: Overview, Character Cards, World Map, Quest Log, Dice & Chat, DM Tools & Setup). Each page has visuals and setup instructions. Navigation via dots + Next/Back arrows.
  - **"Activate Toolkit"** — inserts a row into `server_toolkits`, grants `dungeon_master: true` to the Owner role, and triggers a UI refresh.
- Deactivation: a "Deactivate" button in the same tab (owner only). Removes the `server_toolkits` row. Data (characters, maps, quests, notes) is preserved — reactivating restores everything.

### 1b. Dungeon Master Permission

- Add `dungeon_master BOOLEAN DEFAULT false` to `server_role_permissions`.
- On toolkit activation, the Owner role automatically gets `dungeon_master: true`.
- The Owner can grant `dungeon_master` to any custom role via the existing `RoleEditor`.
- DM permissions govern: creating/editing quests, placing map pins, accessing DM notebook, managing character overrides.
- Multiple users can have the DM permission (co-DMs supported).

### 1c. Themed UI Shell

**CSS Variable Layer:**

When a toolkit is active on a server, a set of `--tk-*` CSS variables are applied as a scoped layer. These override nothing in the base theme — they provide additional accent tokens that toolkit components consume.

Day theme values:
```css
--tk-accent: #8B4513;
--tk-accent-light: #D2691E;
--tk-accent-glow: rgba(210,105,30,0.15);
--tk-gold: #B8860B;
--tk-text: #4a3520;
--tk-text-muted: rgba(74,53,32,0.45);
--tk-border: rgba(139,69,19,0.15);
--tk-panel: rgba(139,69,19,0.06);
```

Night theme values:
```css
--tk-accent: #D2691E;
--tk-accent-light: #E8944C;
--tk-accent-glow: rgba(210,105,30,0.20);
--tk-gold: #FFD700;
--tk-text: #e8d5b0;
--tk-text-muted: rgba(232,213,176,0.40);
--tk-border: rgba(139,69,19,0.20);
--tk-panel: rgba(139,69,19,0.06);
```

Ultra and master themes: derive `--tk-*` values that complement the theme's palette (e.g., golden-hour gets warm amber DnD accents, john-frutiger gets cooler copper tones).

**Application:** The `--tk-*` variables are set via a `<div>` wrapper (or `style` attribute on the server view root) that checks `server_toolkits` for the current server. Non-toolkit servers never see these variables.

### 1d. Tab Navigation

When a toolkit is active, the server view gains a **horizontal tab bar** below the server header:

- **Bubbles** (existing — chat channels, the default tab)
- **Characters** (character card grid — sub-project 2)
- **World Map** (pinnable map — sub-project 3)
- **Quests** (quest log — sub-project 4)
- **DM Notes** (notebook — sub-project 5, DM-only tab)

Each tab renders its own component in the main content area. The tab bar uses `--tk-accent` for the active tab indicator. Tabs that have no content yet (before sub-projects are built) show a "Coming soon" placeholder.

### 1e. Server Header Adjustments

When toolkit is active:
- Server icon gets a subtle gold ring border (`--tk-gold` at 25% opacity)
- Decorative corner ornaments (fleur-de-lis at 8% opacity) in the BubbleHub area
- Bubble colors remain user-defined; only the surrounding chrome gets the medieval accent

---

## 2. Character Cards

### 2a. D&D Beyond Integration (Full Mode)

**Linking flow:**
1. User clicks "Link Character" in the Characters tab.
2. User pastes their D&D Beyond character share URL (e.g., `https://www.dndbeyond.com/characters/12345678`).
3. App extracts the character ID and fetches data via the D&D Beyond API.
4. Character card is created with full data: name, race, class, level, portrait, HP, XP, all six stats, AC, initiative, proficiency bonus, traits.
5. Data is stored in `dnd_characters` with `source: 'dndbeyond'`.

**Sync:** A "Refresh" button on the character card re-fetches from D&D Beyond. `last_synced_at` timestamp shown on card footer. No automatic polling — sync is manual to respect API limits.

**API access note:** D&D Beyond does not offer a fully public REST API. Character data is accessed by scraping the public character JSON endpoint (`https://character-service.dndbeyond.com/character/v5/character/<id>`) which is available for characters with sharing enabled. If this endpoint becomes unavailable or restricted, the manual fallback mode ensures the feature remains functional. The implementation should handle API failures gracefully and prompt users to switch to manual mode if sync fails repeatedly.

**Data pulled from D&D Beyond:**
- Name, race, class (multiclass supported as comma-separated), level
- Portrait image URL
- HP (current/max), XP (current/max for milestone or XP-based tracking)
- Six ability scores (STR, DEX, CON, INT, WIS, CHA)
- Armor Class, Initiative modifier, Proficiency bonus
- Notable traits (Darkvision, resistances, etc.)

### 2b. Manual Mode (Tracking Only)

**Warning displayed before manual creation:**

> "Dungeons & Servers is designed to sync with D&D Beyond for the full experience. Manual mode is for players using other platforms (Foundry VTT, Roll20, pen & paper). You'll only be able to track basic info — this won't build a character sheet for you. Make sure your character is already created elsewhere."

**Manual fields:**
- Portrait (upload to `dnd-assets` storage bucket)
- Character name (required)
- Race (text input)
- Class (text input)
- Level (number)
- HP current / HP max
- XP current / XP max
- Gold (optional)

**Not available in manual mode:** Stat block, AC, initiative, proficiency, traits. The expanded card popup simply omits these sections.

### 2c. Card Appearances

**Sidebar compact card (in bubble member list):**
- Character portrait (32px circle) with class-color border
- Character name + "Race Class · Lv X"
- HP bar (green → red gradient based on percentage)
- XP bar (gold)
- DM badge (gold border + "Dungeon Master" label) for DM users

**Expanded card popup (click to inspect):**
- Larger portrait (64px) with class-color glow
- Full name, race, class, level
- "Played by @username" subtitle
- Stat grid (3x2): STR/DEX/CON/INT/WIS/CHA — high stats highlighted in class color, low stats dimmed (D&D Beyond mode only)
- HP + XP bars (larger, with glow)
- Quick-info badges: AC, Initiative, Proficiency, notable traits (D&D Beyond mode only)
- "Synced from D&D Beyond · X min ago" footer (or "Manual character" for manual mode)

**Call tile integration:**
- During voice/video calls in a toolkit-enabled server, participant tiles show:
  - Character portrait instead of (or overlaid on) user avatar
  - Character name, class/level
  - Mini HP bar
  - DM badge for Dungeon Master users
  - Low HP warning indicator (red `!` when below 25%)

### 2d. HP Bar Color Logic

HP bar color shifts based on percentage of current/max:
- 100–60%: green (`#4CAF50`)
- 60–30%: yellow-orange (`#FFA000`)
- 30–0%: red (`#e53935`)

Smooth CSS gradient transition between thresholds.

---

## 3. World Map

### 3a. Map Management

- DMs can upload map images (JPEG/PNG/WebP, stored in `dnd-assets` bucket).
- Multiple maps per server (e.g., continent map, city map, dungeon map).
- One map marked as `is_active` — shown by default when opening the World Map tab.
- DM can switch the active map or browse all maps.
- Players see the active map; DMs can navigate between all maps.

### 3b. Pin System

- DM clicks anywhere on the map image to place a pin.
- Pin creation form: label (required), description (optional rich text), icon (emoji picker or preset fantasy icons: castle, tavern, dungeon, forest, mountain, etc.).
- Pins stored as percentage coordinates (`x: 0–100`, `y: 0–100`) so they scale with any display size.
- Pins render as small icons on the map with a label tooltip on hover.
- Click a pin to open a detail panel (side panel or popup) with the full description.
- DM can edit/delete pins. Players can only read.
- **Real-time:** Pin creation/update/deletion syncs via Supabase Realtime so all connected members see changes instantly.

### 3c. Map Interaction

- Zoom: scroll wheel or pinch (CSS transform scale, 1x–3x range).
- Pan: click-and-drag when zoomed in.
- Pin click zones scale inversely with zoom so they remain tappable.

---

## 4. Quest Tracker

### 4a. Quest CRUD

- DMs create quests with: title, description (optional), visibility setting.
- Quests appear in a scrollable list in the Quests tab, ordered by `sort_order`.
- DM can drag to reorder, edit, or delete quests.

### 4b. Visibility Model

- **Public (default):** All server members see the quest.
- **Secret:** Only the DM(s) and specifically assigned players see it. DM selects players from the member list when creating/editing a secret quest. `secret_player_ids` stores the assigned user IDs.
- Secret quests have a visual indicator (eye-slash icon) visible only to the DM.

### 4c. Completion

- DM (or assigned player for secret quests) can mark a quest as completed.
- Completed quests get a strikethrough + checkmark animation.
- Completed quests move to a "Completed" section at the bottom (collapsible).
- `completed_at` timestamp recorded.

---

## 5. DM Notebook

### 5a. Note Structure

- A list of notes in the DM Notes tab, each with a title and rich text content.
- DM can create, edit, reorder, and delete notes.
- Notes support basic formatting: bold, italic, headers, bullet lists, links.
- No embedded images in v1 — keep it text-focused (images go in the World Map).

### 5b. Access Control

- Only users with `dungeon_master` permission can see the DM Notes tab.
- RLS enforces this at the database level — non-DM users cannot read `dnd_dm_notes` rows.

### 5c. Visual Style

- The notebook component uses `--tk-*` variables for a warm, parchment-adjacent feel.
- Note cards have subtle paper-like texture via CSS gradient (no image assets).
- Serif or serif-adjacent font for note titles (e.g., system Georgia or a web font).

---

## 6. Dice Roller

### 6a. Command Syntax

The `/roll` command is typed in any bubble chat within a toolkit-enabled server.

**Supported notation:**
- `/roll NdX` — roll N dice with X sides (e.g., `/roll 2d6`)
- `/roll NdX+M` — with modifier (e.g., `/roll 1d20+5`)
- `/roll NdX-M` — with negative modifier
- `/roll dX` — shorthand for 1dX (e.g., `/roll d20`)

**Parsing:** Regex match on `/roll\s+(\d*)d(\d+)([+-]\d+)?/i`. Invalid input shows an inline error: "Invalid dice notation. Try `/roll 2d6+3`".

### 6b. Output Format

The roll result renders as a special styled message block in chat (not a plain text message):

```
🎲 rolled 2d6+3
[4, 2] + 3 = 9
```

**Color gradient for individual dice:**
- Each die result is colored on a gradient from red (minimum) to green (maximum) based on where it falls in the die's range.
- For a d20: 1 = deep red (`#e53935`), 10 = neutral yellow (`#FFA000`), 20 = bright green (`#4CAF50`).
- For a d6: 1 = red, 3–4 = yellow, 6 = green.
- Formula: `hue = (roll - 1) / (sides - 1) * 120` (0° red → 120° green in HSL).

**Special cases:**
- Natural 1 (on any die): red glow + "NAT 1!" label
- Natural max (e.g., 20 on d20): green glow + "NAT 20!" label (only when rolling a single die)

**Total:** Displayed larger and bolder than individual dice, colored by the same gradient relative to the total's possible range (min to max).

### 6c. Storage

Roll results are stored as regular `bubble_messages` with a JSON content payload:

```json
{
  "_dndRoll": true,
  "expression": "2d6+3",
  "dice": [4, 2],
  "sides": 6,
  "modifier": 3,
  "total": 9
}
```

The chat renderer detects `_dndRoll: true` and renders the styled dice block instead of plain text. This follows the existing pattern for voice messages, file messages, and GIF messages that also use JSON content with a type flag.

**Roll history table (`dnd_rolls`):** Deferred to a future version. Rolls are already persisted as chat messages; a dedicated audit table adds complexity without clear v1 value.

---

## Database Schema

### New Tables

**`server_toolkits`**
```sql
CREATE TABLE server_toolkits (
  server_id   UUID PRIMARY KEY REFERENCES servers(id) ON DELETE CASCADE,
  toolkit_id  TEXT NOT NULL DEFAULT 'dnd',
  activated_by UUID NOT NULL REFERENCES profiles(id),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**`dnd_characters`**
```sql
CREATE TABLE dnd_characters (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id         UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source            TEXT NOT NULL CHECK (source IN ('dndbeyond', 'manual')),
  dndb_character_id TEXT,
  dndb_character_url TEXT,
  name              TEXT NOT NULL,
  race              TEXT NOT NULL DEFAULT '',
  class             TEXT NOT NULL DEFAULT '',
  level             INTEGER NOT NULL DEFAULT 1,
  portrait_url      TEXT,
  hp_current        INTEGER NOT NULL DEFAULT 0,
  hp_max            INTEGER NOT NULL DEFAULT 0,
  xp_current        INTEGER NOT NULL DEFAULT 0,
  xp_max            INTEGER NOT NULL DEFAULT 0,
  gold              INTEGER,
  stats             JSONB,
  armor_class       INTEGER,
  initiative        INTEGER,
  proficiency_bonus INTEGER,
  traits            TEXT[],
  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (server_id, user_id)
);
```

**`dnd_dm_notes`**
```sql
CREATE TABLE dnd_dm_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Untitled',
  content    TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**`dnd_maps`**
```sql
CREATE TABLE dnd_maps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  image_url  TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**`dnd_map_pins`**
```sql
CREATE TABLE dnd_map_pins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id      UUID NOT NULL REFERENCES dnd_maps(id) ON DELETE CASCADE,
  x           DOUBLE PRECISION NOT NULL,
  y           DOUBLE PRECISION NOT NULL,
  label       TEXT NOT NULL,
  description TEXT,
  icon        TEXT NOT NULL DEFAULT '📍',
  pinned_by   UUID NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**`dnd_quests`**
```sql
CREATE TABLE dnd_quests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id        UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  is_secret        BOOLEAN NOT NULL DEFAULT false,
  secret_player_ids UUID[] NOT NULL DEFAULT '{}',
  is_completed     BOOLEAN NOT NULL DEFAULT false,
  completed_at     TIMESTAMPTZ,
  created_by       UUID NOT NULL REFERENCES profiles(id),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Altered Table

**`server_role_permissions`** — add column:
```sql
ALTER TABLE server_role_permissions
  ADD COLUMN dungeon_master BOOLEAN NOT NULL DEFAULT false;
```

### Storage

New Supabase Storage bucket: `dnd-assets` (public read, authenticated write) for character portraits and map images.

### RLS Policies

- **`server_toolkits`**: Server members can read; owner can insert/delete.
- **`dnd_characters`**: Server members can read all characters for their server; users can insert/update their own character; DMs can update any character (for HP adjustments during sessions).
- **`dnd_dm_notes`**: Only users with `dungeon_master` permission can read/write.
- **`dnd_maps`**: Server members can read; DMs can insert/update/delete.
- **`dnd_map_pins`**: Server members can read; DMs can insert/update/delete.
- **`dnd_quests`**: Server members can read public quests; secret quests readable by DMs and users whose ID is in `secret_player_ids`; DMs can insert/update/delete all quests.

### Realtime

Add to `supabase_realtime` publication with `REPLICA IDENTITY FULL`:
- `dnd_characters` — live HP/XP updates visible to party
- `dnd_map_pins` — DM places pin, everyone sees it
- `dnd_quests` — quest completion syncs to all

---

## Component Architecture

### New Files

```
src/components/servers/toolkits/
  ToolkitTab.tsx            — Settings tab showing available toolkits
  ToolkitInfoModal.tsx      — 6-page documentation popup
  DndThemeProvider.tsx       — Applies --tk-* CSS variables when toolkit active
  DndTabBar.tsx             — Horizontal tab navigation (Bubbles, Characters, etc.)

src/components/servers/dnd/
  CharacterGrid.tsx         — Characters tab — grid of all linked characters
  CharacterCard.tsx         — Compact sidebar card (HP/XP bars)
  CharacterSheet.tsx        — Expanded popup (stats, traits, full detail)
  CharacterLinkFlow.tsx     — D&D Beyond link or manual creation wizard
  ManualCharacterForm.tsx   — Form for manual character entry
  WorldMap.tsx              — Map viewer with zoom/pan
  MapPinEditor.tsx          — Pin creation/edit form (DM only)
  MapPinDetail.tsx          — Pin detail popup
  QuestLog.tsx              — Quest list with sections (active/completed)
  QuestCard.tsx             — Individual quest with completion toggle
  QuestForm.tsx             — Quest creation/edit form (DM only)
  DmNotebook.tsx            — Note list + editor (DM only)
  DmNoteCard.tsx            — Individual note card
  DiceRollMessage.tsx       — Styled dice roll renderer for chat
```

### Modified Files

```
src/components/servers/ServerSettings.tsx   — Add "Toolkits" tab
src/components/servers/ServerView.tsx       — Integrate DndTabBar + tab routing
src/components/servers/BubbleChat.tsx       — Character cards in member sidebar, /roll command parsing
src/components/servers/MemberList.tsx       — Show character info when toolkit active
src/components/call/GroupCallView.tsx       — Character tiles during calls
src/store/serverStore.ts                   — Load toolkit state, expose `activeToolkit`
src/store/serverRoleStore.ts               — Handle `dungeon_master` permission
```

### New Store

```
src/store/dndStore.ts — Zustand store for DnD toolkit state:
  - characters: DndCharacter[]
  - quests: DndQuest[]
  - maps: DndMap[]
  - activePins: DndMapPin[]
  - dmNotes: DndDmNote[]
  - loadCharacters(serverId), loadQuests(serverId), etc.
  - CRUD actions for each entity
  - Realtime subscriptions
```
