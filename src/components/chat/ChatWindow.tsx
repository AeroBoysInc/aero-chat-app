import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Lock, AlertCircle, ShieldAlert, Trash2, Mic, Play, Pause, Timer, Paperclip, Download, File as FileIcon, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { encryptMessage, decryptMessage, loadPrivateKey } from '../../lib/crypto';
import { useAuthStore, type Profile } from '../../store/authStore';
import { useUnreadStore } from '../../store/unreadStore';
import { useTypingStore } from '../../store/typingStore';
import { useFriendStore } from '../../store/friendStore';
import { useCornerStore } from '../../store/cornerStore';
import { loadChatCache, saveChatCache, clearChatCache, saveClearTimestamp, loadClearTimestamp } from '../../lib/chatCache';
import { AvatarImage, statusColor, statusLabel, type Status } from '../ui/AvatarImage';
import { AeroLogo } from '../ui/AeroLogo';
import { getExpiresAt } from '../../store/securityStore';
import { useAudioStore } from '../../store/audioStore';
import { usePresenceStore } from '../../store/presenceStore';
import { GAME_LABELS } from '../../lib/gameLabels';
import { ChessInviteCard } from '../chess/ChessInviteCard';
import { ImageLightbox } from './ImageLightbox';
import { MessageContent } from './MessageContent';
import { ExternalLinkModal } from './ExternalLinkModal';

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

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

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
  const { friends } = useFriendStore();
  const { gameViewActive, gameChatOverlay } = useCornerStore();
  const { inputDeviceId, outputDeviceId, noiseCancellation, inputVolume, outputVolume } = useAudioStore();
  const { playingGames } = usePresenceStore();
  const contactGame = playingGames.get(contact.id);
  // Always read status from the live friends list so it updates in real-time
  const liveStatus = ((friends.find(f => f.id === contact.id)?.status ?? contact.status) as Status | undefined) ?? 'online';

  // Read from localStorage synchronously — guaranteed to have data on refresh
  const [messages,      setMessages]      = useState<Message[]>(() => loadChatCache(contact.id));
  const [input,         setInput]         = useState('');
  const [sending,       setSending]       = useState(false);
  const [sendError,     setSendError]     = useState('');
  const [contactTyping,     setContactTyping]     = useState(false);
  const [showClearModal,    setShowClearModal]    = useState(false);
  const [reactions,         setReactions]         = useState<ReactionsMap>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [hoveredMsgId,      setHoveredMsgId]      = useState<string | null>(null);
  const [isRecording,       setIsRecording]       = useState(false);
  const [recordDuration,    setRecordDuration]    = useState(0);
  const [isUploading,       setIsUploading]       = useState(false);
  const [lightboxImage,     setLightboxImage]     = useState<{ url: string; name: string; size: number } | null>(null);
  const [pendingLinkUrl,    setPendingLinkUrl]    = useState<string | null>(null);

  const bottomRef          = useRef<HTMLDivElement>(null);
  const contactKeyRef      = useRef<string | null>(null);
  const channelRef         = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef        = useRef(false);
  const historyLoadedRef   = useRef(false);
  const pendingDecrypt     = useRef<Message[]>([]);
  const mediaRecorderRef   = useRef<MediaRecorder | null>(null);
  const audioChunksRef     = useRef<Blob[]>([]);
  const recordTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
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
    setMessages(loadChatCache(contact.id));
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
        saveChatCache(contact.id, allWithPending);
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
  useEffect(() => { setReactions({}); setReactionPickerFor(null); }, [contact.id]);

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
          saveChatCache(contact.id, next);
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
          saveChatCache(contact.id, next);
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

    const expiresAt = getExpiresAt();
    const ciphertext = encryptMessage(input.trim(), contactKeyRef.current!, privateKey);
    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id, recipient_id: contact.id, content: ciphertext,
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    }).select('id, sender_id, content, created_at, expires_at').single();

    if (error) {
      setSendError('Failed to send. Please try again.');
    } else if (data) {
      const sent: Message = { ...data, content: input.trim(), read_at: null };
      setMessages(prev => { const next = [...prev, sent]; saveChatCache(contact.id, next); return next; });
      setInput('');
    }
    setSending(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // ── Reactions ────────────────────────────────────────────────────────────────
  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    const alreadyReacted = reactions[messageId]?.[emoji]?.includes(user.id);
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
    }
    setReactionPickerFor(null);
  }, [user, reactions]);

  // ── Voice recording ──────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const audioConstraints: MediaTrackConstraints = {
        noiseSuppression: noiseCancellation,
        echoCancellation: noiseCancellation,
        ...(inputVolume !== 80 ? { } : {}), // volume is applied at playback side
        ...(inputDeviceId ? { deviceId: { exact: inputDeviceId } } : {}),
      };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => stream.getTracks().forEach(t => t.stop());
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
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
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
    const { data: freshKey } = await supabase.from('profiles').select('public_key').eq('id', contact.id).single();
    if (freshKey?.public_key) contactKeyRef.current = freshKey.public_key;
    const expiresAt = getExpiresAt();
    const ciphertext = encryptMessage(plaintext, contactKeyRef.current!, privateKey);
    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id, recipient_id: contact.id, content: ciphertext,
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    }).select('id, sender_id, content, created_at, expires_at').single();
    if (error) { setSendError('Failed to send.'); }
    else if (data) {
      const sent: Message = { ...data, content: plaintext, read_at: null };
      setMessages(prev => { const next = [...prev, sent]; saveChatCache(contact.id, next); return next; });
    }
    setSending(false);
  }

  // ── File / image sharing ──────────────────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (file.size > 10 * 1024 * 1024) {
      setSendError('File too large. Maximum size is 10 MB.');
      return;
    }

    setIsUploading(true);
    setSendError('');

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('chat-files').upload(path, file, { contentType: file.type });

    if (uploadError) {
      setSendError('Upload failed. Please try again.');
      setIsUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(path);
    await sendEncryptedContent(JSON.stringify({
      _file: true, url: publicUrl,
      name: file.name, size: file.size,
      mime: file.type || 'application/octet-stream',
    }));
    setIsUploading(false);
  }

  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div className="drag-region flex items-center gap-3 px-4 py-3.5"
        style={{ borderBottom: '1px solid var(--panel-divider)', background: 'var(--panel-header-bg)', backdropFilter: 'blur(12px)', borderRadius: '18px 18px 0 0' }}>
        {onBack && (
          <button
            onClick={onBack}
            className="no-drag flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-xl transition-all"
            style={{ background: 'var(--btn-ghost-bg)', border: '1px solid var(--btn-ghost-border)', color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--btn-ghost-bg)'}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="lg" status={liveStatus} />
        <div className="no-drag flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold truncate" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: 'var(--text-primary)', fontSize: 15 }}>
              {contact.username}
            </p>
            {/* Clear chat button — next to name */}
            <button
              onClick={() => setShowClearModal(true)}
              className="no-drag flex-shrink-0 rounded-aero p-1 transition-all"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e03f3f'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              title="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
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
              {contactGame && (
                <>
                  <span style={{ color: 'var(--separator-dot)' }}>·</span>
                  <span style={{ color: 'var(--game-activity-color)', fontWeight: 500 }}>
                    🎮 Playing {GAME_LABELS[contactGame as keyof typeof GAME_LABELS] ?? contactGame}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
        <div className="no-drag flex items-center gap-2">
          <AeroLogo size={20} className="opacity-20" />
          <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <Lock className="h-3 w-3" />
          </div>
        </div>
      </div>

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
                  clearChatCache(contact.id);
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
          const msgReactions = reactions[msg.id] ?? {};
          const hasReactions = Object.values(msgReactions).some(users => users.length > 0);
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
              <div
                className={`relative flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'} ${i === messages.length - 1 && historyLoadedRef.current ? 'animate-slide-up' : ''}`}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => { setHoveredMsgId(null); setReactionPickerFor(null); }}
              >
                {!isMine && <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="sm" />}

                <div className="flex flex-col" style={{ alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '65%' }}>
                  <div className="rounded-aero-lg px-4 py-2.5"
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
                    {isVoiceMessage(msg.content)
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
                        <p className="text-sm leading-relaxed break-words" style={{ color: isMine ? '#fff' : 'var(--recv-text)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                          <span style={{ opacity: 0.55, fontStyle: 'italic', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Lock style={{ width: 11, height: 11 }} />Encrypted with a previous key</span>
                        </p>
                      )
                      : (
                        <MessageContent
                          content={msg.content}
                          isMine={isMine}
                          textColor={isMine ? '#fff' : 'var(--recv-text)'}
                          onClickLink={setPendingLinkUrl}
                        />
                      )
                    }
                    <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px]" style={{ color: isMine ? 'rgba(255,255,255,0.62)' : 'var(--recv-time)' }}>
                      {msg.expires_at && (
                        <span title={`Expires ${new Date(msg.expires_at).toLocaleString()}`} style={{ display: 'flex', alignItems: 'center' }}>
                          <Timer style={{ width: 9, height: 9, opacity: 0.7 }} />
                        </span>
                      )}
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isMine && (
                        <span style={{ fontSize: 10, letterSpacing: '-1px', color: msg.read_at ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.50)' }}>
                          {msg.read_at ? ' ✓✓' : ' ✓'}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Reaction pills */}
                  {hasReactions && (
                    <div className="flex flex-wrap gap-1 mt-1" style={{ justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                      {Object.entries(msgReactions).filter(([, users]) => users.length > 0).map(([emoji, users]) => {
                        const mine = users.includes(user?.id ?? '');
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

                {/* Reaction add button — appears on hover */}
                {hoveredMsgId === msg.id && (
                  <div className="relative flex-shrink-0" style={{ order: isMine ? -1 : 1 }}>
                    <button
                      onClick={() => setReactionPickerFor(prev => prev === msg.id ? null : msg.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-sm transition-all hover:scale-110 active:scale-95"
                      style={{ background: 'var(--btn-ghost-bg)', border: '1px solid var(--btn-ghost-border)', color: 'var(--text-secondary)' }}
                    >
                      +
                    </button>
                    {reactionPickerFor === msg.id && (
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
                            style={{ background: reactions[msg.id]?.[emoji]?.includes(user?.id ?? '') ? 'rgba(0,212,255,0.18)' : 'transparent' }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
              accept="image/*,.pdf,.txt,.doc,.docx,.zip,.csv"
              onChange={handleFileSelect}
            />
            <input
              ref={inputRef}
              className="aero-input flex-1 py-2.5 text-sm"
              placeholder={`Message ${contact.username}…`}
              value={input}
              onChange={handleInputChange}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
              disabled={!hasPrivateKey}
            />
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
      </form>
      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
      {pendingLinkUrl && (
        <ExternalLinkModal
          url={pendingLinkUrl}
          onConfirm={() => { window.open(pendingLinkUrl, '_blank', 'noopener,noreferrer'); setPendingLinkUrl(null); }}
          onCancel={() => setPendingLinkUrl(null)}
        />
      )}
    </div>
  );
}
