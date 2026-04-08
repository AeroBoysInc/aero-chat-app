import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Send, Lock, AlertCircle, ShieldAlert, Trash2, Mic, Play, Pause, Timer, Paperclip, Download, File as FileIcon, ArrowLeft, Phone, Video, Users, CalendarDays, Smile, Paintbrush } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { encryptMessage, decryptMessage, loadPrivateKey } from '../../lib/crypto';
import { useAuthStore, type Profile } from '../../store/authStore';
import { useUnreadStore } from '../../store/unreadStore';
import { useTypingStore } from '../../store/typingStore';
import { useFriendStore } from '../../store/friendStore';
import { useCornerStore } from '../../store/cornerStore';
import { loadChatCache, saveChatCache, saveChatCacheDebounced, clearChatCache, saveClearTimestamp, loadClearTimestamp } from '../../lib/chatCache';
import { AvatarImage, statusColor, statusLabel, type Status } from '../ui/AvatarImage';
import { AeroLogo } from '../ui/AeroLogo';
import { getExpiresAt } from '../../store/securityStore';
import { useAudioStore } from '../../store/audioStore';
import { usePresenceStore } from '../../store/presenceStore';
import { useXpStore } from '../../store/xpStore';
import { useShallow } from 'zustand/react/shallow';
import { useCallStore } from '../../store/callStore';
import { useGroupCallStore } from '../../store/groupCallStore';
import { AddToCallModal } from '../call/AddToCallModal';
import { GAME_LABELS } from '../../lib/gameLabels';
import { CARD_GRADIENTS } from '../../lib/cardGradients';
import { createNoisePipeline, createGainPipeline, type NoisePipeline } from '../../lib/noiseSuppression';
import { ChessInviteCard } from '../chess/ChessInviteCard';
import { ImageLightbox } from './ImageLightbox';
import { MessageContent } from './MessageContent';
import { ProfileTooltip } from '../ui/ProfileTooltip';
import { ExternalLinkModal } from './ExternalLinkModal';
import { BubbleLayer, type BubbleInstance } from './BubbleLayer';
import { EmojiGifPicker } from '../ui/EmojiGifPicker';
import { BubbleStylePicker } from '../ui/BubbleStylePicker';
import { useBubbleStyleStore, getBubbleStyle } from '../../store/bubbleStyleStore';
import { useTourStore } from '../../store/tourStore';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AccentName } from '../ui/AccentName';
import { CustomStatusBadge } from '../ui/CustomStatusBadge';
import { DEFAULT_ACCENT } from '../../lib/identityConstants';

const CHESS_INVITE_PREFIX = '__CHESS_INVITE__';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at?: string | null;
  expires_at?: string | null;
}

// Reactions map: messageId → emoji → [userId, ...]
type ReactionsMap = Record<string, Record<string, string[]>>;

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

function isVoiceMessage(content: string): boolean {
  try { return JSON.parse(content)._voice === true; } catch { return false; }
}

function isFileMessage(content: string): boolean {
  try { return JSON.parse(content)._file === true; } catch { return false; }
}

function isCallMessage(content: string): boolean {
  try { return JSON.parse(content)._call === true; } catch { return false; }
}

function isCalendarInvite(content: string): boolean {
  try { return JSON.parse(content)._calendarInvite === true; } catch { return false; }
}

function isServerInvite(content: string): boolean {
  try { return JSON.parse(content)._serverInvite === true; } catch { return false; }
}

// GIF message helpers
export function isGifMessage(content: string): boolean {
  try { return JSON.parse(content)._gif === true; } catch { return false; }
}

export function parseGifMessage(content: string): { url: string; width: number; height: number; previewUrl: string } | null {
  try {
    const p = JSON.parse(content);
    if (p._gif) return { url: p.url, width: p.width, height: p.height, previewUrl: p.previewUrl };
    return null;
  } catch { return null; }
}

interface ServerInviteData {
  serverId: string;
  name: string;
  description: string;
  iconUrl: string;
  bannerUrl: string;
  memberCount: number;
}

function parseServerInvite(content: string): ServerInviteData | null {
  try {
    const p = JSON.parse(content);
    if (p._serverInvite) return { serverId: p.serverId, name: p.name, description: p.description ?? '', iconUrl: p.iconUrl ?? '', bannerUrl: p.bannerUrl ?? '', memberCount: p.memberCount ?? 0 };
    return null;
  } catch { return null; }
}

interface CalendarInviteData {
  eventId: string;
  title: string;
  startAt: string;
  endAt: string;
  color: string;
  description: string;
}

function parseCalendarInvite(content: string): CalendarInviteData | null {
  try {
    const p = JSON.parse(content);
    if (p._calendarInvite) return { eventId: p.eventId, title: p.title, startAt: p.startAt, endAt: p.endAt, color: p.color, description: p.description ?? '' };
    return null;
  } catch { return null; }
}

function parseCallMessage(content: string): { event: 'ended' | 'missed'; duration?: number; callType?: string } | null {
  try {
    const p = JSON.parse(content);
    if (p._call) return { event: p.event, duration: p.duration, callType: p.callType };
    return null;
  } catch { return null; }
}

function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function formatDateLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// ── Calendar invite action button ─────────────────────────────────────────────

function InviteActionButton({ eventId, isMine }: { eventId: string; isMine: boolean }) {
  const [status, setStatus] = useState<'idle' | 'viewing' | 'accepted' | 'declined'>('idle');
  const [eventDetails, setEventDetails] = useState<{ title: string; description?: string; start_at: string; end_at: string; color: string } | null>(null);

  if (isMine) {
    return (
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
        Invite sent
      </span>
    );
  }

  async function handleViewInvite() {
    if (status === 'viewing') { setStatus('idle'); return; }
    const { data } = await supabase.from('calendar_events').select('title, description, start_at, end_at, color').eq('id', eventId).single();
    if (data) { setEventDetails(data); setStatus('viewing'); }
  }

  async function handleRespond(response: 'accepted' | 'declined') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('calendar_event_invites').update({ status: response }).eq('event_id', eventId).eq('invitee_id', user.id);
    setStatus(response);
  }

  if (status === 'accepted') return <span style={{ fontSize: 11, color: '#3dd87a', fontWeight: 500 }}>Accepted</span>;
  if (status === 'declined') return <span style={{ fontSize: 11, color: 'rgba(239,68,68,0.85)', fontWeight: 500 }}>Declined</span>;

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleViewInvite}
        style={{
          fontSize: 11, fontWeight: 600, color: '#00d4ff', background: 'rgba(0,212,255,0.10)',
          border: '1px solid rgba(0,212,255,0.25)', borderRadius: 8, padding: '4px 12px',
          cursor: 'pointer', transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.20)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.10)'; }}
      >
        {status === 'viewing' ? 'Hide Details' : 'View Invite'}
      </button>
      {status === 'viewing' && eventDetails && (
        <div style={{
          padding: '8px 12px', borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontSize: 11, lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 600, color: '#fff', marginBottom: 2 }}>{eventDetails.title}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>
            {new Date(eventDetails.start_at).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: eventDetails.description ? 4 : 8 }}>
            {new Date(eventDetails.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(eventDetails.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          {eventDetails.description && (
            <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>{eventDetails.description}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => handleRespond('accepted')}
              style={{
                fontSize: 11, fontWeight: 600, color: '#fff', background: 'rgba(61,216,122,0.25)',
                border: '1px solid rgba(61,216,122,0.45)', borderRadius: 8, padding: '4px 14px',
                cursor: 'pointer',
              }}
            >
              Accept
            </button>
            <button
              onClick={() => handleRespond('declined')}
              style={{
                fontSize: 11, fontWeight: 600, color: 'rgba(239,68,68,0.85)', background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '4px 14px',
                cursor: 'pointer',
              }}
            >
              Decline
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Server invite join button ─────────────────────────────────────────────────

function ServerInviteJoinButton({ serverId, isMine }: { serverId: string; isMine: boolean }) {
  const [status, setStatus] = useState<'idle' | 'joining' | 'joined' | 'already'>('idle');

  useEffect(() => {
    // Check if already a member
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('server_members')
        .select('user_id')
        .eq('server_id', serverId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setStatus('already');
    })();
  }, [serverId]);

  if (isMine) {
    return (
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
        Invite sent
      </span>
    );
  }

  if (status === 'already') {
    return <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Already a member</span>;
  }
  if (status === 'joined') {
    return <span style={{ fontSize: 11, color: '#3dd87a', fontWeight: 500 }}>Joined!</span>;
  }

  async function handleJoin() {
    setStatus('joining');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStatus('idle'); return; }

      // Find the default (lowest-position non-owner) role
      const { data: roles } = await supabase
        .from('server_roles')
        .select('id, is_owner_role, position')
        .eq('server_id', serverId)
        .eq('is_owner_role', false)
        .order('position', { ascending: true })
        .limit(1);

      const defaultRole = roles?.[0];
      if (!defaultRole) { console.error('[ServerInvite] No roles found'); setStatus('idle'); return; }

      const { error } = await supabase.from('server_members').insert({
        server_id: serverId,
        user_id: user.id,
        role_id: defaultRole.id,
      });

      if (error) {
        if (error.code === '23505') setStatus('already'); // unique constraint = already member
        else { console.error('[ServerInvite] Join error:', error); setStatus('idle'); }
      } else {
        setStatus('joined');
      }
    } catch (err) {
      console.error('[ServerInvite] Join error:', err);
      setStatus('idle');
    }
  }

  return (
    <button
      onClick={handleJoin}
      disabled={status === 'joining'}
      style={{
        fontSize: 11, fontWeight: 600, color: '#fff',
        background: 'rgba(0,212,255,0.20)',
        border: '1px solid rgba(0,212,255,0.40)', borderRadius: 8,
        padding: '5px 16px', cursor: 'pointer',
        transition: 'all 0.15s ease',
        opacity: status === 'joining' ? 0.5 : 1,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.30)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.20)'; }}
    >
      {status === 'joining' ? 'Joining...' : 'Join Server'}
    </button>
  );
}

// ── MessageItem ────────────────────────────────────────────────────────────────
// Memoized per-message row. Owns its own hover + reaction picker state so that
// hovering any message does not re-render the rest of the list.

interface MessageItemProps {
  msg: Message;
  isMine: boolean;
  showDate: boolean;
  msgReactions: Record<string, string[]>;
  isLastMessage: boolean;
  historyLoaded: boolean;
  contact: Profile;
  user: Profile;
  outputVolume: number;
  outputDeviceId: string;
  bubbleStyleId: string;
  toggleReaction: (msgId: string, emoji: string) => void;
  deleteMessage: (msgId: string) => void;
  setLightboxImage: (img: { url: string; name: string; size: number } | null) => void;
  setPendingLinkUrl: (url: string | null) => void;
}

const MessageItem = memo(function MessageItem({
  msg, isMine, showDate, msgReactions, isLastMessage, historyLoaded,
  contact, user, outputVolume, outputDeviceId, bubbleStyleId,
  toggleReaction, deleteMessage, setLightboxImage, setPendingLinkUrl,
}: MessageItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasReactions = Object.values(msgReactions).some(users => users.length > 0);
  const activeBubble = getBubbleStyle(bubbleStyleId);

  return (
    <div>
      {showDate && (
        <div className="my-4 flex items-center gap-3" style={{ position: 'relative', zIndex: 1 }}>
          <div className="flex-1 h-px" style={{ background: 'var(--date-sep-line)' }} />
          <span style={{ fontSize: 10, color: 'var(--date-sep-text)', fontWeight: 500, letterSpacing: '0.04em', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {formatDateLabel(new Date(msg.created_at))}
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--date-sep-line)' }} />
        </div>
      )}
      {/* ── Call event message — centered system-style ── */}
      {isCallMessage(msg.content) ? (() => {
        const call = parseCallMessage(msg.content);
        if (!call) return null;
        const isEnded = call.event === 'ended';
        const icon = isEnded ? '📞' : '📵';
        const label = isEnded
          ? `Call ended · ${call.duration != null ? formatCallDuration(call.duration) : ''}`
          : isMine ? 'Outgoing call · No answer' : 'Missed call';
        return (
          <div
            data-msg-id={msg.id}
            className="flex justify-center"
            style={{ position: 'relative', zIndex: 1, padding: '4px 0' }}
          >
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 20,
              background: 'var(--date-sep-line)',
              border: '1px solid var(--panel-divider)',
              fontSize: 11, fontWeight: 500,
              color: isEnded ? 'var(--text-muted)' : 'rgba(239,68,68,0.85)',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              <span>{icon}</span>
              <span>{label}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.7 }}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        );
      })() : isCalendarInvite(msg.content) ? (() => {
        const inv = parseCalendarInvite(msg.content);
        if (!inv) return null;
        const startDate = new Date(inv.startAt);
        const endDate = new Date(inv.endAt);
        const dateStr = startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = `${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        return (
          <div
            data-msg-id={msg.id}
            className={`relative flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}
            style={{ position: 'relative', zIndex: 1 }}
          >
            {!isMine && <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="sm" />}
            <div
              style={{
                maxWidth: '75%', borderRadius: 16, overflow: 'hidden',
                background: 'rgba(10,20,50,0.65)',
                border: `1px solid ${inv.color}44`,
                boxShadow: `0 4px 20px ${inv.color}22`,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              {/* Color accent bar */}
              <div style={{ height: 3, background: inv.color }} />
              <div style={{ padding: '12px 16px' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" style={{ color: inv.color }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{inv.title}</span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: inv.description ? 6 : 8 }}>
                  {dateStr} · {timeStr}
                </div>
                {inv.description && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8, lineHeight: 1.4 }}>
                    {inv.description.length > 120 ? inv.description.slice(0, 120) + '…' : inv.description}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <InviteActionButton eventId={inv.eventId} isMine={isMine} />
                  <span style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.7, marginLeft: 'auto' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })() : isServerInvite(msg.content) ? (() => {
        const inv = parseServerInvite(msg.content);
        if (!inv) return null;
        const initial = inv.name.charAt(0).toUpperCase();
        return (
          <div
            data-msg-id={msg.id}
            className={`relative flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}
            style={{ position: 'relative', zIndex: 1 }}
          >
            {!isMine && <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="sm" />}
            <div
              style={{
                maxWidth: '75%', width: 280, borderRadius: 16, overflow: 'hidden',
                background: 'rgba(10,20,50,0.65)',
                border: '1px solid rgba(0,212,255,0.25)',
                boxShadow: '0 4px 20px rgba(0,180,255,0.12)',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              {/* Banner */}
              <div style={{ height: 64, position: 'relative', overflow: 'hidden' }}>
                {inv.bannerUrl ? (
                  <img src={inv.bannerUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(0,180,255,0.25) 0%, rgba(120,0,255,0.15) 100%)' }} />
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(10,20,50,0.6) 100%)' }} />
              </div>
              <div style={{ padding: '0 14px 14px', marginTop: -16, position: 'relative' }}>
                {/* Server icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: inv.iconUrl ? `url(${inv.iconUrl}) center/cover` : 'linear-gradient(135deg, #00b4ff, #7800ff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: 'white',
                  border: '2px solid rgba(10,20,50,0.65)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  marginBottom: 8,
                }}>
                  {!inv.iconUrl && initial}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{inv.name}</div>
                {inv.description && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6, lineHeight: 1.4 }}>
                    {inv.description.length > 80 ? inv.description.slice(0, 80) + '…' : inv.description}
                  </p>
                )}
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
                  {inv.memberCount} member{inv.memberCount !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-2">
                  <ServerInviteJoinButton serverId={inv.serverId} isMine={isMine} />
                  <span style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.7, marginLeft: 'auto' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })() : (
      <div
        data-msg-id={msg.id}
        className={`relative flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'} ${isLastMessage && historyLoaded ? 'animate-slide-up' : ''}`}
        style={{ position: 'relative', zIndex: 1 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); setPickerOpen(false); }}
      >
        {!isMine && <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="sm" />}

        <div className="flex flex-col" style={{ alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '65%' }}>
          <div className={`selectable rounded-aero-lg px-4 py-2.5${isMine && activeBubble.gloss ? ' sent-bubble-gloss' : ''}${isMine ? ' ultra-sent-gloss' : ''}`}
            style={isMine ? {
              background: activeBubble.bg,
              boxShadow: activeBubble.shadow,
              border: activeBubble.border,
              borderBottomRightRadius: 4,
              backdropFilter: activeBubble.id === 'frosted-glass' ? 'blur(12px)' : undefined,
            } : {
              background: 'var(--recv-bg)',
              boxShadow: '0 2px 10px rgba(0,80,160,0.10), inset 0 1px 0 rgba(255,255,255,0.50)',
              border: '1px solid var(--recv-border)',
              borderBottomLeftRadius: 4,
            }}>
            {isGifMessage(msg.content) ? (() => {
              const gif = parseGifMessage(msg.content);
              if (!gif) return null;
              return (
                <div style={{ position: 'relative', maxWidth: 280, borderRadius: 12, overflow: 'hidden' }}>
                  <img src={gif.url} alt="GIF" loading="lazy" style={{
                    width: '100%', display: 'block',
                    aspectRatio: `${gif.width} / ${gif.height}`,
                    objectFit: 'cover', background: 'rgba(255,255,255,0.04)',
                  }} />
                  <div style={{
                    position: 'absolute', top: 6, left: 6,
                    padding: '2px 6px', borderRadius: 4,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
                    letterSpacing: '0.05em',
                  }}>
                    GIF
                  </div>
                </div>
              );
            })()
            : isVoiceMessage(msg.content)
              ? <VoicePlayer content={msg.content} isMine={isMine} outputVolume={outputVolume} outputDeviceId={outputDeviceId} />
              : isFileMessage(msg.content)
              ? <FileMessage content={msg.content} isMine={isMine} onImageClick={setLightboxImage} />
              : msg.content.startsWith(CHESS_INVITE_PREFIX) && !isMine
              ? (() => {
                  const parts = msg.content.split(':');
                  const gameId = parts[1] ?? '';
                  const inviter = parts.slice(2).join(':');
                  return <ChessInviteCard gameId={gameId} inviterUsername={inviter} />;
                })()
              : msg.content.startsWith(CHESS_INVITE_PREFIX) && isMine
              ? <p className="text-sm leading-relaxed break-words" style={{ color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  ♟️ Chess invite sent
                </p>
              : msg.content === '[decryption failed]'
              ? (
                <p className="text-sm leading-relaxed break-words" style={{ color: isMine ? activeBubble.textColor : 'var(--recv-text)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <span style={{ opacity: 0.55, fontStyle: 'italic', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Lock style={{ width: 11, height: 11 }} />Encrypted with a previous key</span>
                </p>
              )
              : (
                <MessageContent
                  content={msg.content}
                  isMine={isMine}
                  textColor={isMine ? activeBubble.textColor : 'var(--recv-text)'}
                  onClickLink={setPendingLinkUrl}
                />
              )
            }
            <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px]" style={{ color: isMine ? activeBubble.timeColor : 'var(--recv-time)' }}>
              {msg.expires_at && (
                <span title={`Expires ${new Date(msg.expires_at).toLocaleString()}`} style={{ display: 'flex', alignItems: 'center' }}>
                  <Timer style={{ width: 9, height: 9, opacity: 0.7 }} />
                </span>
              )}
              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {isMine && (
                <span style={{ fontSize: 10, letterSpacing: '-1px', color: activeBubble.textColor, opacity: msg.read_at ? 0.9 : 0.5 }}>
                  {msg.read_at ? ' ✓✓' : ' ✓'}
                </span>
              )}
            </p>
          </div>

          {hasReactions && (
            <div className="flex flex-wrap gap-1 mt-1" style={{ justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              {Object.entries(msgReactions).filter(([, users]) => users.length > 0).map(([emoji, users]) => {
                const mine = users.includes(user.id);
                return (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(msg.id, emoji)}
                    className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 transition-all active:scale-90"
                    style={{
                      background: mine ? 'rgba(0,212,255,0.18)' : 'var(--reaction-idle-bg)',
                      border: `1px solid ${mine ? 'rgba(0,212,255,0.45)' : 'var(--reaction-idle-border)'}`,
                      fontSize: 13,
                    }}
                  >
                    <span>{emoji}</span>
                    <span style={{ color: mine ? '#00d4ff' : 'var(--text-secondary)', fontSize: 10, fontWeight: 600, marginLeft: 2 }}>{users.length}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {isHovered && (
          <div className="relative flex-shrink-0 flex items-center gap-1" style={{ order: isMine ? -1 : 1 }}>
            {isMine && (
              <button
                onClick={() => deleteMessage(msg.id)}
                className="flex h-6 w-6 items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
                style={{ background: 'rgba(220,50,50,0.12)', border: '1px solid rgba(220,50,50,0.25)', color: '#d03030' }}
                title="Delete message"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={() => setPickerOpen(prev => !prev)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-sm transition-all hover:scale-110 active:scale-95"
              style={{ background: 'var(--btn-ghost-bg)', border: '1px solid var(--btn-ghost-border)', color: 'var(--text-secondary)' }}
            >
              +
            </button>
            {pickerOpen && (
              <div
                className="absolute z-30 flex gap-1 rounded-aero-lg p-2 shadow-xl"
                style={{
                  background: 'var(--popup-bg)',
                  border: '1px solid var(--popup-border)',
                  backdropFilter: 'blur(16px)',
                  bottom: '110%',
                  ...(isMine ? { right: 0 } : { left: 0 }),
                  whiteSpace: 'nowrap',
                }}
              >
                {REACTION_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(msg.id, emoji)}
                    className="flex h-8 w-8 items-center justify-center rounded-aero text-lg transition-all hover:scale-125 active:scale-95"
                    style={{ background: msgReactions[emoji]?.includes(user.id) ? 'rgba(0,212,255,0.18)' : 'transparent' }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
});

function VoicePlayer({ content, isMine, outputVolume, outputDeviceId }: { content: string; isMine: boolean; outputVolume: number; outputDeviceId: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let url = '';
    try {
      const { data, dur } = JSON.parse(content);
      const blob = base64ToBlob(data, 'audio/webm');
      url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = outputVolume / 100;
      // Set output device if browser supports it and a device is selected
      if (outputDeviceId && typeof (audio as any).setSinkId === 'function') {
        (audio as any).setSinkId(outputDeviceId).catch(() => {});
      }
      audioRef.current = audio;
      audio.ontimeupdate = () => setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
      audio.onended = () => { setPlaying(false); setProgress(0); };
      (audio as any)._dur = dur;
    } catch {}
    return () => { audioRef.current?.pause(); if (url) URL.revokeObjectURL(url); };
  }, [content, outputVolume, outputDeviceId]);

  function toggle() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  }

  const dur = (() => { try { return JSON.parse(content).dur ?? 0; } catch { return 0; } })();
  const trackColor = isMine ? 'rgba(255,255,255,0.35)' : 'rgba(0,80,160,0.18)';
  const fillColor  = isMine ? 'rgba(255,255,255,0.90)' : '#1a6fd4';

  return (
    <div className="flex items-center gap-2.5" style={{ minWidth: 160 }}>
      <button
        onClick={toggle}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
        style={{ background: isMine ? 'rgba(255,255,255,0.25)' : 'rgba(0,100,200,0.12)', border: `1px solid ${isMine ? 'rgba(255,255,255,0.35)' : 'rgba(0,100,200,0.22)'}` }}
      >
        {playing
          ? <Pause style={{ width: 13, height: 13, color: isMine ? '#fff' : '#1a6fd4' }} />
          : <Play  style={{ width: 13, height: 13, color: isMine ? '#fff' : '#1a6fd4', marginLeft: 1 }} />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="relative h-1 rounded-full" style={{ background: trackColor }}>
          <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${progress * 100}%`, background: fillColor }} />
        </div>
        <span style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.65)' : 'var(--recv-time)' }}>{fmtDuration(dur)}</span>
      </div>
    </div>
  );
}

function FileMessage({ content, isMine, onImageClick }: { content: string; isMine: boolean; onImageClick: (img: { url: string; name: string; size: number }) => void }) {
  const { url, name, size, mime } = JSON.parse(content) as { url: string; name: string; size: number; mime: string };
  const isImage = mime?.startsWith('image/');
  const textColor = isMine ? 'rgba(255,255,255,0.90)' : 'var(--recv-text)';
  const subColor  = isMine ? 'rgba(255,255,255,0.60)' : 'var(--recv-time)';

  if (isImage) {
    return (
      <button
        type="button"
        className="block cursor-pointer text-left"
        onClick={() => onImageClick({ url, name, size })}
      >
        <img
          src={url} alt={name}
          className="rounded-aero block"
          style={{ maxWidth: 220, maxHeight: 220, objectFit: 'cover', display: 'block' }}
        />
        <p style={{ fontSize: 10, color: subColor, marginTop: 4 }}>{name}</p>
      </button>
    );
  }

  return (
    <a
      href={url} download={name} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2.5 no-underline"
      style={{ minWidth: 180 }}
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-aero"
        style={{ background: isMine ? 'rgba(255,255,255,0.18)' : 'rgba(0,100,200,0.12)', border: `1px solid ${isMine ? 'rgba(255,255,255,0.30)' : 'rgba(0,100,200,0.22)'}` }}>
        <FileIcon style={{ width: 16, height: 16, color: isMine ? '#fff' : '#1a6fd4' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium" style={{ color: textColor }}>{name}</p>
        <p style={{ fontSize: 10, color: subColor }}>{fmtBytes(size)}</p>
      </div>
      <Download style={{ width: 14, height: 14, flexShrink: 0, color: isMine ? 'rgba(255,255,255,0.70)' : '#1a6fd4' }} />
    </a>
  );
}

interface Props { contact: Profile; onBack?: () => void; }

function SoapBubbles() {
  const bubbles = [
    { size: 44, right: 28, top: 12, delay: 0,   dur: 5   },
    { size: 26, right: 14, top: 22, delay: 0.8, dur: 4.5 },
    { size: 18, right: 52, top: 8,  delay: 1.5, dur: 6   },
    { size: 34, right: 44, top: 20, delay: 0.4, dur: 5.5 },
    { size: 14, right: 22, top: 44, delay: 2,   dur: 4   },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bubbles.map((b, i) => (
        <div key={i} className="soap-bubble" style={{ width: b.size, height: b.size, right: b.right, top: b.top, animation: `float ${b.dur}s ease-in-out ${b.delay}s infinite` }} />
      ))}
    </div>
  );
}

export function ChatWindow({ contact, onBack }: Props) {
  const { user } = useAuthStore();
  const { clear } = useUnreadStore();
  const { setTyping } = useTypingStore();
  const friends = useFriendStore(useShallow(s => s.friends));
  const { gameViewActive, gameChatOverlay } = useCornerStore(useShallow(s => ({ gameViewActive: s.gameViewActive, gameChatOverlay: s.gameChatOverlay })));
  const { inputDeviceId, outputDeviceId, noiseCancellation, inputVolume, outputVolume } = useAudioStore(useShallow(s => ({ inputDeviceId: s.inputDeviceId, outputDeviceId: s.outputDeviceId, noiseCancellation: s.noiseCancellation, inputVolume: s.inputVolume, outputVolume: s.outputVolume })));
  const contactGame   = usePresenceStore(s => s.playingGames.get(contact.id));
  const contactOnline = usePresenceStore(s => s.onlineIds.has(contact.id));
  const presenceReady = usePresenceStore(s => s.presenceReady);
  const callStatus = useCallStore(s => s.status);
  const startCall  = useCallStore(s => s.startCall);
  const groupCallStatus = useGroupCallStore(s => s.status);
  const [showGroupCallModal, setShowGroupCallModal] = useState(false);
  // Mirror the same logic as Sidebar: presence channel overrides stored status to 'offline'
  // when the contact is not in the live online set (covers app-close / tab-close / logout).
  const storedStatus = ((friends.find(f => f.id === contact.id)?.status ?? contact.status) as Status | undefined) ?? 'online';
  const liveStatus: Status = !presenceReady ? 'offline' : !contactOnline ? 'offline' : storedStatus;

  // Contact card bleed — gradient preset or photo background
  // For gradients: use the preview hex color to build a vivid directional bleed.
  // The card CSS values (rgba 0.16-0.22) are too low-opacity to survive the mask + opacity stack.
  const bleedPreset = CARD_GRADIENTS.find(g => g.id === (contact.card_gradient ?? 'ocean')) ?? CARD_GRADIENTS[0];
  const bleedBackground: React.CSSProperties = contact.card_image_url
    ? {
        backgroundImage: `url(${contact.card_image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: `${contact.card_image_params?.x ?? 50}% ${contact.card_image_params?.y ?? 50}%`,
        filter: 'blur(6px) saturate(1.3)',
        transform: 'scale(1.06)',
      }
    : { background: `linear-gradient(to left, ${bleedPreset.preview}cc 0%, ${bleedPreset.preview}55 55%, transparent 100%)` };

  // Contact identity for header bleed + accent name + custom status
  const contactProfile = useFriendStore(s => s.friends.find(f => f.id === contact?.id));
  const contactAccent = contactProfile?.accent_color || DEFAULT_ACCENT;
  const contactAccentSecondary = contactProfile?.accent_color_secondary || null;
  const contactCardGradientCss = CARD_GRADIENTS.find(g => g.id === contactProfile?.card_gradient)?.css;
  const contactCardImage = contactProfile?.card_image_url;

  // Read from localStorage synchronously — guaranteed to have data on refresh
  const [messages,      setMessages]      = useState<Message[]>(() => loadChatCache(user!.id, contact.id));
  const [input,         setInput]         = useState('');
  const [sending,       setSending]       = useState(false);
  const [sendError,     setSendError]     = useState('');
  const [contactTyping,     setContactTyping]     = useState(false);
  const [showClearModal,    setShowClearModal]    = useState(false);
  const [reactions,         setReactions]         = useState<ReactionsMap>({});
  const [bubbles, setBubbles] = useState<BubbleInstance[]>([]);
  const [isRecording,       setIsRecording]       = useState(false);
  const [recordDuration,    setRecordDuration]    = useState(0);
  const [isUploading,       setIsUploading]       = useState(false);
  const [lightboxImage,     setLightboxImage]     = useState<{ url: string; name: string; size: number } | null>(null);
  const [pendingLinkUrl,    setPendingLinkUrl]    = useState<string | null>(null);
  const [pickerOpen,        setPickerOpen]        = useState(false);
  const [bubblePickerOpen,  setBubblePickerOpen]  = useState(false);
  const bubbleStyle = useBubbleStyleStore(s => s.styleId);
  const activeBubble = getBubbleStyle(bubbleStyle);

  // Consume tour pendingAction for bubble-picker
  const tourPendingAction = useTourStore(s => s.pendingAction);
  const clearPendingAction = useTourStore(s => s.clearPendingAction);
  useEffect(() => {
    if (tourPendingAction === 'bubble-picker') {
      clearPendingAction();
      setBubblePickerOpen(true);
    }
  }, [tourPendingAction, clearPendingAction]);

  const pickerAnchorRef = useRef<HTMLDivElement>(null);
  const bubblePickerAnchorRef = useRef<HTMLButtonElement>(null);
  const reactionsRef = useRef<ReactionsMap>({});
  reactionsRef.current = reactions;

  const chatAreaRef = useRef<HTMLDivElement>(null);

  const itemList = useMemo(() =>
    messages.map((msg, i) => ({
      msg,
      showDate: i === 0 ||
        new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString(),
    })),
  [messages]);

  const virtualizer = useVirtualizer({
    count: itemList.length,
    getScrollElement: () => chatAreaRef.current,
    estimateSize: () => 72,
    overscan: 8,
    measureElement: el => el.getBoundingClientRect().height,
  });
  const contactKeyRef      = useRef<string | null>(null);
  const channelRef         = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef        = useRef(false);
  const historyLoadedRef   = useRef(false);
  const pendingDecrypt     = useRef<Message[]>([]);
  const mediaRecorderRef      = useRef<MediaRecorder | null>(null);
  const audioChunksRef        = useRef<Blob[]>([]);
  const recordTimerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingPipelineRef  = useRef<NoisePipeline | null>(null);
  const rawStreamRef          = useRef<MediaStream | null>(null);
  const inputRef           = useRef<HTMLInputElement>(null);
  const fileInputRef       = useRef<HTMLInputElement>(null);

  const hasPrivateKey = !!loadPrivateKey(user?.id);

  // Clear unread when this chat is opened or when returning from game view
  useEffect(() => {
    if (!gameViewActive || gameChatOverlay?.mode === 'conversation') clear(contact.id);
  }, [contact.id, gameViewActive, gameChatOverlay]);

  // Fetch contact key then load history
  useEffect(() => {
    if (!user) return;
    // Show cache immediately while fresh data loads from DB
    setMessages(loadChatCache(user!.id, contact.id));
    setShowClearModal(false);
    contactKeyRef.current = null;
    pendingDecrypt.current = [];
    historyLoadedRef.current = false;

    supabase.from('profiles').select('public_key').eq('id', contact.id).single()
      .then(async ({ data }) => {
        if (!data?.public_key) return;
        contactKeyRef.current = data.public_key;

        // Two explicit queries — use '*' so the query succeeds whether or not
        // the read_at column exists yet (migration 005 may not be applied).
        const [{ data: sent }, { data: received }] = await Promise.all([
          supabase.from('messages')
            .select('*')
            .eq('sender_id', user.id)
            .eq('recipient_id', contact.id)
            .order('created_at', { ascending: true }),
          supabase.from('messages')
            .select('*')
            .eq('sender_id', contact.id)
            .eq('recipient_id', user.id)
            .order('created_at', { ascending: true }),
        ]);

        const clearTs = loadClearTimestamp(user.id, contact.id);
        const all = [...(sent ?? []), ...(received ?? [])]
          .filter(m => !clearTs || m.created_at > clearTs)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        // Flush any realtime messages that arrived before the key was ready
        const pending = pendingDecrypt.current.splice(0);

        // Build a fallback map from the existing cache so that if decryption
        // fails (e.g. the local key was rotated), we preserve any previously
        // decrypted plaintext rather than overwriting it with "[decryption failed]".
        const cachedMap = new Map(loadChatCache(user!.id, contact.id).map(m => [m.id, m.content]));
        const decryptWithFallback = (m: { id: string; content: string }): string => {
          const result = decrypt(m.content);
          if (result === '[decryption failed]' && cachedMap.has(m.id)) return cachedMap.get(m.id)!;
          return result;
        };

        const allWithPending = [
          ...all.map(m => ({ ...m, content: decryptWithFallback(m) })),
          // Pending messages might already be in `all` — deduplicate by id
          ...pending
            .filter(p => !all.some(a => a.id === p.id))
            .map(m => ({ ...m, content: decryptWithFallback(m) })),
        ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        setMessages(allWithPending);
        saveChatCache(user!.id, contact.id, allWithPending);
        historyLoadedRef.current = true;
        markMessagesRead();

        // Load reactions for all visible messages
        const msgIds = allWithPending.map(m => m.id);
        if (msgIds.length > 0) {
          const { data: rxns } = await supabase
            .from('reactions').select('message_id, user_id, emoji').in('message_id', msgIds);
          if (rxns) {
            const map: ReactionsMap = {};
            for (const r of rxns) {
              if (!map[r.message_id]) map[r.message_id] = {};
              if (!map[r.message_id][r.emoji]) map[r.message_id][r.emoji] = [];
              map[r.message_id][r.emoji].push(r.user_id);
            }
            setReactions(map);
          }
        }
      });
  }, [contact.id, user]);

  async function markMessagesRead() {
    if (!user) return;
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', user.id)
      .eq('sender_id', contact.id)
      .is('read_at', null);
  }

  function decrypt(ciphertext: string): string {
    const pk = loadPrivateKey(user?.id);
    if (!pk)                    return '[no private key]';
    if (!contactKeyRef.current) return '[loading key…]';
    return decryptMessage(ciphertext, contactKeyRef.current, pk) ?? '[decryption failed]';
  }

  // Reset reactions when switching contacts
  useEffect(() => { setReactions({}); }, [contact.id]);

  // ── Bubble helpers ────────────────────────────────────────────────────────────
  const spawnBubble = useCallback((emoji: string, messageId: string) => {
    const msgEl = document.querySelector(`[data-msg-id="${messageId}"]`);
    // Use closest() so it works even if multiple ChatWindows mount simultaneously
    const containerEl = msgEl?.closest('[data-bubble-container]') as HTMLElement | null;
    if (!msgEl || !containerEl) return; // message not in DOM (safe no-op)

    const msgRect       = msgEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();

    setBubbles(prev => [...prev, {
      id:    `${messageId}-${Date.now()}-${Math.random()}`,
      emoji,
      x: msgRect.left - containerRect.left + msgRect.width * 0.75,
      // scrollTop accounts for the container's scroll offset — getBoundingClientRect()
      // returns viewport-relative coords, but position:absolute is relative to the
      // full scrollable content height, not just the visible portion.
      y: msgRect.top  - containerRect.top  + msgRect.height * 0.5 + containerEl.scrollTop,
    }]);
  }, []); // stable — no external deps captured

  const removeBubble = useCallback((id: string) => {
    setBubbles(prev => prev.filter(b => b.id !== id));
  }, []);

  // Realtime subscription + Presence for typing + reactions
  useEffect(() => {
    if (!user) return;

    const channelName = `dm:${[user.id, contact.id].sort().join(':')}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: user.id } },
    })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${user.id}`,
      }, async (payload) => {
        const m = payload.new as any;
        if (m.sender_id !== contact.id) return;
        if (!contactKeyRef.current) {
          // Key not loaded yet — queue and retry when history loads
          pendingDecrypt.current.push(m);
          return;
        }
        let content = decrypt(m.content);
        if (content === '[decryption failed]') {
          // Sender's key may have rotated since the chat opened — refresh and retry once
          const { data: fresh } = await supabase
            .from('profiles').select('public_key').eq('id', contact.id).single();
          if (fresh?.public_key && fresh.public_key !== contactKeyRef.current) {
            contactKeyRef.current = fresh.public_key;
            content = decrypt(m.content);
          }
        }
        if (content === '[decryption failed]') return; // still undecryptable — drop silently
        const decoded: Message = { ...m, content };
        setMessages(prev => {
          const next = [...prev, decoded];
          saveChatCacheDebounced(user!.id, contact.id, next);
          return next;
        });
        if (!useCornerStore.getState().gameViewActive || useCornerStore.getState().gameChatOverlay?.mode === 'conversation') {
          clear(contact.id); // message arrived while viewing — keep at 0
          markMessagesRead();
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${user.id}`,
      }, (payload) => {
        const m = payload.new as any;
        if (m.recipient_id !== contact.id) return;
        // Patch read_at on our sent message
        setMessages(prev => {
          const next = prev.map(msg =>
            msg.id === m.id ? { ...msg, read_at: m.read_at } : msg
          );
          saveChatCacheDebounced(user!.id, contact.id, next);
          return next;
        });
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'reactions',
        filter: `user_id=eq.${contact.id}`,
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
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'reactions',
        filter: `user_id=eq.${contact.id}`,
      }, (payload) => {
        const r = payload.old as { message_id: string; user_id: string; emoji: string };
        setReactions(prev => {
          const next = { ...prev, [r.message_id]: { ...prev[r.message_id] } };
          if (next[r.message_id]?.[r.emoji]) {
            next[r.message_id][r.emoji] = next[r.message_id][r.emoji].filter(id => id !== r.user_id);
          }
          return next;
        });
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ typing?: boolean }>();
        const contactPres = state[contact.id] as Array<{ typing?: boolean }> | undefined;
        const isTyping = contactPres?.[0]?.typing === true;
        setContactTyping(isTyping);
        setTyping(contact.id, isTyping); // update global store for sidebar
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ typing: false });
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      setTyping(contact.id, false);
      channelRef.current = null;
    };
  }, [contact.id, user, spawnBubble]);

  // Scroll to bottom — only when near bottom or on initial load
  useEffect(() => {
    if (itemList.length === 0) return;
    const el = chatAreaRef.current;
    if (!el) return;
    const nearBottom = !historyLoadedRef.current ||
      el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (nearBottom) {
      virtualizer.scrollToIndex(itemList.length - 1, { align: 'end' });
    }
  }, [itemList.length]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    // Only broadcast typing=true once per typing session, not on every keystroke
    if (!isTypingRef.current && channelRef.current) {
      isTypingRef.current = true;
      channelRef.current.track({ typing: true });
    }
    // Auto-clear after 2.5s of inactivity
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTypingRef.current = false;
      if (channelRef.current) channelRef.current.track({ typing: false });
    }, 2500);
  }, []);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setInput(prev => prev + emoji);
    inputRef.current?.focus();
  }, []);

  const sendEncryptedContentRef = useRef(sendEncryptedContent);

  const handleGifSelect = useCallback(async (gif: { url: string; width: number; height: number; previewUrl: string }) => {
    await sendEncryptedContentRef.current(JSON.stringify({ _gif: true, ...gif }));
  }, []);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !user) return;
    setSending(true);
    setSendError('');

    // Stop typing indicator
    if (typingTimer.current) clearTimeout(typingTimer.current);
    isTypingRef.current = false;
    if (channelRef.current) channelRef.current.track({ typing: false });

    const privateKey = loadPrivateKey(user?.id);
    if (!privateKey) { setSendError('Encryption key missing. Please reload.'); setSending(false); return; }
    if (!contactKeyRef.current) { setSendError('Contact key not loaded yet. Please try again.'); setSending(false); return; }

    // ── Optimistic UI: show the message instantly ──
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Message = {
      id: optimisticId,
      sender_id: user.id,
      content: text,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages(prev => [...prev, optimistic]);
    setInput('');

    // Award chatter XP immediately (before network) — anti-abuse: 3+ char, not duplicate
    if (text.length >= 3) {
      const hash = text.slice(0, 50);
      const isPrem = user?.is_premium === true;
      useXpStore.getState().awardXp('chatter', 2, user!.id, isPrem, hash);
    }

    // ── Encrypt & send in background ──
    const expiresAt = getExpiresAt();
    const ciphertext = encryptMessage(text, contactKeyRef.current!, privateKey);
    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id, recipient_id: contact.id, content: ciphertext,
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    }).select('id, sender_id, content, created_at, expires_at').single();

    if (error) {
      // Remove the optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      setSendError('Failed to send. Please try again.');
    } else if (data) {
      // Replace optimistic message with the real server record
      const sent: Message = { ...data, content: text, read_at: null };
      setMessages(prev => {
        const next = prev.map(m => m.id === optimisticId ? sent : m);
        saveChatCache(user!.id, contact.id, next);
        return next;
      });
    }
    setSending(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // ── Delete message ───────────────────────────────────────────────────────────
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user) return;
    setMessages(prev => prev.filter(m => m.id !== messageId));
    const { error } = await supabase.from('messages').delete().eq('id', messageId).eq('sender_id', user.id);
    if (error) {
      // Refetch to restore if delete failed
      setSendError('Failed to delete message.');
    } else if (contact) {
      saveChatCache(user.id, contact.id, messages.filter(m => m.id !== messageId));
    }
  }, [user, contact, messages]);

  // ── Reactions ────────────────────────────────────────────────────────────────
  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    const alreadyReacted = reactionsRef.current[messageId]?.[emoji]?.includes(user.id);
    if (alreadyReacted) {
      await supabase.from('reactions').delete()
        .eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji);
      setReactions(prev => {
        const next = { ...prev, [messageId]: { ...prev[messageId] } };
        next[messageId][emoji] = (next[messageId][emoji] ?? []).filter(id => id !== user.id);
        return next;
      });
    } else {
      await supabase.from('reactions').insert({ message_id: messageId, user_id: user.id, emoji });
      setReactions(prev => {
        const next = { ...prev, [messageId]: { ...prev[messageId] } };
        next[messageId][emoji] = [...(next[messageId][emoji] ?? []), user.id];
        return next;
      });
      spawnBubble(emoji, messageId);
    }
    // picker state is now local to each MessageItem — no setReactionPickerFor needed
  }, [user, spawnBubble]);

  // ── Voice recording ──────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const audioConstraints: MediaTrackConstraints = {
        noiseSuppression: false,
        echoCancellation: true,
        autoGainControl: false,
        ...(inputDeviceId ? { deviceId: { exact: inputDeviceId } } : {}),
      };
      const rawStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      rawStreamRef.current = rawStream;

      // Always route through a pipeline — noise gate + compressor are always active,
      // RNNoise is added when noise cancellation is on.
      const pipeline = noiseCancellation
        ? await createNoisePipeline(rawStream)
        : await createGainPipeline(rawStream);
      // If cancelRecording() fired during the await, rawStreamRef was cleared — bail out
      if (!rawStreamRef.current) {
        pipeline.dispose();
        rawStream.getTracks().forEach(t => t.stop());
        return;
      }
      pipeline.setInputGain(inputVolume / 100);
      recordingPipelineRef.current = pipeline;
      const recordStream = pipeline.processedStream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mr = new MediaRecorder(recordStream, { mimeType });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        rawStreamRef.current?.getTracks().forEach(t => t.stop());
        rawStreamRef.current = null;
        recordingPipelineRef.current?.dispose();
        recordingPipelineRef.current = null;
      };
      mr.start(100);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration(d => {
          if (d >= 60) { stopAndSendRecording(); return d; }
          return d + 1;
        });
      }, 1000);
    } catch {
      setSendError('Microphone access denied.');
    }
  }

  function cancelRecording() {
    // Null rawStreamRef first — signals any pending startRecording await to bail out
    const rs = rawStreamRef.current;
    rawStreamRef.current = null;
    rs?.getTracks().forEach(t => t.stop());

    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    recordingPipelineRef.current?.dispose();
    recordingPipelineRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordDuration(0);
  }

  async function stopAndSendRecording() {
    if (!mediaRecorderRef.current) return;
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    const mr = mediaRecorderRef.current;
    const dur = recordDuration;
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setRecordDuration(0);
    await new Promise<void>(resolve => { mr.onstop = () => resolve(); mr.stop(); });
    // Clean up raw stream and pipeline (mr.onstop was overwritten above so we do it here)
    rawStreamRef.current?.getTracks().forEach(t => t.stop());
    rawStreamRef.current = null;
    recordingPipelineRef.current?.dispose();
    recordingPipelineRef.current = null;
    if (audioChunksRef.current.length === 0) return;
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = [];
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      await sendEncryptedContent(JSON.stringify({ _voice: true, data: base64, dur }));
    };
  }

  async function sendEncryptedContent(plaintext: string) {
    if (!user || !contactKeyRef.current) return;
    setSending(true);
    const privateKey = loadPrivateKey(user.id);
    if (!privateKey) { setSendError('Encryption key missing.'); setSending(false); return; }

    // Optimistic UI
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Message = {
      id: optimisticId, sender_id: user.id, content: plaintext,
      created_at: new Date().toISOString(), read_at: null,
    };
    setMessages(prev => [...prev, optimistic]);

    const expiresAt = getExpiresAt();
    const ciphertext = encryptMessage(plaintext, contactKeyRef.current!, privateKey);
    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id, recipient_id: contact.id, content: ciphertext,
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    }).select('id, sender_id, content, created_at, expires_at').single();
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      setSendError('Failed to send.');
    } else if (data) {
      const sent: Message = { ...data, content: plaintext, read_at: null };
      setMessages(prev => {
        const next = prev.map(m => m.id === optimisticId ? sent : m);
        saveChatCache(user!.id, contact.id, next);
        return next;
      });
    }
    setSending(false);
  }
  sendEncryptedContentRef.current = sendEncryptedContent;

  // ── File / image sharing ──────────────────────────────────────────────────────
  async function uploadAndSendFile(file: File) {
    if (!user) return;
    const isPrem = user.is_premium === true;
    const maxBytes = isPrem ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    const maxLabel = isPrem ? '50 MB' : '10 MB';
    if (file.size > maxBytes) {
      setSendError(`File too large. Maximum size is ${maxLabel}.${!isPrem ? ' Upgrade to Aero Chat+ for 50 MB.' : ''}`);
      return;
    }

    setIsUploading(true);
    setSendError('');

    const bucket = isPrem ? 'chat-files-premium' : 'chat-files';
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket).upload(path, file, { contentType: file.type });

    if (uploadError) {
      setSendError('Upload failed. Please try again.');
      setIsUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    await sendEncryptedContent(JSON.stringify({
      _file: true, url: publicUrl,
      name: file.name, size: file.size,
      mime: file.type || 'application/octet-stream',
    }));
    setIsUploading(false);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    await uploadAndSendFile(file);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) uploadAndSendFile(file);
        return;
      }
    }
  }

  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div className="drag-region"
        style={{ position: 'relative', overflow: 'hidden', padding: '8px 14px', borderBottom: '1px solid var(--panel-divider)', background: 'var(--panel-header-bg)', backdropFilter: 'blur(12px)', borderRadius: '18px 18px 0 0' }}>

        {/* Banner bleed background */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0,
          background: contactCardImage
            ? `url(${contactCardImage}) center/cover`
            : contactCardGradientCss || `linear-gradient(135deg, ${contactAccent}20, transparent)`,
          opacity: contactCardImage ? 0.18 : 0.15,
          zIndex: 0,
          pointerEvents: 'none',
        }} />
        {/* Accent gradient line at bottom */}
        <div aria-hidden="true" style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
          background: contactAccentSecondary
            ? `linear-gradient(90deg, ${contactAccent}, ${contactAccentSecondary}, transparent 70%)`
            : `linear-gradient(90deg, ${contactAccent}80, transparent 60%)`,
          zIndex: 1,
          pointerEvents: 'none',
        }} />
        {/* Card image / gradient bleed — right-side fade */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: -4, right: -4, bottom: -4, width: '55%',
            zIndex: 1,
            pointerEvents: 'none',
            ...bleedBackground,
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.50) 35%, rgba(0,0,0,0.85) 100%)',
            maskImage:       'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.50) 35%, rgba(0,0,0,0.85) 100%)',
            opacity: liveStatus === 'offline' ? 0.25 : 0.75,
          }}
        />

        {/* Header content — above bleed */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '0.625rem', width: '100%' }}>
        {onBack && (
          <button
            onClick={onBack}
            className="no-drag flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-xl transition-all"
            style={{ background: 'var(--btn-ghost-bg)', border: '1px solid var(--btn-ghost-border)', color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--btn-ghost-bg)'}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        )}
        <ProfileTooltip data={{
          username: contact.username,
          avatarUrl: contact.avatar_url,
          status: liveStatus,
          cardGradient: contact.card_gradient,
          cardImageUrl: contact.card_image_url,
          cardImageParams: contact.card_image_params,
        }}>
          <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="md" status={liveStatus} playingGame={contactGame} gifUrl={contactProfile?.avatar_gif_url} alwaysAnimate />
        </ProfileTooltip>
        <div className="no-drag flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-1.5">
            <AccentName
              name={contact?.username ?? ''}
              accentColor={contactAccent}
              accentColorSecondary={contactAccentSecondary}
              nameEffect={contactProfile?.name_effect}
              playing
              style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Inter, system-ui, sans-serif' }}
            />
            {/* Clear chat button */}
            <button
              onClick={() => setShowClearModal(true)}
              className="no-drag flex-shrink-0 rounded-aero p-0.5 transition-all"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e03f3f'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              title="Clear chat"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          {/* Status row — typing overrides everything, then custom status, then online/game */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {contactTyping ? (
              <>
                <span className="flex items-center gap-1 text-[10px] italic" style={{ color: '#1a6fd4' }}>
                  <span className="typing-dots" style={{ color: '#1a6fd4' }}>
                    <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                  </span>
                  typing…
                </span>
              </>
            ) : (contactProfile?.custom_status_emoji || contactProfile?.custom_status_text) ? (
              <CustomStatusBadge emoji={contactProfile.custom_status_emoji} text={contactProfile.custom_status_text} size="sm" />
            ) : (
              <>
                <span className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: statusColor[liveStatus], boxShadow: `0 0 4px ${statusColor[liveStatus]}cc` }} />
                <span className="text-[10px]" style={{ color: statusColor[liveStatus] }}>
                  {statusLabel[liveStatus]}
                </span>
                {contactGame && (
                  <>
                    <span style={{ fontSize: 10, color: 'var(--separator-dot)' }}>·</span>
                    <span className="text-[10px]" style={{ color: 'var(--game-activity-color)', fontWeight: 500 }}>
                      🎮 {GAME_LABELS[contactGame as keyof typeof GAME_LABELS] ?? contactGame}
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <div className="no-drag flex items-center gap-1.5">
          {/* Call buttons — only when idle */}
          {callStatus === 'idle' && groupCallStatus === 'idle' && (
            <>
              <button
                onClick={() => startCall(contact, 'audio')}
                title="Voice call"
                className="flex h-6 w-6 items-center justify-center rounded-lg transition-all"
                style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#00d4ff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              >
                <Phone className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setShowGroupCallModal(true)}
                title="Group call"
                className="flex h-6 w-6 items-center justify-center rounded-lg transition-all"
                style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#00d4ff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              >
                <Users className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => startCall(contact, 'video')}
                title="Video call"
                className="flex h-6 w-6 items-center justify-center rounded-lg transition-all"
                style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#00d4ff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              >
                <Video className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <AeroLogo size={28} className="opacity-20" />
          <Lock className="h-2.5 w-2.5" style={{ color: 'var(--text-muted)' }} />
        </div>
        </div> {/* /header content */}
      </div> {/* /header outer */}

      {/* Clear chat confirmation modal */}
      {showClearModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowClearModal(false)}
        >
          <div
            className="glass-elevated mx-4 w-full max-w-sm p-6 animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: 'rgba(220,60,60,0.12)', border: '1px solid rgba(200,60,60,0.30)' }}>
                <Trash2 className="h-5 w-5" style={{ color: '#d03030' }} />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Clear conversation</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>with {contact.username}</p>
              </div>
            </div>
            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              This will permanently remove all messages in this conversation <strong>from your view only</strong>.
              {contact.username} will still be able to see their copy of the chat.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowClearModal(false)}
                className="aero-btn px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  saveClearTimestamp(user!.id, contact.id);
                  clearChatCache(user!.id, contact.id);
                  setMessages([]);
                  setShowClearModal(false);
                }}
                className="rounded-aero px-4 py-2 text-sm font-semibold transition-all active:scale-95"
                style={{ background: 'linear-gradient(180deg,#f05050 0%,#c02020 100%)', color: '#fff', border: '1px solid rgba(200,60,60,0.60)', boxShadow: '0 3px 12px rgba(180,0,0,0.30)' }}
              >
                Clear chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={chatAreaRef}
        data-bubble-container=""
        className="flex-1 overflow-y-auto scrollbar-aero px-6 py-4"
        style={{ position: 'relative' }}
      >
        <BubbleLayer bubbles={bubbles} onRemove={removeBubble} />
        <SoapBubbles />

        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Lock className="mx-auto mb-2 h-8 w-8" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                Messages are end-to-end encrypted.
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                Say hello to {contact.username}!
              </p>
            </div>
          </div>
        )}

        {itemList.length > 0 && (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map(vItem => {
              const item = itemList[vItem.index];
              return (
                <div
                  key={vItem.key}
                  data-index={vItem.index}
                  ref={virtualizer.measureElement}
                  style={{ position: 'absolute', top: vItem.start, width: '100%', paddingBottom: 4 }}
                >
                  <MessageItem
                    msg={item.msg}
                    isMine={item.msg.sender_id === user?.id}
                    showDate={item.showDate}
                    msgReactions={reactions[item.msg.id] ?? {}}
                    isLastMessage={vItem.index === itemList.length - 1}
                    historyLoaded={historyLoadedRef.current}
                    contact={contact}
                    user={user!}
                    outputVolume={outputVolume}
                    outputDeviceId={outputDeviceId}
                    bubbleStyleId={bubbleStyle}
                    toggleReaction={toggleReaction}
                    deleteMessage={deleteMessage}
                    setLightboxImage={setLightboxImage}
                    setPendingLinkUrl={setPendingLinkUrl}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Typing bubble at bottom when contact is typing */}
        {contactTyping && (
          <div className="flex items-end gap-2 justify-start animate-slide-up">
            <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="sm" />
            <div className="rounded-aero-lg px-4 py-3" style={{ background: 'var(--recv-bg)', border: '1px solid var(--recv-border)', borderBottomLeftRadius: 4, boxShadow: '0 2px 10px rgba(0,80,160,0.10)' }}>
              <span className="typing-dots" style={{ color: '#7aaac8' }}>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
            </div>
          </div>
        )}

      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="px-5 py-4"
        style={{ borderTop: '1px solid var(--panel-divider)', background: 'var(--panel-header-bg)', backdropFilter: 'blur(12px)', borderRadius: '0 0 18px 18px' }}>
        {!hasPrivateKey && (
          <div className="mb-3 flex items-center gap-2 rounded-aero border px-4 py-2.5 text-sm"
            style={{ background: 'rgba(255,200,50,0.12)', borderColor: 'rgba(220,160,0,0.35)', color: '#8a6200' }}>
            <ShieldAlert className="h-4 w-4 shrink-0" />
            Encryption key missing. Please sign out and re-register to restore your key.
          </div>
        )}
        {sendError && (
          <div className="mb-3 flex items-center gap-2 rounded-aero border px-4 py-2.5 text-sm"
            style={{ background: 'rgba(220,60,60,0.12)', borderColor: 'rgba(200,60,60,0.35)', color: '#8a2020' }}>
            <AlertCircle className="h-4 w-4 shrink-0" />
            {sendError}
          </div>
        )}
        {isRecording ? (
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-3 rounded-aero border px-4 py-2.5"
              style={{ background: 'rgba(220,40,40,0.10)', borderColor: 'rgba(200,50,50,0.35)' }}>
              <span className="h-2.5 w-2.5 rounded-full animate-pulse flex-shrink-0" style={{ background: '#e03f3f', boxShadow: '0 0 6px #e03f3f' }} />
              <span className="text-sm font-medium" style={{ color: '#cc3333' }}>Recording</span>
              <span className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmtDuration(recordDuration)}</span>
            </div>
            <button type="button" onClick={cancelRecording} className="aero-btn px-3 py-2.5 text-sm">
              Cancel
            </button>
            <button type="button" onClick={stopAndSendRecording} disabled={sending} className="aero-btn-send flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5" /> Send
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" className="hidden"
              accept="image/*,video/*,.pdf,.txt,.doc,.docx,.zip,.csv,.mp4,.mov,.webm,.avi,.mkv"
              onChange={handleFileSelect}
            />
            <div ref={pickerAnchorRef} className="aero-input flex-1 flex items-center" style={{ padding: 0 }}>
              <input
                ref={inputRef}
                className="flex-1 bg-transparent py-2.5 px-3 text-sm outline-none"
                style={{ color: 'var(--text-primary)' }}
                placeholder={`Message ${contact.username}…`}
                value={input}
                onChange={handleInputChange}
                onPaste={handlePaste}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
                disabled={!hasPrivateKey}
              />
              <button
                type="button"
                onClick={() => setPickerOpen(p => !p)}
                disabled={!hasPrivateKey}
                className="flex items-center justify-center rounded-lg transition-all hover:scale-110 disabled:opacity-40"
                style={{ width: 28, height: 28, background: 'rgba(0,212,255,0.10)', border: '1px solid rgba(0,212,255,0.20)', flexShrink: 0 }}
                title="Emoji & GIF"
              >
                <Smile className="h-4 w-4" style={{ color: '#00d4ff' }} />
              </button>
              <button
                ref={bubblePickerAnchorRef}
                type="button"
                onClick={() => setBubblePickerOpen(p => !p)}
                disabled={!hasPrivateKey}
                className="flex items-center justify-center rounded-lg transition-all hover:scale-110 disabled:opacity-40"
                style={{ width: 28, height: 28, marginRight: 6, flexShrink: 0, background: activeBubble.bg, border: activeBubble.border, position: 'relative', overflow: 'hidden' }}
                title="Bubble Style"
              >
                {activeBubble.gloss && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%)', borderRadius: 'inherit', pointerEvents: 'none' }} />
                )}
                <Paintbrush className="h-3.5 w-3.5" style={{ color: activeBubble.textColor, position: 'relative', opacity: 0.8 }} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || isUploading || !hasPrivateKey}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-aero transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
              style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.28)', color: '#00d4ff' }}
              title={isUploading ? 'Uploading…' : 'Send file or image'}
            >
              {isUploading
                ? <span className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#00d4ff', borderTopColor: 'transparent' }} />
                : <Paperclip className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={startRecording}
              disabled={sending || isUploading || !hasPrivateKey}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-aero transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
              style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.28)', color: '#00d4ff' }}
              title="Voice message"
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              type="submit"
              disabled={sending || !input.trim() || !hasPrivateKey}
              onMouseDown={e => e.preventDefault()}
              className="aero-btn-send"
            >
              Send <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <EmojiGifPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onEmojiSelect={handleEmojiSelect}
          onGifSelect={handleGifSelect}
          userId={user?.id ?? ''}
          anchorRef={pickerAnchorRef}
        />
        <BubbleStylePicker
          open={bubblePickerOpen}
          onClose={() => setBubblePickerOpen(false)}
          anchorRef={bubblePickerAnchorRef}
        />
      </form>
      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
      {pendingLinkUrl && (
        <ExternalLinkModal
          url={pendingLinkUrl}
          onConfirm={() => { window.open(pendingLinkUrl, '_blank', 'noopener,noreferrer'); setPendingLinkUrl(null); }}
          onCancel={() => setPendingLinkUrl(null)}
        />
      )}
      {showGroupCallModal && (
        <AddToCallModal onClose={() => setShowGroupCallModal(false)} multiSelect />
      )}
    </div>
  );
}
