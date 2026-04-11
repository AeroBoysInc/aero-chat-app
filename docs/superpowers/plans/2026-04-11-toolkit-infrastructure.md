# Toolkit Infrastructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation for server toolkits — the activation system, DM permission, themed CSS variables, tab navigation, and the "More Info" documentation popup — so that sub-projects 2–6 (Character Cards, World Map, Quests, DM Notebook, Dice Roller) can be built on top of it.

**Architecture:** A new `server_toolkits` table tracks which servers have which toolkit active. A `dungeon_master` boolean column is added to `server_role_permissions`. The server view gains a horizontal tab bar (only visible when a toolkit is active) and a `DndThemeProvider` wrapper that injects `--tk-*` CSS variables scoped to the active theme. The "Toolkits" settings tab shows available toolkits with activate/deactivate + "More Info" documentation popup.

**Tech Stack:** React 19, Zustand, Supabase (PostgreSQL + RLS), TypeScript, Tailwind CSS custom properties.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/032_toolkits.sql` | Database: `server_toolkits` table, `dungeon_master` column, RLS policies |
| `src/components/servers/toolkits/ToolkitTab.tsx` | Settings tab — shows toolkit cards, activate/deactivate buttons |
| `src/components/servers/toolkits/ToolkitInfoModal.tsx` | 6-page paginated documentation popup |
| `src/components/servers/toolkits/DndThemeProvider.tsx` | Wrapper that injects `--tk-*` CSS variables based on active theme |
| `src/components/servers/toolkits/DndTabBar.tsx` | Horizontal tab bar: Bubbles / Characters / World Map / Quests / DM Notes |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/serverTypes.ts` | Add `dungeon_master` to `ServerRolePermissions`, add `ServerToolkit` interface |
| `src/store/serverRoleStore.ts` | Add `dungeon_master` to `DEFAULT_PERMS` |
| `src/store/serverStore.ts` | Add `activeToolkit` state, fetch from `server_toolkits` in `loadServerData` |
| `src/components/servers/RoleEditor.tsx` | Add `dungeon_master` to `PERM_LABELS` |
| `src/components/servers/ServerSettings.tsx` | Add "Toolkits" tab |
| `src/components/servers/ServerView.tsx` | Integrate `DndThemeProvider`, `DndTabBar`, header gold ring |
| `src/components/servers/CreateServerWizard.tsx` | Add `dungeon_master: true` to Owner role permissions insert |
| `src/index.css` | No changes — toolkit CSS vars are injected inline by `DndThemeProvider` |

---

### Task 1: Database Migration — `server_toolkits` Table + `dungeon_master` Permission

**Files:**
- Create: `supabase/migrations/032_toolkits.sql`

This migration creates the `server_toolkits` table and adds the `dungeon_master` boolean column to `server_role_permissions`. It must be run in the Supabase SQL editor.

- [ ] **Step 1: Write the migration SQL**

```sql
-- 032_toolkits.sql — Server toolkit activation + DM permission

-- ── 1. Toolkit activation table ──
CREATE TABLE server_toolkits (
  server_id    UUID PRIMARY KEY REFERENCES servers(id) ON DELETE CASCADE,
  toolkit_id   TEXT NOT NULL DEFAULT 'dnd',
  activated_by UUID NOT NULL REFERENCES profiles(id),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE server_toolkits ENABLE ROW LEVEL SECURITY;

-- Members of the server can read toolkit state
CREATE POLICY "toolkit_select" ON server_toolkits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM server_members
      WHERE server_members.server_id = server_toolkits.server_id
        AND server_members.user_id = auth.uid()
    )
  );

-- Only the server owner can activate a toolkit
CREATE POLICY "toolkit_insert" ON server_toolkits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM servers
      WHERE servers.id = server_toolkits.server_id
        AND servers.owner_id = auth.uid()
    )
  );

-- Only the server owner can deactivate a toolkit
CREATE POLICY "toolkit_delete" ON server_toolkits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM servers
      WHERE servers.id = server_toolkits.server_id
        AND servers.owner_id = auth.uid()
    )
  );

-- ── 2. Add dungeon_master permission to server roles ──
ALTER TABLE server_role_permissions
  ADD COLUMN dungeon_master BOOLEAN NOT NULL DEFAULT false;
```

Create the file:

```bash
# File: supabase/migrations/032_toolkits.sql
```

- [ ] **Step 2: Verify the SQL file is well-formed**

Run: `cat supabase/migrations/032_toolkits.sql`

Expected: The complete SQL above, no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/032_toolkits.sql
git commit -m "feat(db): add server_toolkits table and dungeon_master permission"
```

> **Note:** This migration must be run in the Supabase SQL editor before testing. The user will do this manually.

---

### Task 2: Type Definitions — `ServerToolkit` Interface + `dungeon_master` Permission

**Files:**
- Modify: `src/lib/serverTypes.ts:25-35,90`

- [ ] **Step 1: Add `dungeon_master` to `ServerRolePermissions`**

In `src/lib/serverTypes.ts`, add `dungeon_master: boolean;` after `start_calls: boolean;` (line 34):

```typescript
export interface ServerRolePermissions {
  role_id: string;
  manage_server: boolean;
  manage_roles: boolean;
  manage_bubbles: boolean;
  manage_members: boolean;
  send_invites: boolean;
  send_messages: boolean;
  pin_messages: boolean;
  start_calls: boolean;
  dungeon_master: boolean;
}
```

- [ ] **Step 2: Add `ServerToolkit` interface**

After the `ServerInvite` interface (after line 88), add:

```typescript
export interface ServerToolkit {
  server_id: string;
  toolkit_id: string;
  activated_by: string;
  activated_at: string;
}
```

- [ ] **Step 3: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: Build should fail — `DEFAULT_PERMS` in `serverRoleStore.ts` is missing `dungeon_master`. This is expected and fixed in the next step.

- [ ] **Step 4: Commit**

```bash
git add src/lib/serverTypes.ts
git commit -m "feat(types): add ServerToolkit interface and dungeon_master permission"
```

---

### Task 3: Store Updates — Default Perms, Toolkit State, Role Label

**Files:**
- Modify: `src/store/serverRoleStore.ts:18-23`
- Modify: `src/store/serverStore.ts:48-78,99-110`
- Modify: `src/components/servers/RoleEditor.tsx:10-16`
- Modify: `src/components/servers/CreateServerWizard.tsx:88-93,103-108`

- [ ] **Step 1: Add `dungeon_master` to `DEFAULT_PERMS` in serverRoleStore.ts**

In `src/store/serverRoleStore.ts`, update `DEFAULT_PERMS` (line 18-23):

```typescript
const DEFAULT_PERMS: ServerRolePermissions = {
  role_id: '',
  manage_server: false, manage_roles: false, manage_bubbles: false,
  manage_members: false, send_invites: false, send_messages: false,
  pin_messages: false, start_calls: false, dungeon_master: false,
};
```

- [ ] **Step 2: Add `dungeon_master` to RoleEditor PERM_LABELS**

In `src/components/servers/RoleEditor.tsx`, update the `PERM_LABELS` object (line 10):

```typescript
const PERM_LABELS: Record<PermissionKey, string> = {
  manage_server: 'Manage Server',
  manage_roles: 'Manage Roles',
  manage_bubbles: 'Manage Bubbles',
  manage_members: 'Manage Members',
  send_invites: 'Send Invites',
  send_messages: 'Send Messages',
  pin_messages: 'Pin Messages',
  start_calls: 'Start Calls',
  dungeon_master: 'Dungeon Master',
};
```

- [ ] **Step 3: Add `dungeon_master: true` to Owner role creation in CreateServerWizard.tsx**

In `src/components/servers/CreateServerWizard.tsx`, update the Owner role permissions insert (lines 88-93):

```typescript
      await supabase.from('server_role_permissions').insert({
        role_id: ownerRole.id,
        manage_server: true, manage_roles: true, manage_bubbles: true,
        manage_members: true, send_invites: true, send_messages: true,
        pin_messages: true, start_calls: true, dungeon_master: true,
      });
```

And the Member role permissions insert (lines 103-108):

```typescript
      await supabase.from('server_role_permissions').insert({
        role_id: memberRole.id,
        manage_server: false, manage_roles: false, manage_bubbles: false,
        manage_members: false, send_invites: false, send_messages: true,
        pin_messages: false, start_calls: true, dungeon_master: false,
      });
```

- [ ] **Step 4: Add `activeToolkit` to serverStore**

In `src/store/serverStore.ts`, add to the `ServerStoreState` interface (after line 58):

```typescript
  /** Active toolkit for the selected server (null if none) */
  activeToolkit: ServerToolkit | null;
```

Add the import at the top of the file (line 5):

```typescript
import type { Server, ServerMember, Bubble, ServerToolkit } from '../lib/serverTypes';
```

Add initial value (after line 89):

```typescript
  activeToolkit: null,
```

Update `loadServerData` to also fetch the toolkit (modify lines 99-110). Add a third parallel fetch:

```typescript
  loadServerData: async (serverId) => {
    const [membersRes, bubblesRes, toolkitRes] = await Promise.all([
      supabase
        .from('server_members')
        .select('*, profiles:user_id(username, avatar_url, status, card_gradient, card_image_url, card_image_params, bio, custom_status_text, custom_status_emoji, accent_color, accent_color_secondary, banner_gradient, banner_image_url, card_effect, avatar_gif_url, name_effect)')
        .eq('server_id', serverId),
      supabase
        .from('bubbles')
        .select('*')
        .eq('server_id', serverId)
        .order('created_at', { ascending: true }),
      supabase
        .from('server_toolkits')
        .select('*')
        .eq('server_id', serverId)
        .maybeSingle(),
    ]);
```

And at the end of `loadServerData` where `set()` is called, add `activeToolkit`:

```typescript
    set({ members, bubbles: bubblesRes.data ?? [], activeToolkit: toolkitRes.data ?? null });
```

Also add `activeToolkit: null` to the `reset` method.

- [ ] **Step 5: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: `✓ built in Xs` — no errors.

- [ ] **Step 6: Commit**

```bash
git add src/store/serverRoleStore.ts src/store/serverStore.ts src/components/servers/RoleEditor.tsx src/components/servers/CreateServerWizard.tsx
git commit -m "feat: add dungeon_master permission and activeToolkit state"
```

---

### Task 4: DndThemeProvider — CSS Variable Injection

**Files:**
- Create: `src/components/servers/toolkits/DndThemeProvider.tsx`

This component wraps the server view content and injects `--tk-*` CSS variables as inline styles when a toolkit is active. It reads the current theme from `themeStore` to adapt the palette.

- [ ] **Step 1: Create the DndThemeProvider component**

```typescript
// src/components/servers/toolkits/DndThemeProvider.tsx
import { memo, type ReactNode } from 'react';
import { useThemeStore } from '../../../store/themeStore';
import { useServerStore } from '../../../store/serverStore';

const DAY_VARS: Record<string, string> = {
  '--tk-accent': '#8B4513',
  '--tk-accent-light': '#D2691E',
  '--tk-accent-glow': 'rgba(210,105,30,0.15)',
  '--tk-gold': '#B8860B',
  '--tk-text': '#4a3520',
  '--tk-text-muted': 'rgba(74,53,32,0.45)',
  '--tk-border': 'rgba(139,69,19,0.15)',
  '--tk-panel': 'rgba(139,69,19,0.06)',
};

const NIGHT_VARS: Record<string, string> = {
  '--tk-accent': '#D2691E',
  '--tk-accent-light': '#E8944C',
  '--tk-accent-glow': 'rgba(210,105,30,0.20)',
  '--tk-gold': '#FFD700',
  '--tk-text': '#e8d5b0',
  '--tk-text-muted': 'rgba(232,213,176,0.40)',
  '--tk-border': 'rgba(139,69,19,0.20)',
  '--tk-panel': 'rgba(139,69,19,0.06)',
};

// Ultra/premium themes — derive from night base with per-theme tweaks
const GOLDEN_HOUR_VARS: Record<string, string> = {
  ...NIGHT_VARS,
  '--tk-accent': '#C4751B',
  '--tk-accent-light': '#E8944C',
  '--tk-gold': '#FFBF00',
};

const JOHN_FRUTIGER_VARS: Record<string, string> = {
  ...NIGHT_VARS,
  '--tk-accent': '#B87333',
  '--tk-accent-light': '#CD853F',
  '--tk-gold': '#DAA520',
};

function getVarsForTheme(theme: string): Record<string, string> {
  if (theme === 'day') return DAY_VARS;
  if (theme === 'golden-hour') return GOLDEN_HOUR_VARS;
  if (theme === 'john-frutiger') return JOHN_FRUTIGER_VARS;
  // night, ocean, sunset, aurora, sakura, master — all use the night palette
  return NIGHT_VARS;
}

export const DndThemeProvider = memo(function DndThemeProvider({ children }: { children: ReactNode }) {
  const toolkit = useServerStore(s => s.activeToolkit);
  const theme = useThemeStore(s => s.theme);

  if (!toolkit) return <>{children}</>;

  const vars = getVarsForTheme(theme);

  return (
    <div style={vars as React.CSSProperties} className="contents">
      {children}
    </div>
  );
});
```

- [ ] **Step 2: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: `✓ built in Xs` — no errors (component is created but not imported yet).

- [ ] **Step 3: Commit**

```bash
git add src/components/servers/toolkits/DndThemeProvider.tsx
git commit -m "feat: add DndThemeProvider for toolkit CSS variable injection"
```

---

### Task 5: DndTabBar — Toolkit Navigation Tabs

**Files:**
- Create: `src/components/servers/toolkits/DndTabBar.tsx`

The tab bar shows when a toolkit is active. It sits between the server header and the content area. For now, only "Bubbles" is functional — the other tabs show "Coming soon" placeholders.

- [ ] **Step 1: Create the DndTabBar component**

```typescript
// src/components/servers/toolkits/DndTabBar.tsx
import { memo } from 'react';
import { useServerRoleStore } from '../../../store/serverRoleStore';
import { useServerStore } from '../../../store/serverStore';
import { useAuthStore } from '../../../store/authStore';

export type DndTab = 'bubbles' | 'characters' | 'worldmap' | 'quests' | 'dm-notes';

const TAB_ITEMS: { id: DndTab; label: string; icon: string; dmOnly?: boolean }[] = [
  { id: 'bubbles',    label: 'Bubbles',    icon: '💬' },
  { id: 'characters', label: 'Characters', icon: '🃏' },
  { id: 'worldmap',   label: 'World Map',  icon: '🗺️' },
  { id: 'quests',     label: 'Quests',     icon: '📜' },
  { id: 'dm-notes',   label: 'DM Notes',   icon: '📖', dmOnly: true },
];

export const DndTabBar = memo(function DndTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: DndTab;
  onTabChange: (tab: DndTab) => void;
}) {
  const user = useAuthStore(s => s.user);
  const { selectedServerId, members } = useServerStore();
  const { hasPermission } = useServerRoleStore();

  const isDm = user && selectedServerId
    ? hasPermission(selectedServerId, user.id, members, 'dungeon_master')
    : false;

  const visibleTabs = TAB_ITEMS.filter(t => !t.dmOnly || isDm);

  return (
    <div
      className="flex gap-1 px-3 py-1.5 flex-shrink-0 overflow-x-auto scrollbar-none"
      style={{ borderBottom: '1px solid var(--tk-border, var(--panel-divider))' }}
    >
      {visibleTabs.map(t => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap"
          style={{
            background: activeTab === t.id ? 'var(--tk-accent-glow, rgba(0,212,255,0.12))' : 'transparent',
            color: activeTab === t.id ? 'var(--tk-accent-light, #00d4ff)' : 'var(--tk-text-muted, var(--text-muted))',
            border: activeTab === t.id ? '1px solid var(--tk-border, rgba(0,212,255,0.2))' : '1px solid transparent',
          }}
        >
          <span style={{ fontSize: 13 }}>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
});
```

- [ ] **Step 2: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: `✓ built in Xs` — no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/servers/toolkits/DndTabBar.tsx
git commit -m "feat: add DndTabBar for toolkit navigation"
```

---

### Task 6: ToolkitInfoModal — 6-Page Documentation Popup

**Files:**
- Create: `src/components/servers/toolkits/ToolkitInfoModal.tsx`

A modal with 6 pages the user can navigate through. Each page describes one feature of the Dungeons & Servers toolkit.

- [ ] **Step 1: Create the ToolkitInfoModal component**

```typescript
// src/components/servers/toolkits/ToolkitInfoModal.tsx
import { memo, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGES = [
  {
    title: 'Welcome to Dungeons & Servers',
    subtitle: 'Your complete DnD campaign management toolkit',
    icon: '⚔️',
    features: [
      { icon: '🃏', name: 'Character Cards', desc: 'D&D Beyond sync' },
      { icon: '🗺️', name: 'World Map', desc: 'Pin locations live' },
      { icon: '📜', name: 'Quest Log', desc: 'Track & cross off' },
      { icon: '🎲', name: 'Dice Roller', desc: '/roll in chat' },
      { icon: '📖', name: 'DM Notebook', desc: 'Medieval-styled notes' },
      { icon: '🎨', name: 'Themed UI', desc: 'Medieval accents' },
    ],
  },
  {
    title: 'Character Cards',
    subtitle: 'Link your D&D Beyond character or create a manual card',
    icon: '🃏',
    body: 'Each server member can link their D&D Beyond character by pasting their share URL. The toolkit pulls stats, HP, XP, class, race, portrait, and more. Characters appear as cards in the sidebar with live HP and XP bars.\n\nIf you use another platform (Foundry VTT, Roll20), you can create a manual tracking card with basic info: portrait, name, class, level, HP, XP, and gold.',
  },
  {
    title: 'World Map',
    subtitle: 'Upload maps and pin locations in real-time',
    icon: '🗺️',
    body: 'The DM uploads a map image (hand-drawn, generated, or found). Click anywhere to drop a pin with a name, description, and icon. All players see pins appear in real-time.\n\nSupports zoom and pan. Multiple maps per server — switch between continent maps, city maps, or dungeon layouts. Pins scale correctly at any zoom level.',
  },
  {
    title: 'Quest Log',
    subtitle: 'Track party objectives and secret side quests',
    icon: '📜',
    body: 'The DM creates quests that appear in a shared quest log. Public quests are visible to the whole party. Secret quests can be assigned to specific players — only they (and the DM) can see them.\n\nCompleted quests get crossed off with a satisfying animation and move to a "Completed" section. Reorder quests by dragging.',
  },
  {
    title: 'Dice & Chat',
    subtitle: 'Roll dice directly in chat with /roll',
    icon: '🎲',
    body: 'Type /roll 2d6+3 in any bubble chat to roll dice. Results appear as styled blocks with color-coded numbers — red for low rolls, green for high, with a smooth gradient between.\n\nNatural 1s glow red with a "NAT 1!" badge. Natural 20s glow green with a "NAT 20!" badge. The total is displayed large and bold.',
  },
  {
    title: 'DM Tools & Setup',
    subtitle: 'How to get started as the Dungeon Master',
    icon: '📖',
    body: 'The server owner automatically becomes the DM. You can grant the "Dungeon Master" permission to other roles via Server Settings → Roles.\n\nDM-only features: DM Notebook for private session notes, World Map pin placement, Quest creation and management, and the ability to update any character\'s HP during sessions.\n\nTo get started: activate the toolkit, ask your players to link their D&D Beyond characters, upload a world map, and create your first quest!',
  },
];

export const ToolkitInfoModal = memo(function ToolkitInfoModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const current = PAGES[page];

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 520, maxHeight: '85vh', borderRadius: 20, overflow: 'hidden',
          background: 'var(--sidebar-bg)', border: '1px solid var(--tk-border, var(--panel-divider))',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--tk-border, var(--panel-divider))' }}>
          <div className="flex items-center gap-2.5">
            <span style={{ fontSize: 18 }}>🐉</span>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--tk-text, var(--text-primary))' }}>Dungeons & Servers</span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Page dots */}
        <div className="flex justify-center gap-1.5 py-2.5">
          {PAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              style={{
                width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
                background: i === page ? 'var(--tk-accent-light, #00d4ff)' : 'var(--tk-border, rgba(255,255,255,0.12))',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-5">
          <div className="text-center mb-5">
            <div style={{ fontSize: 44, marginBottom: 6 }}>{current.icon}</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--tk-text, var(--text-primary))', margin: '0 0 4px' }}>{current.title}</h3>
            <p style={{ fontSize: 12, color: 'var(--tk-text-muted, var(--text-muted))', margin: 0 }}>{current.subtitle}</p>
          </div>

          {/* Page 0 — feature grid */}
          {current.features && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {current.features.map(f => (
                <div key={f.name} style={{
                  padding: 14, borderRadius: 12,
                  background: 'var(--tk-panel, rgba(0,180,255,0.06))',
                  border: '1px solid var(--tk-border, var(--panel-divider))',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{f.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tk-text, var(--text-primary))' }}>{f.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))', marginTop: 2 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          )}

          {/* Pages 1–5 — text body */}
          {current.body && (
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--tk-text-muted, var(--text-secondary))', whiteSpace: 'pre-line' }}>
              {current.body}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--tk-border, var(--panel-divider))' }}>
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0}
            className="flex items-center gap-1 text-xs font-medium transition-opacity disabled:opacity-30"
            style={{ color: 'var(--tk-text-muted, var(--text-muted))', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </button>
          <span style={{ fontSize: 10, color: 'var(--tk-text-muted, var(--text-muted))' }}>
            {page + 1} of {PAGES.length}
          </span>
          {page < PAGES.length - 1 ? (
            <button
              onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: 'var(--tk-accent-glow, rgba(0,212,255,0.15))',
                color: 'var(--tk-accent-light, #00d4ff)',
                border: '1px solid var(--tk-border, rgba(0,212,255,0.2))',
                cursor: 'pointer',
              }}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: 'var(--tk-accent-glow, rgba(0,212,255,0.15))',
                color: 'var(--tk-accent-light, #00d4ff)',
                border: '1px solid var(--tk-border, rgba(0,212,255,0.2))',
                cursor: 'pointer',
              }}
            >
              Got it!
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: `✓ built in Xs` — no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/servers/toolkits/ToolkitInfoModal.tsx
git commit -m "feat: add ToolkitInfoModal — 6-page documentation popup"
```

---

### Task 7: ToolkitTab — Settings Tab with Activate/Deactivate

**Files:**
- Create: `src/components/servers/toolkits/ToolkitTab.tsx`

This is the content component rendered when the user clicks the "Toolkits" tab in ServerSettings. Shows the Dungeons & Servers toolkit card with "More Info" and "Activate/Deactivate" buttons.

- [ ] **Step 1: Create the ToolkitTab component**

```typescript
// src/components/servers/toolkits/ToolkitTab.tsx
import { memo, useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { useServerStore } from '../../../store/serverStore';
import { useServerRoleStore } from '../../../store/serverRoleStore';
import { supabase } from '../../../lib/supabase';
import { ToolkitInfoModal } from './ToolkitInfoModal';

export const ToolkitTab = memo(function ToolkitTab() {
  const user = useAuthStore(s => s.user);
  const { selectedServerId, servers, activeToolkit, loadServerData } = useServerStore();
  const { roles, loadRoles } = useServerRoleStore();
  const [infoOpen, setInfoOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const server = servers.find(s => s.id === selectedServerId);
  const isOwner = server?.owner_id === user?.id;
  const isPremium = user?.is_premium === true;
  const isActive = !!activeToolkit;

  const handleActivate = async () => {
    if (!selectedServerId || !user || !isOwner || !isPremium) return;
    setLoading(true);
    try {
      // 1. Insert toolkit activation
      await supabase.from('server_toolkits').insert({
        server_id: selectedServerId,
        toolkit_id: 'dnd',
        activated_by: user.id,
      });

      // 2. Grant dungeon_master to Owner role
      const ownerRole = roles.find(r => r.is_owner_role);
      if (ownerRole) {
        await supabase.from('server_role_permissions')
          .update({ dungeon_master: true })
          .eq('role_id', ownerRole.id);
      }

      // 3. Refresh data
      await Promise.all([loadServerData(selectedServerId), loadRoles(selectedServerId)]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedServerId || !isOwner) return;
    setLoading(true);
    try {
      await supabase.from('server_toolkits')
        .delete()
        .eq('server_id', selectedServerId);
      await loadServerData(selectedServerId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
        Toolkits transform your server with specialized features. Premium server owners can activate them for free — all members benefit.
      </p>

      {/* Dungeons & Servers card */}
      <div style={{
        padding: 20, borderRadius: 16, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(145deg, rgba(139,69,19,0.10), rgba(255,215,0,0.05))',
        border: '1px solid rgba(139,69,19,0.20)',
      }}>
        {/* Decorative icon */}
        <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.05, pointerEvents: 'none' }}>⚔️</div>

        <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, #8B4513, #D2691E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>🐉</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>Dungeons & Servers</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>DnD Campaign Toolkit</div>
          </div>
          {isActive ? (
            <span style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
              background: 'rgba(76,175,80,0.15)', color: '#4CAF50', border: '1px solid rgba(76,175,80,0.25)',
            }}>ACTIVE</span>
          ) : (
            <span style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
              background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,165,0,0.10))',
              color: '#FFD700', border: '1px solid rgba(255,215,0,0.25)',
            }}>PREMIUM</span>
          )}
        </div>

        <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Transform your server into a DnD campaign hub. Character cards from D&D Beyond, interactive world maps, quest tracking, dice rolls, and DM tools — all wrapped in a medieval-accented UI.
        </p>

        {/* Feature tags */}
        <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 16 }}>
          {['Character Cards', 'World Map', 'Quest Log', 'Dice Roller', 'DM Notebook'].map(tag => (
            <span key={tag} style={{
              padding: '2px 8px', borderRadius: 6, fontSize: 10,
              background: 'rgba(139,69,19,0.08)', border: '1px solid rgba(139,69,19,0.15)',
              color: 'var(--text-muted)',
            }}>{tag}</span>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-2.5">
          <button
            onClick={() => setInfoOpen(true)}
            className="flex-1 transition-all active:scale-[0.98]"
            style={{
              padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'rgba(139,69,19,0.06)',
              border: '1px solid rgba(139,69,19,0.20)',
              color: 'var(--text-secondary)',
            }}
          >
            More Info
          </button>
          {isOwner && isPremium && !isActive && (
            <button
              onClick={handleActivate}
              disabled={loading}
              className="flex-1 transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: 'linear-gradient(135deg, #8B4513, #D2691E)',
                border: 'none', color: '#fff',
              }}
            >
              {loading ? 'Activating…' : 'Activate Toolkit'}
            </button>
          )}
          {isOwner && isActive && (
            <button
              onClick={handleDeactivate}
              disabled={loading}
              className="flex-1 transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: 'rgba(220,60,60,0.08)',
                border: '1px solid rgba(220,60,60,0.20)',
                color: '#cc4444',
              }}
            >
              {loading ? 'Deactivating…' : 'Deactivate'}
            </button>
          )}
          {isOwner && !isPremium && (
            <button
              className="flex-1"
              style={{
                padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'not-allowed',
                background: 'rgba(139,69,19,0.08)', border: '1px solid rgba(139,69,19,0.12)',
                color: 'var(--text-muted)', opacity: 0.6,
              }}
              disabled
            >
              Requires Aero+
            </button>
          )}
          {!isOwner && !isActive && (
            <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
              Only the server owner can activate toolkits
            </span>
          )}
        </div>
      </div>

      {infoOpen && <ToolkitInfoModal onClose={() => setInfoOpen(false)} />}
    </div>
  );
});
```

- [ ] **Step 2: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: `✓ built in Xs` — no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/servers/toolkits/ToolkitTab.tsx
git commit -m "feat: add ToolkitTab — settings tab for toolkit activation"
```

---

### Task 8: Wire Into ServerSettings — Add "Toolkits" Tab

**Files:**
- Modify: `src/components/servers/ServerSettings.tsx:1-77`

- [ ] **Step 1: Add the Toolkits tab to ServerSettings**

In `src/components/servers/ServerSettings.tsx`:

1. Update the Tab type (line 13):
```typescript
type Tab = 'roles' | 'members' | 'bubbles' | 'invites' | 'events' | 'toolkits';
```

2. Add import (after line 11):
```typescript
import { ToolkitTab } from './toolkits/ToolkitTab';
```

3. Add to the tabs array (after line 35, before the closing `];`):
```typescript
    { id: 'toolkits', label: '✦ Toolkits', show: true },
```

4. Add to the content render section (after line 76):
```typescript
          {tab === 'toolkits' && <ToolkitTab />}
```

- [ ] **Step 2: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: `✓ built in Xs` — no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/servers/ServerSettings.tsx
git commit -m "feat: wire ToolkitTab into ServerSettings"
```

---

### Task 9: Wire Into ServerView — DndThemeProvider, DndTabBar, Header Gold Ring

**Files:**
- Modify: `src/components/servers/ServerView.tsx`

This is the final integration task. It wraps the server view in `DndThemeProvider`, adds the `DndTabBar` between header and content when a toolkit is active, and adds the gold ring to the server icon. The tab bar controls which content area is shown — "bubbles" shows the existing BubbleHub/BubbleChat slide, other tabs show a "Coming soon" placeholder.

- [ ] **Step 1: Update ServerView imports and state**

Add imports at the top of `src/components/servers/ServerView.tsx` (after line 14):

```typescript
import { DndThemeProvider } from './toolkits/DndThemeProvider';
import { DndTabBar, type DndTab } from './toolkits/DndTabBar';
```

Add state for the active DnD tab (after line 22):

```typescript
  const [dndTab, setDndTab] = useState<DndTab>('bubbles');
```

Add a selector for the active toolkit (after line 24):

```typescript
  const activeToolkit = useServerStore(s => s.activeToolkit);
```

- [ ] **Step 2: Wrap the return JSX in DndThemeProvider**

Change the opening `return (` (line 40) to wrap everything in `DndThemeProvider`:

```typescript
  return (
    <DndThemeProvider>
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'var(--chat-bg)' }}>
```

And add the closing `</DndThemeProvider>` right before the final `);` — after the last `</div>` of the component (before line 263's `);`).

- [ ] **Step 3: Add gold ring to server icon when toolkit active**

Modify the server icon `<div>` (lines 79-86). Add a gold border when toolkit is active:

```typescript
          <div style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            background: server.icon_url ? `url(${server.icon_url}) center/cover` : 'linear-gradient(135deg, var(--sent-bubble-bg), var(--input-focus-border))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: 'white',
            ...(activeToolkit ? { border: '2px solid var(--tk-gold, transparent)', boxShadow: '0 0 8px var(--tk-accent-glow, transparent)' } : {}),
          }}>
            {!server.icon_url && initial}
          </div>
```

- [ ] **Step 4: Add DndTabBar between header and content**

After the header wrapper closing `</div>` (line 129) and before the content area (line 131), insert the tab bar:

```typescript
      {/* DnD toolkit tab bar — only visible when toolkit is active */}
      {activeToolkit && (
        <DndTabBar activeTab={dndTab} onTabChange={setDndTab} />
      )}
```

- [ ] **Step 5: Conditionally render content based on active DnD tab**

Replace the content area (lines 131-152) with logic that shows the bubble hub/chat when `dndTab === 'bubbles'`, or a placeholder for other tabs:

```typescript
      {/* Content — bubble view or toolkit tab content */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {(!activeToolkit || dndTab === 'bubbles') ? (
          <>
            {/* Both layers always rendered, positioned via translateX */}
            <div
              className="absolute inset-0"
              style={{
                transform: inBubble ? 'translateX(-100%)' : 'translateX(0)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <BubbleHub />
            </div>
            <div
              className="absolute inset-0"
              style={{
                transform: inBubble ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {selectedBubbleId && <BubbleChat />}
            </div>
          </>
        ) : (
          /* Toolkit tab placeholder — sub-projects 2–6 will replace these */
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div style={{ fontSize: 48, marginBottom: 8, opacity: 0.3 }}>
                {dndTab === 'characters' ? '🃏' : dndTab === 'worldmap' ? '🗺️' : dndTab === 'quests' ? '📜' : '📖'}
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tk-text, var(--text-primary))', marginBottom: 4 }}>
                {dndTab === 'characters' ? 'Characters' : dndTab === 'worldmap' ? 'World Map' : dndTab === 'quests' ? 'Quests' : 'DM Notes'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--tk-text-muted, var(--text-muted))' }}>Coming soon</p>
            </div>
          </div>
        )}
      </div>
```

- [ ] **Step 6: Reset dndTab when switching servers or exiting**

Add an effect to reset the tab when the selected server changes (after the existing `useEffect` on line 26):

```typescript
  // Reset DnD tab when switching servers
  useEffect(() => { setDndTab('bubbles'); }, [selectedServerId]);
```

- [ ] **Step 7: Build check**

Run: `cd aero-chat-app && pnpm build 2>&1 | tail -5`

Expected: `✓ built in Xs` — no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/servers/ServerView.tsx
git commit -m "feat: integrate DndThemeProvider, DndTabBar, and header gold ring into ServerView"
```

---

## Verification Checklist

After all tasks are complete and the migration has been run in Supabase:

1. **Settings tab** — Open a server's settings. A "✦ Toolkits" tab should appear. The Dungeons & Servers card should show with "More Info" and "Activate Toolkit" buttons (for premium owners).
2. **More Info modal** — Click "More Info". A 6-page popup should appear. Navigate through all pages with dots and arrows. Close it.
3. **Activation** — Click "Activate Toolkit". The card should show "ACTIVE" badge and a "Deactivate" button. 
4. **Tab bar** — Close settings. A tab bar should appear below the server header with Bubbles, Characters, World Map, Quests, and (for DMs) DM Notes.
5. **Theme adaptation** — Switch between Day and Night themes. The medieval accents should shift (warm browns for day, amber/copper for night).
6. **Gold ring** — The server icon in the header should have a subtle gold ring border.
7. **Placeholder tabs** — Click Characters, World Map, Quests, DM Notes. Each should show a "Coming soon" placeholder with the correct icon.
8. **Bubbles still work** — Click "Bubbles" tab. Enter/exit a bubble. Chat should work as before.
9. **Deactivation** — Open settings → Toolkits → "Deactivate". Tab bar should disappear. Server returns to normal.
10. **Dungeon Master permission** — Go to Roles tab in settings. "Dungeon Master" should appear as a toggleable permission. Owner role should have it checked by default.
11. **DM Notes tab visibility** — Log in as a non-DM member. The "DM Notes" tab should not appear.
12. **Non-premium owner** — A non-premium server owner should see "Requires Aero+" (disabled) instead of "Activate Toolkit".
13. **Non-owner member** — A regular member should see "Only the server owner can activate toolkits" text.
