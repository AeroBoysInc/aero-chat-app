import { useState, useEffect, useRef } from 'react';
import { Send, Lock, AlertCircle, ShieldAlert, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { encryptMessage, decryptMessage, loadPrivateKey } from '../../lib/crypto';
import { useAuthStore, type Profile } from '../../store/authStore';
import { useUnreadStore } from '../../store/unreadStore';
import { useTypingStore } from '../../store/typingStore';
import { useFriendStore } from '../../store/friendStore';
import { loadChatCache, saveChatCache, clearChatCache } from '../../lib/chatCache';
import { AvatarImage, statusColor, statusLabel, type Status } from '../ui/AvatarImage';
import { AeroLogo } from '../ui/AeroLogo';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at?: string | null;
}

interface Props { contact: Profile; }

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

export function ChatWindow({ contact }: Props) {
  const { user } = useAuthStore();
  const { clear } = useUnreadStore();
  const { setTyping } = useTypingStore();
  const { friends } = useFriendStore();
  // Always read status from the live friends list so it updates in real-time
  const liveStatus = ((friends.find(f => f.id === contact.id)?.status ?? contact.status) as Status | undefined) ?? 'online';

  // Read from localStorage synchronously — guaranteed to have data on refresh
  const [messages,      setMessages]      = useState<Message[]>(() => loadChatCache(contact.id));
  const [input,         setInput]         = useState('');
  const [sending,       setSending]       = useState(false);
  const [sendError,     setSendError]     = useState('');
  const [contactTyping, setContactTyping] = useState(false);
  const [confirmClear,  setConfirmClear]  = useState(false);

  const bottomRef        = useRef<HTMLDivElement>(null);
  const contactKeyRef    = useRef<string | null>(null);
  const channelRef       = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef      = useRef(false);
  const historyLoadedRef = useRef(false); // true after first DB load; new messages get animation
  // Messages that arrived via realtime before contactKeyRef was populated
  const pendingDecrypt   = useRef<Message[]>([]);

  const hasPrivateKey = !!loadPrivateKey(user?.id);

  // Clear unread when this chat is opened
  useEffect(() => {
    clear(contact.id);
  }, [contact.id]);

  // Fetch contact key then load history
  useEffect(() => {
    if (!user) return;
    // Show cache immediately while fresh data loads from DB
    setMessages(loadChatCache(contact.id));
    setConfirmClear(false);
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

        const all = [...(sent ?? []), ...(received ?? [])]
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        // Flush any realtime messages that arrived before the key was ready
        const pending = pendingDecrypt.current.splice(0);

        // Build a fallback map from the existing cache so that if decryption
        // fails (e.g. the local key was rotated), we preserve any previously
        // decrypted plaintext rather than overwriting it with "[decryption failed]".
        const cachedMap = new Map(loadChatCache(contact.id).map(m => [m.id, m.content]));
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
        saveChatCache(contact.id, allWithPending); // write to localStorage
        historyLoadedRef.current = true;
        markMessagesRead();
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

  // Realtime subscription + Presence for typing
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
          saveChatCache(contact.id, next);
          return next;
        });
        clear(contact.id); // message arrived while viewing — keep at 0
        markMessagesRead();
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
          saveChatCache(contact.id, next);
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
  }, [contact.id, user]);

  // Scroll to bottom — instant for history loads, smooth only for new realtime messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: historyLoadedRef.current ? 'smooth' : 'instant' });
  }, [messages, contactTyping]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
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
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !user) return;
    setSending(true);
    setSendError('');

    // Stop typing indicator
    if (typingTimer.current) clearTimeout(typingTimer.current);
    isTypingRef.current = false;
    if (channelRef.current) channelRef.current.track({ typing: false });

    const privateKey = loadPrivateKey(user?.id);
    if (!privateKey) { setSendError('Encryption key missing. Please reload.'); setSending(false); return; }
    if (!contactKeyRef.current) { setSendError('Contact key not loaded yet. Please try again.'); setSending(false); return; }

    // Re-fetch the contact's public key to ensure we encrypt with the latest
    // version. If their key rotated since we opened the chat, using the stale
    // cached key would produce a ciphertext the recipient can't decrypt.
    const { data: freshKey } = await supabase
      .from('profiles').select('public_key').eq('id', contact.id).single();
    if (freshKey?.public_key) contactKeyRef.current = freshKey.public_key;

    const ciphertext = encryptMessage(input.trim(), contactKeyRef.current!, privateKey);
    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id, recipient_id: contact.id, content: ciphertext,
    }).select('id, sender_id, content, created_at').single();

    if (error) {
      setSendError('Failed to send. Please try again.');
    } else if (data) {
      const sent: Message = { ...data, content: input.trim(), read_at: null };
      setMessages(prev => {
        const next = [...prev, sent];
        saveChatCache(contact.id, next);
        return next;
      });
      setInput('');
    }
    setSending(false);
  }

  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div className="drag-region flex items-center gap-3 px-6 py-3.5"
        style={{ borderBottom: '1px solid var(--panel-divider)', background: 'var(--panel-header-bg)', backdropFilter: 'blur(12px)', borderRadius: '18px 18px 0 0' }}>
        <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="lg" status={liveStatus} />
        <div className="no-drag flex-1">
          <p className="font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: 'var(--text-primary)', fontSize: 15 }}>
            {contact.username}
          </p>
          {contactTyping ? (
            <p className="flex items-center gap-1.5 text-[11px] italic" style={{ color: '#1a6fd4' }}>
              <span className="typing-dots" style={{ color: '#1a6fd4' }}>
                <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              </span>
              typing…
            </p>
          ) : (
            <p className="flex items-center gap-1 text-[11px]" style={{ color: statusColor[liveStatus] }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: statusColor[liveStatus], boxShadow: `0 0 4px ${statusColor[liveStatus]}cc` }} />
              {statusLabel[liveStatus]}
            </p>
          )}
        </div>
        <div className="no-drag flex items-center gap-2">
          <AeroLogo size={20} className="opacity-20" />
          <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <Lock className="h-3 w-3" />
          </div>
          {/* Clear chat button */}
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="rounded-aero p-1.5 transition-all"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e03f3f'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              title="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-aero px-2 py-1"
              style={{ background: 'rgba(220,60,60,0.10)', border: '1px solid rgba(200,60,60,0.25)' }}>
              <span className="text-[10px]" style={{ color: '#c03030' }}>Clear chat?</span>
              <button
                onClick={() => { clearChatCache(contact.id); setMessages([]); setConfirmClear(false); }}
                className="text-[10px] font-bold rounded px-1.5 py-0.5 transition-colors"
                style={{ color: '#fff', background: '#d03030' }}
              >Yes</button>
              <button
                onClick={() => setConfirmClear(false)}
                className="text-[10px] font-medium rounded px-1.5 py-0.5"
                style={{ color: 'var(--text-muted)' }}
              >No</button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="relative flex-1 overflow-y-auto scrollbar-aero px-6 py-4 space-y-1" style={{ contain: 'layout paint' }}>
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

        {messages.map((msg, i) => {
          const isMine = msg.sender_id === user?.id;
          const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString();
          return (
            <div key={msg.id}>
              {showDate && (
                <div className="my-3 flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: 'var(--panel-divider)' }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {new Date(msg.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'var(--panel-divider)' }} />
                </div>
              )}
              <div className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'} ${i === messages.length - 1 && historyLoadedRef.current ? 'animate-slide-up' : ''}`}>
                {!isMine && <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="sm" />}
                <div className="max-w-[65%] rounded-aero-lg px-4 py-2.5"
                  style={isMine ? {
                    background: 'linear-gradient(165deg, #72e472 0%, #28b828 100%)',
                    boxShadow: '0 3px 14px rgba(30,160,30,0.35), inset 0 1px 0 rgba(255,255,255,0.50)',
                    border: '1px solid rgba(80,210,80,0.55)',
                    borderBottomRightRadius: 4,
                  } : {
                    background: 'var(--recv-bg)',
                    boxShadow: '0 2px 10px rgba(0,80,160,0.10), inset 0 1px 0 rgba(255,255,255,0.50)',
                    border: '1px solid var(--recv-border)',
                    borderBottomLeftRadius: 4,
                  }}>
                  <p className="text-sm leading-relaxed break-words" style={{ color: isMine ? '#fff' : 'var(--recv-text)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {msg.content === '[decryption failed]'
                      ? <span style={{ opacity: 0.55, fontStyle: 'italic', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Lock style={{ width: 11, height: 11 }} />Encrypted with a previous key</span>
                      : msg.content}
                  </p>
                  <p className="mt-0.5 flex items-center justify-end gap-0.5 text-[10px]" style={{ color: isMine ? 'rgba(255,255,255,0.62)' : 'var(--recv-time)' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMine && (
                      <span style={{ fontSize: 10, letterSpacing: '-1px', color: msg.read_at ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.50)' }}>
                        {msg.read_at ? ' ✓✓' : ' ✓'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

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

        <div ref={bottomRef} />
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
        <div className="flex items-center gap-3">
          <input
            className="aero-input flex-1 py-2.5 text-sm"
            placeholder={`Message ${contact.username}…`}
            value={input}
            onChange={handleInputChange}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
            disabled={sending || !hasPrivateKey}
          />
          <button type="submit" disabled={sending || !input.trim() || !hasPrivateKey} className="aero-btn-send">
            Send <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
