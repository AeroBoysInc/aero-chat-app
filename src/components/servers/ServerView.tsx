// src/components/servers/ServerView.tsx
import { memo, useEffect, useState, useCallback, useRef } from 'react';
import { ArrowLeft, Settings, X } from 'lucide-react';
import { useCornerStore } from '../../store/cornerStore';
import { useServerStore } from '../../store/serverStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
import { AvatarImage } from '../ui/AvatarImage';
import { CARD_GRADIENTS } from '../../lib/cardGradients';
import { BubbleHub } from './BubbleHub';
import { BubbleChat } from './BubbleChat';
import { ServerSettings } from './ServerSettings';

const DISSOLVE_MS = 500;

export const ServerView = memo(function ServerView() {
  const { serverView, exitToDMs, exitToHub, enterBubble } = useCornerStore();
  const { selectedServerId, selectedBubbleId, servers, members, loadServerData } = useServerStore();
  const { roles, loadRoles } = useServerRoleStore();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  // Circular dissolve transition state
  const [dissolve, setDissolve] = useState<{ originX: number; originY: number; radius: number } | null>(null);
  const dissolveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleBubbleTransition = useCallback((_bubbleId: string, originX: number, originY: number) => {
    // Calculate the max radius needed to cover the entire container from the click point
    if (!contentRef.current) { enterBubble(); return; }
    const { width, height } = contentRef.current.getBoundingClientRect();
    const maxDist = Math.sqrt(
      Math.max(originX, width - originX) ** 2 + Math.max(originY, height - originY) ** 2
    );
    // Start dissolve — circle starts at max radius and shrinks to 0
    setDissolve({ originX, originY, radius: maxDist });
    // Trigger the shrink on next frame so CSS transition fires
    requestAnimationFrame(() => {
      setDissolve(prev => prev ? { ...prev, radius: 0 } : null);
    });
    // After animation completes, commit the navigation
    clearTimeout(dissolveTimer.current);
    dissolveTimer.current = setTimeout(() => {
      enterBubble();
      setDissolve(null);
    }, DISSOLVE_MS);
  }, [enterBubble]);

  const server = servers.find(s => s.id === selectedServerId);

  useEffect(() => {
    if (selectedServerId) {
      loadServerData(selectedServerId);
      loadRoles(selectedServerId);
    }
  }, [selectedServerId]);

  const activeBubble = useServerStore(s => s.bubbles.find(b => b.id === s.selectedBubbleId));

  if (!server) return null;

  const initial = server.name.charAt(0).toUpperCase();
  const inBubble = serverView === 'bubble' && activeBubble;

  return (
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
          onClick={serverView === 'bubble' ? exitToHub : exitToDMs}
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)', position: 'relative', zIndex: 1 }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {serverView === 'bubble' ? 'Hub' : 'Back to DMs'}
        </button>

        <div className="flex-1 flex items-center justify-center gap-2" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            background: server.icon_url ? `url(${server.icon_url}) center/cover` : 'linear-gradient(135deg, var(--sent-bubble-bg), var(--input-focus-border))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: 'white',
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

      {/* Floating bubble name — half in header, half out. No animation, appears instantly. */}
      {inBubble && activeBubble && !dissolve && (
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

      {/* Content — layered for circular dissolve transition */}
      <div ref={contentRef} className="relative flex-1 min-h-0 overflow-hidden">
        {/* BubbleChat sits behind — during dissolve show a static bg, after dissolve render fully */}
        {dissolve && selectedBubbleId && (
          <div className="absolute inset-0" style={{ zIndex: 0, background: 'var(--chat-bg)' }} />
        )}
        {serverView === 'bubble' && !dissolve && selectedBubbleId && (
          <div className="absolute inset-0" style={{ zIndex: 0 }}>
            <BubbleChat />
          </div>
        )}

        {/* BubbleHub sits on top — during dissolve it gets a shrinking circular clip-path */}
        {(serverView !== 'bubble' || dissolve) && (
          <div
            className="absolute inset-0"
            style={{
              zIndex: 1,
              clipPath: dissolve
                ? `circle(${dissolve.radius}px at ${dissolve.originX}px ${dissolve.originY}px)`
                : undefined,
              transition: dissolve !== null
                ? `clip-path ${DISSOLVE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
                : undefined,
            }}
          >
            <BubbleHub onBubbleTransition={handleBubbleTransition} />
          </div>
        )}

        {/* Visible ring at the dissolve boundary */}
        {dissolve && (
          <div
            className="pointer-events-none absolute"
            style={{
              zIndex: 2,
              left: dissolve.originX, top: dissolve.originY,
              width: dissolve.radius * 2, height: dissolve.radius * 2,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: '2px solid rgba(0,212,255,0.6)',
              boxShadow: '0 0 20px rgba(0,212,255,0.4), inset 0 0 20px rgba(0,212,255,0.15)',
              transition: `width ${DISSOLVE_MS}ms cubic-bezier(0.4, 0, 0.2, 1), height ${DISSOLVE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            }}
          />
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
                const gradient = CARD_GRADIENTS.find(g => g.id === member.card_gradient);
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
                      background: gradient?.css ?? 'linear-gradient(135deg, rgba(0,120,255,0.15) 0%, rgba(56,204,248,0.10) 100%)',
                    };

                return (
                  <div
                    key={member.user_id}
                    className="overflow-hidden"
                    style={{ borderRadius: 14, border: '1px solid var(--panel-divider)' }}
                  >
                    {/* Card background strip */}
                    <div style={{ height: 48, position: 'relative', ...bgStyle }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)' }} />
                    </div>

                    {/* Member info */}
                    <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: 'var(--sidebar-bg)' }}>
                      <div style={{ marginTop: -20, position: 'relative', zIndex: 1, flexShrink: 0 }}>
                        <AvatarImage username={member.username ?? '?'} avatarUrl={member.avatar_url} size="sm" />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: role?.color ?? 'var(--text-primary)' }}>
                            {member.username ?? 'Unknown'}
                          </span>
                          {role && (
                            <span style={{
                              fontSize: 9, padding: '1px 6px', borderRadius: 4, flexShrink: 0,
                              background: `${role.color}18`, color: role.color, fontWeight: 600,
                            }}>
                              {role.is_owner_role ? 'Owner' : role.name}
                            </span>
                          )}
                        </div>
                        {member.status && (
                          <p className="truncate" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                            {member.status}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
