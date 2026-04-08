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
import { getBannerCss } from '../../lib/identityConstants';
import { CARD_GRADIENTS } from '../../lib/cardGradients';
import { BubbleHub } from './BubbleHub';
import { BubbleChat } from './BubbleChat';
import { ServerSettings } from './ServerSettings';

export const ServerView = memo(function ServerView() {
  const { serverView, exitToDMs, exitToHub } = useCornerStore();
  const { selectedServerId, selectedBubbleId, servers, members, loadServerData } = useServerStore();
  const { roles, loadRoles } = useServerRoleStore();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

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

      {/* Content — slide transition between Hub and Chat */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
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
                const identityBanner = getBannerCss(member.banner_gradient);
                const hasImage = !!member.card_image_url;
                const bgStyle: React.CSSProperties = hasImage
                  ? {
                      backgroundImage: `url(${member.card_image_url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: member.card_image_params
                        ? `${member.card_image_params.x ?? 50}% ${member.card_image_params.y ?? 50}%`
                        : 'center',
                    }
                  : identityBanner
                    ? { background: identityBanner }
                    : {
                        background: CARD_GRADIENTS.find(g => g.id === member.card_gradient)?.css
                          ?? (member.accent_color
                            ? `linear-gradient(135deg, ${member.accent_color}30 0%, ${member.accent_color}12 100%)`
                            : 'linear-gradient(135deg, rgba(0,120,255,0.15) 0%, rgba(56,204,248,0.10) 100%)'),
                      };

                return (
                  <div
                    key={member.user_id}
                    className="overflow-hidden"
                    style={{ borderRadius: 14, border: '1px solid var(--panel-divider)' }}
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
        </div>
      )}
    </div>
  );
});
