import { useState, useEffect, useRef } from 'react';
import { Send, Lock, UserPlus, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { encryptMessage, decryptMessage, loadPrivateKey } from '../../lib/crypto';
import { useAuthStore, type Profile } from '../../store/authStore';
import { useFriendStore } from '../../store/friendStore';
import { AvatarImage } from '../ui/AvatarImage';

interface Message {
  id: string;
  sender_id: string;
  content: string;       // decrypted plaintext (or '[decryption failed]')
  created_at: string;
}

interface Props { contact: Profile; }

export function ChatWindow({ contact }: Props) {
  const { user } = useAuthStore();
  const { friends, loadFriends } = useFriendStore();
  const isFriend = friends.some((f) => f.id === contact.id);
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState('');
  const [sending,   setSending]   = useState(false);
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fallback: re-check friend status when opening a chat window, in case
  // the realtime UPDATE subscription missed the accepted-request event.
  useEffect(() => {
    if (!user) return;
    loadFriends(user.id);
  }, [contact.id, user?.id]);

  function decrypt(ciphertext: string, _senderId: string): string {
    const privateKey = loadPrivateKey();
    if (!privateKey) return '[no private key]';
    const result = decryptMessage(ciphertext, contact.public_key, privateKey);
    return result ?? '[decryption failed]';
  }

  // Load history
  useEffect(() => {
    if (!user) return;
    supabase
      .from('messages')
      .select('id, sender_id, content, created_at')
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${contact.id}),` +
        `and(sender_id.eq.${contact.id},recipient_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!data) return;
        setMessages(data.map(m => ({ ...m, content: decrypt(m.content, m.sender_id) })));
      });
  }, [contact.id, user]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`dm:${[user.id, contact.id].sort().join(':')}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${user.id}`,
      }, (payload) => {
        const m = payload.new as any;
        if (m.sender_id !== contact.id) return;
        setMessages(prev => [...prev, { ...m, content: decrypt(m.content, m.sender_id) }]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [contact.id, user]);

  // Scroll to bottom
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !user) return;
    setSending(true);
    setSendError('');

    const privateKey = loadPrivateKey();
    if (!privateKey) { setSending(false); return; }

    const ciphertext = encryptMessage(input.trim(), contact.public_key, privateKey);

    const { data, error } = await supabase.from('messages').insert({
      sender_id:    user.id,
      recipient_id: contact.id,
      content:      ciphertext,
    }).select('id, sender_id, content, created_at').single();

    if (error) {
      setSendError('Failed to send. Please try again.');
    } else if (data) {
      setMessages(prev => [...prev, { ...data, content: input.trim() }]);
      setInput('');
    }
    setSending(false);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="drag-region flex items-center gap-3 border-b border-white/15 bg-white/5 px-6 py-4">
        <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="lg" />
        <div className="no-drag">
          <p className="font-semibold text-white">{contact.username}</p>
          <p className="flex items-center gap-1 text-[10px] text-aero-green">
            <Lock className="h-2.5 w-2.5" /> End-to-end encrypted
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-aero px-6 py-4 space-y-2">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Lock className="mx-auto mb-2 h-8 w-8 text-white/20" />
              <p className="text-sm text-white/40">Messages are end-to-end encrypted.</p>
              <p className="text-xs text-white/25">Say hello to {contact.username}!</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMine = msg.sender_id === user?.id;
          const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[i-1].created_at).toDateString();
          return (
            <div key={msg.id}>
              {showDate && (
                <div className="my-3 flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] text-white/30">{new Date(msg.created_at).toLocaleDateString()}</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              )}
              <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                <div className={`max-w-[70%] rounded-aero-lg px-4 py-2.5 ${
                  isMine
                    ? 'bg-gradient-to-br from-aero-cyan/70 to-aero-blue/70 text-white'
                    : 'glass text-white'
                }`}>
                  <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                  <p className={`mt-1 text-right text-[10px] ${isMine ? 'text-white/50' : 'text-white/35'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="border-t border-white/15 bg-white/5 px-6 py-4">
        {!isFriend && (
          <div className="mb-3 flex items-center gap-2 rounded-aero border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/50">
            <UserPlus className="h-4 w-4 shrink-0" />
            Add {contact.username} as a friend to start messaging.
          </div>
        )}
        {sendError && (
          <div className="mb-3 flex items-center gap-2 rounded-aero border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {sendError}
          </div>
        )}
        <div className="flex items-center gap-3">
          <input
            className="aero-input flex-1 py-3"
            placeholder={isFriend ? `Message ${contact.username}…` : 'Add as friend to chat'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
            disabled={sending || !isFriend}
          />
          <button type="submit" disabled={sending || !input.trim() || !isFriend} className="aero-btn-primary h-11 w-11 rounded-full p-0">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
