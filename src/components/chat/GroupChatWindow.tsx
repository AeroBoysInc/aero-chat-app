import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, Lock, Phone, Settings, Bell, BellOff, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useGroupChatStore } from '../../store/groupChatStore';
import { useGroupMessageStore, type GroupMessage } from '../../store/groupMessageStore';
import { useUnreadStore } from '../../store/unreadStore';
import { usePresenceStore } from '../../store/presenceStore';
import { useMuteStore } from '../../store/muteStore';
import { useGroupCallStore } from '../../store/groupCallStore';
import { AvatarImage } from '../ui/AvatarImage';
import { GroupSettingsModal } from './GroupSettingsModal';

function formatDateLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Props {
  groupId: string;
}

export function GroupChatWindow({ groupId }: Props) {
  const user = useAuthStore(s => s.user);
  const group = useGroupChatStore(s => s.groups.find(g => g.id === groupId));
  const messages = useGroupMessageStore(s => s.chats[groupId] ?? []);
  const loadMessages = useGroupMessageStore(s => s.loadMessages);
  const sendMessage = useGroupMessageStore(s => s.sendMessage);
  const appendMessage = useGroupMessageStore(s => s.appendMessage);
  const clearUnread = useUnreadStore(s => s.clear);
  const isMuted = useMuteStore(s => s.mutedIds.has(`group:${groupId}`));
  const toggleMute = useMuteStore(s => s.toggleMute);
  const startGroupCall = useGroupCallStore(s => s.startGroupCall);

  const [text, setText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Load messages on mount / group change
  useEffect(() => {
    loadMessages(groupId);
    clearUnread(`group:${groupId}`);
  }, [groupId]);

  // Subscribe to new group messages
  useEffect(() => {
    const channel = supabase
      .channel(`group-msg:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        const raw = payload.new as any;
        if (raw.sender_id === user?.id) return;
        appendMessage(groupId, raw);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, user?.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (autoScroll && chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages.length, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!chatAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatAreaRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 80);
  }, []);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !user) return;
    const msg = text.trim();
    setText('');
    await sendMessage(groupId, msg, user.id);
  }, [text, user, groupId, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleCall = useCallback(() => {
    if (!group) return;
    const memberProfiles = group.members
      .filter(m => m.user_id !== user?.id && m.profile)
      .map(m => m.profile!);
    startGroupCall(memberProfiles);
  }, [group, user?.id, startGroupCall]);

  const itemList = useMemo(() =>
    messages.map((msg, i) => ({
      msg,
      showDate: i === 0 ||
        new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString(),
    })),
  [messages]);

  const onlineCount = group?.members.filter(m =>
    usePresenceStore.getState().onlineIds.has(m.user_id)
  ).length ?? 0;

  if (!group || !user) return null;

  const memberMap = new Map<string, { username: string; avatar_url: string | null }>();
  for (const m of group.members) {
    if (m.profile) memberMap.set(m.user_id, { username: m.profile.username, avatar_url: m.profile.avatar_url });
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--panel-divider)',
          background: 'linear-gradient(180deg, rgba(0,100,255,0.08) 0%, transparent 100%), var(--panel-header-bg)',
          backdropFilter: 'blur(12px)',
          borderRadius: '18px 18px 0 0',
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,100,200,0.2))',
          border: '1px solid rgba(0,212,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Users className="h-4 w-4" style={{ color: '#00d4ff' }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            {group.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {group.members.slice(0, 4).map(m => (
              <div key={m.user_id} style={{
                width: 18, height: 18, borderRadius: '50%', overflow: 'hidden',
                border: '1.5px solid var(--panel-divider)',
              }}>
                {m.profile?.avatar_url ? (
                  <img src={m.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    background: 'linear-gradient(135deg, #1a6fd4, #00d4ff)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, color: '#fff',
                  }}>
                    {(m.profile?.username ?? '?')[0].toUpperCase()}
                  </div>
                )}
              </div>
            ))}
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 2 }}>
              {onlineCount} online
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleMute(`group:${groupId}`)}
            className="rounded-lg p-2 transition-colors"
            style={{
              color: isMuted ? '#f59e0b' : 'var(--text-muted)',
              background: isMuted ? 'rgba(245,158,11,0.10)' : 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isMuted ? 'rgba(245,158,11,0.15)' : 'var(--hover-bg)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isMuted ? 'rgba(245,158,11,0.10)' : ''}
            title={isMuted ? 'Unmute group' : 'Mute group'}
          >
            {isMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          </button>

          <button
            onClick={handleCall}
            className="rounded-lg p-2 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
            title="Start group call"
          >
            <Phone className="h-4 w-4" />
          </button>

          {group.leader_id === user.id && (
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-lg p-2 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              title="Group settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}

          <Lock className="h-3.5 w-3.5 ml-1" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        ref={chatAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-aero px-4 py-3"
        style={{ position: 'relative' }}
      >
        {itemList.map(({ msg, showDate }) => {
          const isMine = msg.sender_id === user.id;
          const sender = memberMap.get(msg.sender_id);

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="my-4 flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: 'var(--date-sep-line)' }} />
                  <span style={{ fontSize: 10, color: 'var(--date-sep-text)', fontWeight: 500, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                    {formatDateLabel(new Date(msg.created_at))}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'var(--date-sep-line)' }} />
                </div>
              )}
              <div className={`flex mb-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                {!isMine && (
                  <div className="flex-shrink-0 mr-2 mt-1">
                    <AvatarImage
                      username={sender?.username ?? '?'}
                      avatarUrl={sender?.avatar_url}
                      size="sm"
                    />
                  </div>
                )}
                <div style={{ maxWidth: '70%' }}>
                  {!isMine && (
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#00d4ff', marginBottom: 2 }}>
                      {sender?.username ?? '?'}
                    </p>
                  )}
                  <div
                    className={`rounded-aero-lg px-4 py-2.5 ${isMine ? 'sent-bubble-gloss' : ''}`}
                    style={{
                      background: isMine
                        ? 'linear-gradient(135deg, var(--bubble-sent-from), var(--bubble-sent-to))'
                        : 'var(--bubble-recv-bg)',
                      color: isMine ? 'var(--bubble-sent-text)' : 'var(--bubble-recv-text)',
                      border: isMine ? 'none' : '1px solid var(--bubble-recv-border)',
                      fontSize: 13,
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.content}
                  </div>
                  <p style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    opacity: 0.6,
                    marginTop: 2,
                    textAlign: isMine ? 'right' : 'left',
                  }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Input bar ── */}
      <div
        className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid var(--panel-divider)', background: 'var(--panel-header-bg)' }}
      >
        <input
          className="aero-input flex-1 py-2 px-3 text-sm"
          placeholder={`Message ${group.name}`}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="rounded-lg p-2 transition-colors"
          style={{
            color: text.trim() ? '#00d4ff' : 'var(--text-muted)',
            opacity: text.trim() ? 1 : 0.4,
          }}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {showSettings && (
        <GroupSettingsModal groupId={groupId} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
