// src/components/call/GroupCallView.tsx
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Monitor, MonitorOff, PhoneOff, UserPlus, Headphones, HeadphoneOff, MessageSquare } from 'lucide-react';
import { useGroupCallStore, _getRemoteStream, type GroupParticipant } from '../../store/groupCallStore';
import { useAudioStore } from '../../store/audioStore';
import { ParticipantCard } from './ParticipantCard';
import { AddToCallModal } from './AddToCallModal';
import { IncomingGroupCallModal } from './IncomingGroupCallModal';
import { CameraFeed } from './CameraFeed';
import { AvatarImage } from '../ui/AvatarImage';
import { CARD_GRADIENTS } from '../../lib/cardGradients';
import { getCallTier, getGroupTierPalette, type TierPalette, type AudioBarConfig } from '../../lib/callTierVisuals';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useFriendStore } from '../../store/friendStore';
import { useIsMobile } from '../../lib/useIsMobile';
import { GroupChatWindow } from '../chat/GroupChatWindow';

const MAX_PARTICIPANTS = 4;

function formatDuration(startedAt: number): string {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Builds a CSS background for a participant's panel using their card settings and tier palette */
function panelBackground(p: GroupParticipant, palette: TierPalette): React.CSSProperties {
  if (palette.tier === 'free') {
    return { background: palette.bg };
  }
  if (palette.tier === 'premium') {
    if (p.cardImageUrl) {
      return {
        backgroundImage: `url(${p.cardImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: `${p.cardImageParams?.x ?? 50}% ${p.cardImageParams?.y ?? 50}%`,
      };
    }
    const preset = CARD_GRADIENTS.find(g => g.id === (p.cardGradient ?? 'ocean')) ?? CARD_GRADIENTS[0];
    return {
      background: `linear-gradient(180deg, ${preset.preview}40 0%, ${preset.preview}18 40%, rgba(6,14,31,0.95) 100%)`,
    };
  }
  return { background: palette.bg };
}

export function GroupCallView() {
  const {
    status, participants, myUserId,
    isMuted, isDeafened, screenSharingUserId, localScreenStream,
    callStartedAt, invitedUserIds,
    leaveCall, toggleMute, toggleDeafen, startScreenShare, stopScreenShare,
  } = useGroupCallStore();

  const user = useAuthStore(s => s.user);
  const activeTheme = useThemeStore(s => s.theme);
  const myTier = getCallTier(user, activeTheme);
  const myPalette = getGroupTierPalette(myTier);

  const friends = useFriendStore(s => s.friends);

  const groupId = useGroupCallStore(s => s.groupId);
  const isMobile = useIsMobile();
  const [mobileChatMode, setMobileChatMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [duration, setDuration] = useState('0:00');
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Duration ticker
  useEffect(() => {
    if (!callStartedAt) return;
    const id = setInterval(() => setDuration(formatDuration(callStartedAt)), 1000);
    return () => clearInterval(id);
  }, [callStartedAt]);

  // Auto-hide controls
  useEffect(() => {
    function resetHide() {
      setShowControls(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowControls(false), 4000);
    }
    window.addEventListener('mousemove', resetHide);
    resetHide();
    return () => {
      window.removeEventListener('mousemove', resetHide);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (status === 'ringing') return <IncomingGroupCallModal />;
  if (status === 'idle') return null;

  const participantList = Array.from(participants.values());
  const invitedProfiles = invitedUserIds.map(id => {
    const f = friends.find(fr => fr.id === id);
    return f ? { userId: id, username: f.username, avatarUrl: f.avatar_url ?? null } : { userId: id, username: '...', avatarUrl: null };
  });
  const isScreenSharing = !!screenSharingUserId;
  const iAmSharing = screenSharingUserId === myUserId;

  /* ── Mobile render path ── */
  if (isMobile) {
    const mobileParticipants = participantList;

    // Mini widget + group chat mode
    if (mobileChatMode && groupId) {
      return (
        <div className="h-dvh flex flex-col" style={{ background: 'var(--sidebar-bg)' }}>
          {/* Mini call bar */}
          <button
            onClick={() => setMobileChatMode(false)}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(0,80,200,0.2), rgba(0,40,100,0.3))',
              borderBottom: '1px solid rgba(0,212,255,0.1)',
              color: '#fff', width: '100%',
            }}
          >
            <div style={{ display: 'flex' }}>
              {mobileParticipants.slice(0, 2).map((p, i) => (
                <div key={p.userId} style={{ marginLeft: i > 0 ? -6 : 0 }}>
                  <AvatarImage username={p.username} avatarUrl={p.avatarUrl} size="sm" />
                </div>
              ))}
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Group Call</div>
              <div style={{ fontSize: 10, color: 'rgba(0,212,255,0.5)' }}>{duration}</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); leaveCall(); }}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'rgba(239,68,68,0.5)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <PhoneOff className="h-3.5 w-3.5" />
            </button>
          </button>
          {/* Group chat below */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <GroupChatWindow groupId={groupId} />
          </div>
        </div>
      );
    }

    // Full-screen group call with 2x2 grid
    return (
      <div className="h-dvh safe-bottom flex flex-col" style={{ background: 'rgba(6,14,31,0.98)' }}>
        {/* 2x2 participant grid */}
        <div style={{
          flex: 1, display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 4, padding: 6,
        }}>
          {mobileParticipants.map(p => {
            const isMe = p.userId === myUserId;
            return (
              <div key={p.userId} style={{
                borderRadius: 12, overflow: 'hidden', position: 'relative',
                background: 'rgba(255,255,255,0.03)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <AvatarImage username={p.username} avatarUrl={p.avatarUrl} size="lg" />
                <p style={{ fontSize: 11, fontWeight: 600, color: '#fff', marginTop: 6 }}>{p.username}</p>
                {(isMe ? isMuted : p.isMuted) && (
                  <div style={{ position: 'absolute', top: 6, right: 6 }}>
                    <MicOff className="h-3 w-3" style={{ color: 'rgba(239,68,68,0.7)' }} />
                  </div>
                )}
              </div>
            );
          })}
          {/* Empty slots */}
          {Array.from({ length: Math.max(0, 4 - mobileParticipants.length) }).map((_, i) => (
            <div key={`empty-${i}`} style={{
              borderRadius: 12, border: '1px dashed rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <UserPlus className="h-5 w-5" style={{ color: 'rgba(255,255,255,0.15)' }} />
            </div>
          ))}
        </div>

        {/* Controls bar */}
        <div style={{
          flexShrink: 0, display: 'flex', justifyContent: 'center', gap: 14,
          padding: '16px 20px 20px', alignItems: 'center',
          background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)',
        }}>
          <button onClick={toggleMute} style={{
            width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)',
            background: isMuted ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          {/* Chat toggle */}
          {groupId && (
            <button onClick={() => setMobileChatMode(true)} style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '1px solid rgba(0,212,255,0.3)', background: 'rgba(0,212,255,0.15)',
              color: 'rgba(0,212,255,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <MessageSquare className="h-4 w-4" />
            </button>
          )}
          <button onClick={leaveCall} style={{
            width: 48, height: 48, borderRadius: '50%', border: 'none',
            background: 'rgba(239,68,68,0.7)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            boxShadow: '0 0 15px rgba(239,68,68,0.3)',
          }}>
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>

        {/* Hidden audio elements for each remote stream */}
        {mobileParticipants.filter(p => p.userId !== myUserId).map(p => (
          <RemoteAudio key={p.userId} userId={p.userId} />
        ))}
      </div>
    );
  }

  const btnBase: React.CSSProperties = {
    width: 44, height: 44, borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.15s ease',
    color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
  };

  return (
    <div
      className="flex flex-col"
      style={{ background: '#060e1f', width: '100%', height: '100%', position: 'relative', borderRadius: 16, overflow: 'hidden' }}
    >
      {/* ── Split panels ── */}
      <div className="flex-1 flex" style={{ position: 'relative', overflow: 'hidden' }}>
        {isScreenSharing ? (
          /* ── Screen sharing layout ── */
          <div className="flex flex-col w-full h-full">
            <div className="flex-1 relative" style={{ background: 'rgba(255,255,255,0.03)' }}>
              {iAmSharing && localScreenStream && (
                <CameraFeed stream={localScreenStream} muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              )}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.10)' }}>
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#ef4444' }} />
                <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.70)' }}>
                  {participants.get(screenSharingUserId!)?.username ?? 'Someone'} is sharing
                </span>
              </div>
            </div>
            {/* Compact participant strip below screen share */}
            <div className="flex gap-2 justify-center flex-wrap py-3 px-4"
              style={{ background: 'rgba(6,14,31,0.95)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {participantList.map(p => (
                <ParticipantCard
                  key={p.userId}
                  username={p.username}
                  avatarUrl={p.avatarUrl}
                  isMuted={p.userId === myUserId ? isMuted : p.isMuted}
                  isSpeaking={p.isSpeaking}
                  audioLevel={p.audioLevel}
                  isMe={p.userId === myUserId}
                  compact
                />
              ))}
            </div>
          </div>
        ) : (
          /* ── Vertical split panel layout ── */
          <>
            {participantList.map((p, i) => {
              const isMe = p.userId === myUserId;
              const muted = isMe ? isMuted : p.isMuted;
              return (
                <div key={p.userId} style={{ display: 'contents' }}>
                  {/* Divider between panels */}
                  {i > 0 && (
                    <div style={{
                      width: 1,
                      background: 'rgba(255,255,255,0.08)',
                      flexShrink: 0,
                    }} />
                  )}

                  {/* Panel */}
                  <div
                    style={{
                      flex: 1,
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    {/* Card background — blurred to mask low-res data-URL source and create atmosphere */}
                    <div style={{
                      position: 'absolute',
                      inset: -20,
                      ...panelBackground(p, myPalette),
                      opacity: 0.85,
                      filter: 'blur(12px)',
                      transform: 'scale(1.05)',
                    }} />

                    {/* Dark overlay for readability */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'radial-gradient(ellipse at center 40%, rgba(6,14,31,0.3) 0%, rgba(6,14,31,0.75) 100%)',
                    }} />

                    {/* Ambient orbs and particles — pointer-events-none */}
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                      {myPalette.orbs.map((orb, oi) => (
                        <div key={oi} style={{
                          position: 'absolute',
                          width: orb.width,
                          height: orb.height,
                          background: orb.background,
                          filter: `blur(${orb.blur}px)`,
                          borderRadius: '50%',
                          top: orb.top,
                          bottom: orb.bottom,
                          left: orb.left,
                          right: orb.right,
                          transform: 'translate(-50%, -50%)',
                        }} />
                      ))}
                      {myPalette.particles.map((pt, pi) => (
                        <div key={pi} style={{
                          position: 'absolute',
                          width: pt.size,
                          height: pt.size,
                          borderRadius: '50%',
                          background: pt.color,
                          boxShadow: pt.glow,
                          top: pt.top,
                          left: pt.left,
                        }} />
                      ))}
                    </div>

                    {/* Content */}
                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      {/* Avatar with pulse rings */}
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {/* Pulse rings behind avatar */}
                        {myPalette.rings.map((ring, ri) => (
                          <div key={ri} style={{
                            position: 'absolute',
                            width: ring.radius * 2,
                            height: ring.radius * 2,
                            borderRadius: '50%',
                            border: ring.border,
                            boxShadow: ring.boxShadow,
                            pointerEvents: 'none',
                          }} />
                        ))}
                        <div style={{
                          position: 'relative',
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          border: myPalette.avatarBorder,
                          boxShadow: myPalette.avatarGlow,
                          overflow: 'hidden',
                        }}>
                          <AvatarImage username={p.username} avatarUrl={p.avatarUrl} size="xl" />
                        </div>
                        {muted && (
                          <div style={{
                            position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%',
                            background: 'rgba(239,68,68,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '2px solid rgba(6,14,31,0.8)',
                          }}>
                            <MicOff className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Name + You badge */}
                      <div className="text-center">
                        <span className="text-sm font-bold" style={{
                          color: myPalette.nameColor,
                          fontWeight: myPalette.nameWeight,
                          textShadow: myPalette.nameShadow,
                        }}>
                          {p.username}
                        </span>
                        {isMe && (
                          <span className="ml-2 text-[10px] font-semibold rounded px-1.5 py-0.5"
                            style={{ background: 'rgba(0,212,255,0.12)', color: 'rgba(0,212,255,0.75)' }}>You</span>
                        )}
                      </div>

                      {/* Audio bars */}
                      <GroupTierAudioBars config={myPalette.audioBars} level={muted ? 0 : p.audioLevel} active={p.isSpeaking} />

                      {/* Tier badge */}
                      {myPalette.tierLabel && (
                        <div style={{
                          fontSize: 8,
                          letterSpacing: '0.05em',
                          color: myPalette.tierLabelColor,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}>
                          {myPalette.tierLabel}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Invited user panels — "Calling..." */}
            {invitedProfiles.map(inv => (
              <div key={inv.userId} style={{ display: 'contents' }}>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
                <div style={{
                  flex: 1,
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.6,
                }}>
                  {/* Dark background */}
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,14,31,0.92)' }} />

                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    {/* Pulsing ring + avatar */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{
                        position: 'absolute',
                        width: 64, height: 64,
                        borderRadius: '50%',
                        border: '2px solid rgba(245,158,11,0.40)',
                        animation: 'pulse-ring 1.5s cubic-bezier(0.215,0.61,0.355,1) infinite',
                      }} />
                      <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden' }}>
                        <AvatarImage username={inv.username} avatarUrl={inv.avatarUrl} size="xl" />
                      </div>
                    </div>

                    {/* Name */}
                    <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.70)' }}>
                      {inv.username}
                    </span>

                    {/* Calling indicator */}
                    <div className="flex items-center gap-1.5">
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#f59e0b',
                        animation: 'aura-pulse 1.5s ease-in-out infinite',
                      }} />
                      <span className="text-xs" style={{ color: 'rgba(245,158,11,0.80)' }}>Calling…</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty slot panel — invite prompt */}
            {(participantList.length + invitedProfiles.length) < MAX_PARTICIPANTS && (
              <>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
                <div
                  onClick={() => setShowAddModal(true)}
                  style={{
                    flex: 0.5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.015)',
                    transition: 'flex 0.5s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.03)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.015)'; }}
                >
                  <div className="flex items-center justify-center rounded-full"
                    style={{ width: 56, height: 56, border: '2px dashed rgba(255,255,255,0.15)' }}>
                    <UserPlus className="h-6 w-6" style={{ color: 'rgba(255,255,255,0.20)' }} />
                  </div>
                  <span className="mt-3 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>Add friend</span>
                </div>
              </>
            )}
          </>
        )}

        {/* Floating header overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center gap-2 px-5 pt-4" style={{ zIndex: 10 }}>
          <div className="h-2 w-2 rounded-full" style={{ background: '#3dd87a', boxShadow: '0 0 6px rgba(61,216,122,0.50)' }} />
          <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>Group Call</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>&middot;</span>
          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.40)' }}>{duration}</span>
          {invitedUserIds.length > 0 && (
            <span className="text-[10px] ml-2 px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
              Ringing {invitedUserIds.length}...
            </span>
          )}
        </div>
      </div>

      {/* ── Controls ── */}
      <div
        className="flex justify-center pb-6 pt-2"
        style={{
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.3s',
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
        }}
      >
        <div className="flex items-center gap-2.5 rounded-2xl px-5 py-3"
          style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={toggleMute}
            style={{
              ...btnBase,
              ...(isMuted ? { background: 'rgba(245,158,11,0.25)', borderColor: 'rgba(245,158,11,0.50)', color: '#f59e0b' } : {}),
            }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          <button
            onClick={toggleDeafen}
            style={{
              ...btnBase,
              ...(isDeafened ? { background: 'rgba(239,68,68,0.25)', borderColor: 'rgba(239,68,68,0.50)', color: '#ef4444' } : {}),
            }}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            {isDeafened ? <HeadphoneOff className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
          </button>

          <button
            onClick={iAmSharing ? stopScreenShare : startScreenShare}
            style={{
              ...btnBase,
              ...(iAmSharing ? { background: 'rgba(239,68,68,0.25)', borderColor: 'rgba(239,68,68,0.50)', color: '#ef4444' } : {}),
            }}
            title={iAmSharing ? 'Stop sharing' : 'Share screen'}
          >
            {iAmSharing ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            style={{
              ...btnBase,
              ...(participantList.length >= MAX_PARTICIPANTS ? { opacity: 0.35, cursor: 'default' } : {}),
            }}
            title="Add person"
            disabled={participantList.length >= MAX_PARTICIPANTS}
          >
            <UserPlus className="h-4 w-4" />
          </button>

          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />

          <button
            onClick={leaveCall}
            style={{
              ...btnBase,
              width: 48, height: 48, borderRadius: 20,
              background: 'rgba(239,68,68,0.20)', borderColor: 'rgba(239,68,68,0.40)', color: '#ef4444',
            }}
            title="Leave call"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Hidden audio elements for each remote stream */}
      {participantList.filter(p => p.userId !== myUserId).map(p => (
        <RemoteAudio key={p.userId} userId={p.userId} />
      ))}

      {showAddModal && <AddToCallModal onClose={() => setShowAddModal(false)} />}

      {/* pulse-ring keyframes for invited panels */}
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 1; }
          80%  { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ── Group Tier Audio Bars ───────────────────────────────────────────────── */

function GroupTierAudioBars({ config, level, active }: {
  config: AudioBarConfig;
  level: number;
  active: boolean;
}) {
  if (config.style === 'simple') {
    return (
      <div style={{ display: 'flex', gap: 3, justifyContent: 'center', height: 20, alignItems: 'flex-end' }}>
        {Array.from({ length: config.count }).map((_, i) => {
          const variance = 0.6 + 0.4 * Math.sin(i * 2.1 + level * 20);
          const barHeight = active ? Math.max(3, 20 * level * variance) : 3;
          return (
            <div key={i} style={{
              width: config.width, height: barHeight, borderRadius: 2,
              background: active ? config.activeColor : config.silentColor,
              transition: 'height 0.1s ease-out',
            }} />
          );
        })}
      </div>
    );
  }

  const bands = config.bands!;
  let barIndex = 0;
  return (
    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', height: 20, alignItems: 'flex-end' }}>
      {bands.map((band, bi) => (
        <div key={bi} style={{ display: 'flex', gap: 1.5, marginLeft: bi > 0 ? config.bandGap : 0 }}>
          {Array.from({ length: band.count }).map((_, i) => {
            const idx = barIndex++;
            const variance = 0.5 + 0.5 * Math.sin(idx * 1.8 + level * 25);
            const barHeight = active ? Math.max(3, 18 * level * variance) : 3;
            return (
              <div key={i} style={{
                width: config.width, height: barHeight, borderRadius: 1,
                background: active ? band.activeColor : band.color,
                transition: 'height 0.1s ease-out',
              }} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ── Hidden audio playback per remote peer ────────────────────────────── */

function RemoteAudio({ userId }: { userId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const outputDeviceId = useAudioStore(s => s.outputDeviceId);
  const outputVolume = useAudioStore(s => s.outputVolume);

  useEffect(() => {
    const checkStream = setInterval(() => {
      const el = audioRef.current;
      if (!el) return;
      const stream = _getRemoteStream(userId);
      if (stream && el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
        // Apply output device
        if (outputDeviceId && 'setSinkId' in el) {
          (el as any).setSinkId(outputDeviceId).catch(() => {});
        }
      }
    }, 500);
    return () => clearInterval(checkStream);
  }, [userId, outputDeviceId]);

  // Apply output device when setting changes
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !outputDeviceId) return;
    if ('setSinkId' in el) {
      (el as any).setSinkId(outputDeviceId).catch(() => {});
    }
  }, [outputDeviceId]);

  // Apply output volume
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = outputVolume / 100;
  }, [outputVolume]);

  return <audio ref={audioRef} autoPlay style={{ display: 'none' }} />;
}
