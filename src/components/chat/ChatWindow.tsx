import { useState, useEffect, useRef } from 'react';
import { Send, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { encryptMessage, decryptMessage, loadPrivateKey } from '../../lib/crypto';
import { useAuthStore, type Profile } from '../../store/authStore';

interface Message {
  id: string;
  sender_id: string;
  content: string;       // decrypted plaintext (or '[decryption failed]')
  created_at: string;
}

interface Props { contact: Profile; }

export function ChatWindow({ contact }: Props) {
  const { user } = useAuthStore();
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState('');
  const [sending,   setSending]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function decrypt(ciphertext: string, senderId: string): string {
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

    const privateKey = loadPrivateKey();
    if (!privateKey) { setSending(false); return; }

    const ciphertext = encryptMessage(input.trim(), contact.public_key, privateKey);

    const { data, error } = await supabase.from('messages').insert({
      sender_id:    user.id,
      recipient_id: contact.id,
      content:      ciphertext,
    }).select('id, sender_id, content, created_at').single();

    if (!error && data) {
      setMessages(prev => [...prev, { ...data, content: input.trim() }]);
    }
    setInput('');
    setSending(false);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="drag-region flex items-center gap-3 border-b border-white/15 bg-white/5 px-6 py-4">
        <div className="no-drag flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-aero-cyan/60 to-aero-blue text-sm font-bold text-white">
          {contact.username[0].toUpperCase()}
        </div>
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
        <div className="flex items-center gap-3">
          <input
            className="aero-input flex-1 py-3"
            placeholder={`Message ${contact.username}…`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
            disabled={sending}
          />
          <button type="submit" disabled={sending || !input.trim()} className="aero-btn-primary h-11 w-11 rounded-full p-0">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
