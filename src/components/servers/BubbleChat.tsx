// src/components/servers/BubbleChat.tsx
import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useServerStore } from '../../store/serverStore';
import { useServerMessageStore } from '../../store/serverMessageStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
import { AvatarImage } from '../ui/AvatarImage';
import type { BubbleMessage } from '../../lib/serverTypes';

export const BubbleChat = memo(function BubbleChat() {
  const user = useAuthStore(s => s.user);
  const { selectedBubbleId, bubbles, members } = useServerStore();
  const { roles } = useServerRoleStore();
  const { bubbles: msgCache, setBubble, appendMessage } = useServerMessageStore();

  const bubble = bubbles.find(b => b.id === selectedBubbleId);
  const messages = msgCache[selectedBubbleId ?? ''] ?? [];
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load messages on mount
  useEffect(() => {
    if (!selectedBubbleId) return;
    (async () => {
      const { data } = await supabase
        .from('bubble_messages')
        .select('*')
        .eq('bubble_id', selectedBubbleId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (data) setBubble(selectedBubbleId, data);
    })();
  }, [selectedBubbleId]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedBubbleId) return;
    const channel = supabase
      .channel(`bubble:${selectedBubbleId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bubble_messages',
        filter: `bubble_id=eq.${selectedBubbleId}`,
      }, (payload) => {
        const msg = payload.new as BubbleMessage;
        appendMessage(selectedBubbleId, msg);
      })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [selectedBubbleId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !user || !selectedBubbleId || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    await supabase.from('bubble_messages').insert({
      bubble_id: selectedBubbleId,
      sender_id: user.id,
      content: text,
    });
    setSending(false);
  }, [input, user, selectedBubbleId, sending]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Helper to get member info + role for a sender
  const getSenderInfo = (senderId: string) => {
    const member = members.find(m => m.user_id === senderId);
    const role = member ? roles.find(r => r.id === member.role_id) : null;
    return { username: member?.username ?? 'Unknown', avatarUrl: member?.avatar_url, role };
  };

  if (!bubble) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }} />
        {messages.map((msg) => {
          const { username, avatarUrl, role } = getSenderInfo(msg.sender_id);
          return (
            <div key={msg.id} className="flex gap-2.5 py-1.5" style={{ alignItems: 'flex-start' }}>
              <AvatarImage username={username} avatarUrl={avatarUrl} size="sm" />
              <div style={{ minWidth: 0 }}>
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 12, fontWeight: 500, color: role?.color ?? 'var(--text-primary)' }}>
                    {username}
                  </span>
                  {role && !role.is_owner_role && role.position > 1 && (
                    <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 4,
                      background: `${role.color}20`, color: role.color,
                    }}>
                      {role.name}
                    </span>
                  )}
                  {role?.is_owner_role && (
                    <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 4,
                      background: `${role.color}20`, color: role.color,
                    }}>
                      Owner
                    </span>
                  )}
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2, wordBreak: 'break-word' }}>
                  {msg.content}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-3 pb-3">
        <div
          className="flex items-center gap-2 rounded-aero-lg px-3"
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--input-border)',
          }}
        >
          <input
            className="flex-1 bg-transparent py-2.5 text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
            placeholder={`Message #${bubble.name}...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="transition-opacity hover:opacity-70 disabled:opacity-30"
            style={{ color: '#00d4ff' }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
