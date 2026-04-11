// src/components/servers/ServerView.tsx
import { memo, useEffect, useState } from 'react';
import { ArrowLeft, Settings, X } from 'lucide-react';
import { useCornerStore } from '../../store/cornerStore';
import { useServerStore } from '../../store/serverStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
import { AvatarImage } from '../ui/AvatarImage';
import { AccentName } from '../ui/AccentName';
import { CustomStatusBadge } from '../ui/CustomStatusBadge';
import { CardEffect } from '../ui/CardEffect';
import { CARD_GRADIENTS } from '../../lib/cardGradients';
import { BubbleHub } from './BubbleHub';
import { BubbleChat } from './BubbleChat';
import { ServerSettings } from './ServerSettings';
import { DndThemeProvider } from './toolkits/DndThemeProvider';
import { DndTabBar, type DndTab } from './toolkits/DndTabBar';
import { CharactersTab } from './toolkits/CharactersTab';
import { useDndCharacterStore } from '../../store/dndCharacterStore';
import { getClassColor } from '../../lib/classColors';
import { HpBar } from './toolkits/HpBar';

export const ServerView = memo(function ServerView() {
  const { serverView, exitToDMs, exitToHub } = useCornerStore();
  const { selectedServerId, selectedBubbleId, servers, members, loadServerData } = useServerStore();
  const { roles, loadRoles } = useServerRoleStore();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [dndTab, setDndTab] = useState<DndTab>('bubbles');
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const [hoverRect, setHoverRect] = useState<{ top: number; right: number; bottom: number } | null>(null);

  const characters = useDndCharacterStore(s => s.characters);
  const loadCharacters = useDndCharacterStore(s => s.loadCharacters);

  const server = servers.find(s => s.id === selectedServerId);
  const activeToolkit = useServerStore(s => s.activeToolkit);

  useEffect(() => {
    if (selectedServerId) {
      loadServerData(selectedServerId);
      loadRoles(selectedServerId);
    }
  }, [selectedServerId]);

  // Reset DnD tab when switching servers
  useEffect(() => { setDndTab('bubbles'); }, [selectedServerId]);

  // Load characters when members popup opens (for hover widget)
  useEffect(() => {
    if (membersOpen && activeToolkit && selectedServerId) loadCharacters(selectedServerId);
  }, [membersOpen, activeToolkit, selectedServerId]);

  const activeBubble = useServerStore(s => s.bubbles.find(b => b.id === s.selectedBubbleId));

  if (!server) return null;

  const initial = server.name.charAt(0).toUpperCase();
  const inBubble = serverView === 'bubble' && activeBubble;

  return (
    <DndThemeProvider>
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'var(--chat-bg)' }}>
      {/* Header wrapper — allows the bubble badge to overflow downward */}
      <div className="flex-shrink-0" style={{ position: 'relative', zIndex: 3 }}>
      <div
        className="flex items-center px-4 py-3"
        style={{
          position: 'relative', overflow: 'hidden',
          borderBottom: '1px solid var(--panel-divider)',
        }}
      >
        {/* Banner background — blurred */}
        {server.banner_url && (
          <div style={{
            position: 'absolute', inset: -8,
            backgroundImage: `url(${server.banner_url})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            filter: 'blur(12px) brightness(0.35)',
            zIndex: 0,
          }} />
        )}
        {!server.banner_url && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(0,180,255,0.08) 0%, rgba(120,0,255,0.06) 100%)',
            zIndex: 0,
          }} />
        )}

        <button
          onClick={() => serverView === 'bubble' ? exitToHub() : exitToDMs()}
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)', position: 'relative', zIndex: 1 }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <div className="flex-1 flex items-center justify-center gap-2" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            background: server.icon_url ? `url(${server.icon_url}) center/cover` : 'linear-gradient(135deg, var(--sent-bubble-bg), var(--input-focus-border))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: 'white',
            ...(activeToolkit ? { border: '2px solid var(--tk-gold, transparent)', boxShadow: '0 0 8px var(--tk-accent-glow, transparent)' } : {}),
          }}>
            {!server.icon_url && initial}
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {server.name}
          </span>
        </div>

        <div className="flex items-center gap-3" style={{ position: 'relative', zIndex: 1 }}>
          <button
            onClick={() => setMembersOpen(true)}
            className="transition-opacity hover:opacity-80"
            style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            {members.length} member{members.length !== 1 ? 's' : ''}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Floating bubble name — half in header, half out */}
      {inBubble && activeBubble && (
        <div
          style={{
            position: 'absolute', bottom: -14, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 20,
            background: 'var(--sidebar-bg)',
            border: `1.5px solid ${activeBubble.color}40`,
            boxShadow: `0 4px 16px rgba(0,0,0,0.3), 0 0 12px ${activeBubble.color}20`,
            zIndex: 2, whiteSpace: 'nowrap',
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeBubble.color, boxShadow: `0 0 6px ${activeBubble.color}60` }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: activeBubble.color }}>
            #{activeBubble.name}
          </span>
        </div>
      )}
      </div>{/* end header wrapper */}

      {/* DnD toolkit tab bar — only visible when toolkit is active */}
      {activeToolkit && (
        <DndTabBar activeTab={dndTab} onTabChange={setDndTab} />
      )}

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
          dndTab === 'characters' ? (
          <CharactersTab />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div style={{ fontSize: 48, marginBottom: 8, opacity: 0.3 }}>
                {dndTab === 'worldmap' ? '🗺️' : dndTab === 'quests' ? '📜' : '📖'}
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tk-text, var(--text-primary))', marginBottom: 4 }}>
                {dndTab === 'worldmap' ? 'World Map' : dndTab === 'quests' ? 'Quests' : 'DM Notes'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--tk-text-muted, var(--text-muted))' }}>Coming soon</p>
            </div>
          </div>
        )
        )}
      </div>
      {settingsOpen && <ServerSettings onClose={() => setSettingsOpen(false)} />}

      {/* Members popup */}
      {membersOpen && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setMembersOpen(false); }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 480, maxHeight: '80%', borderRadius: 18, overflow: 'hidden',
              background: 'var(--sidebar-bg)', border: '1px solid var(--panel-divider)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Popup header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--panel-divider)' }}>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Members — {members.length}
              </h3>
              <button onClick={() => setMembersOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Member cards */}
            <div className="overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
              {members.map(member => {
                const role = roles.find(r => r.id === member.role_id);
                const hasImage = !!member.card_image_url;
                const bgStyle: React.CSSProperties = hasImage
                  ? {
                      backgroundImage: `url(${member.card_image_url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: member.card_image_params
                        ? `${member.card_image_params.x ?? 50}% ${member.card_image_params.y ?? 50}%`
                        : 'center',
                    }
                  : {
                      background: CARD_GRADIENTS.find(g => g.id === member.card_gradient)?.css
                        ?? (member.accent_color
                          ? `linear-gradient(135deg, ${member.accent_color}30 0%, ${member.accent_color}12 100%)`
                          : 'linear-gradient(135deg, rgba(0,120,255,0.15) 0%, rgba(56,204,248,0.10) 100%)'),
                    };

                const memberChar = activeToolkit ? characters.find(c => c.user_id === member.user_id) : null;

                return (
                  <div
                    key={member.user_id}
                    className="overflow-hidden"
                    style={{ borderRadius: 14, border: '1px solid var(--panel-divider)' }}
                    onMouseEnter={(e) => {
                      if (!memberChar) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredUserId(member.user_id);
                      setHoverRect({ top: rect.top, right: rect.right, bottom: rect.bottom });
                    }}
                    onMouseLeave={() => { setHoveredUserId(null); setHoverRect(null); }}
                  >
                    {/* Card background strip with effect */}
                    <div style={{ height: 48, position: 'relative', ...bgStyle }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)' }} />
                      <CardEffect effect={member.card_effect ?? null} playing={true} />
                    </div>

                    {/* Member info */}
                    <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: 'var(--sidebar-bg)' }}>
                      <div style={{ marginTop: -20, position: 'relative', zIndex: 1, flexShrink: 0 }}>
                        <AvatarImage username={member.username ?? '?'} avatarUrl={member.avatar_url} size="sm" gifUrl={member.avatar_gif_url} alwaysAnimate />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="flex items-center gap-1.5">
                          <AccentName
                            name={member.username ?? 'Unknown'}
                            accentColor={member.accent_color ?? null}
                            accentColorSecondary={member.accent_color_secondary ?? null}
                            nameEffect={member.name_effect ?? null}
                            playing
                            style={{ fontSize: 13, fontWeight: 600 }}
                          />
                          {role && (
                            <span style={{
                              fontSize: 9, padding: '1px 6px', borderRadius: 4, flexShrink: 0,
                              background: `${role.color}18`, color: role.color, fontWeight: 600,
                            }}>
                              {role.is_owner_role ? 'Owner' : role.name}
                            </span>
                          )}
                        </div>
                        {(member.custom_status_emoji || member.custom_status_text) ? (
                          <CustomStatusBadge emoji={member.custom_status_emoji ?? null} text={member.custom_status_text ?? null} size="sm" />
                        ) : member.bio ? (
                          <p className="truncate" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                            {member.bio}
                          </p>
                        ) : member.status ? (
                          <p className="truncate" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                            {member.status}
                          </p>
                        ) : null}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* Floating DnD character card — appears to the right of hovered member */}
          {hoveredUserId && hoverRect && (() => {
            const char = characters.find(c => c.user_id === hoveredUserId);
            if (!char) return null;
            const cc = getClassColor(char.class);
            // Clamp vertical position so card doesn't overflow viewport
            const cardHeight = 260;
            const top = Math.min(hoverRect.top, window.innerHeight - cardHeight - 16);
            return (
              <div
                className="animate-fade-in"
                style={{
                  position: 'fixed', top, left: hoverRect.right + 12,
                  width: 240, borderRadius: 16, overflow: 'hidden',
                  background: 'var(--sidebar-bg)', border: '1px solid var(--panel-divider)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                  pointerEvents: 'none', zIndex: 50,
                }}
              >
                {/* Background image */}
                {char.background_url && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: `url(${char.background_url}) center/cover`,
                    opacity: 0.1, pointerEvents: 'none',
                  }} />
                )}

                <div className="relative" style={{ padding: '14px 14px 12px' }}>
                  {/* Header label */}
                  <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 8, textTransform: 'uppercase' }}>
                    Character Sheet
                  </div>

                  {/* Portrait + name */}
                  <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                      border: `2.5px solid ${cc}`,
                      boxShadow: `0 0 12px ${cc}40`,
                      background: char.portrait_url
                        ? `url(${char.portrait_url}) center/cover`
                        : `linear-gradient(135deg, ${cc}40, ${cc}15)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, color: cc,
                    }}>
                      {!char.portrait_url && '🛡️'}
                    </div>
                    <div className="min-w-0">
                      <div style={{ fontSize: 13, fontWeight: 700, color: cc }}>{char.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                        {char.species} {char.class} · Level {char.level}
                      </div>
                    </div>
                  </div>

                  {/* Stats grid — 3×2 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 8 }}>
                    {(Object.entries(char.stats) as [string, number][]).map(([key, val]) => (
                      <div key={key} style={{
                        textAlign: 'center', padding: '4px 0', borderRadius: 6,
                        background: val >= 14 ? `${cc}15` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${val >= 14 ? `${cc}25` : 'rgba(255,255,255,0.06)'}`,
                      }}>
                        <div style={{ fontSize: 7, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', opacity: 0.7 }}>{key}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: val >= 14 ? cc : val <= 8 ? 'var(--text-muted)' : 'var(--text-primary)' }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* HP bar */}
                  <div style={{ marginBottom: 4 }}>
                    <div className="flex items-center justify-between" style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 2 }}>
                      <span>HP</span>
                      <span>{char.hp_current}/{char.hp_max}</span>
                    </div>
                    <HpBar current={char.hp_current} max={char.hp_max} height={5} />
                  </div>

                  {/* Footer stats row */}
                  <div className="flex items-center justify-between" style={{ marginTop: 6, fontSize: 9, color: 'var(--text-muted)' }}>
                    <span>AC <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{char.armor_class}</span></span>
                    <span style={{ color: '#FFD700' }}>{char.gold.toLocaleString()} gp</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
    </DndThemeProvider>
  );
});
