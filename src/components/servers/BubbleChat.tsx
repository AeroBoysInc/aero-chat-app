// src/components/servers/BubbleChat.tsx
import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Mic, Paperclip, Play, Pause, Download, File as FileIcon, Smile, Trash2 } from 'lucide-react';
import { EmojiGifPicker } from '../ui/EmojiGifPicker';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useServerStore } from '../../store/serverStore';
import { useServerMessageStore } from '../../store/serverMessageStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
import { useAudioStore } from '../../store/audioStore';
import { AvatarImage } from '../ui/AvatarImage';
import { ProfileTooltip } from '../ui/ProfileTooltip';
import { MessageContent } from '../chat/MessageContent';
import { ImageLightbox } from '../chat/ImageLightbox';
import { ExternalLinkModal } from '../chat/ExternalLinkModal';
import { createNoisePipeline, createGainPipeline, type NoisePipeline } from '../../lib/noiseSuppression';
import type { BubbleMessage } from '../../lib/serverTypes';

// ── helpers ──────────────────────────────────────────────────────────────────

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

type ReactionsMap = Record<string, Record<string, string[]>>;

function isVoiceMessage(content: string): boolean {
  try { return JSON.parse(content)._voice === true; } catch { return false; }
}
function isFileMessage(content: string): boolean {
  try { return JSON.parse(content)._file === true; } catch { return false; }
}
function isGifMessage(content: string): boolean {
  try { return JSON.parse(content)._gif === true; } catch { return false; }
}
function parseGifMessage(content: string): { url: string; width: number; height: number; previewUrl: string } | null {
  try {
    const p = JSON.parse(content);
    if (p._gif) return { url: p.url, width: p.width, height: p.height, previewUrl: p.previewUrl };
    return null;
  } catch { return null; }
}

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
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

// Parse @mentions from text: @username → highlighted span
const MENTION_REGEX = /@(\w+)/g;

function renderMentionContent(
  content: string,
  memberUsernames: Set<string>,
  textColor: string,
  onClickLink: (url: string) => void,
  isMine: boolean,
) {
  // If it has a URL, delegate to MessageContent which handles links, then we overlay mentions
  // For simplicity: if content has links, use MessageContent; else render with mention highlights
  const hasUrl = /https?:\/\//.test(content);
  if (hasUrl) {
    return <MessageContent content={content} isMine={isMine} textColor={textColor} onClickLink={onClickLink} />;
  }

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX.source, 'g');
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIdx) {
      parts.push(<span key={lastIdx}>{content.slice(lastIdx, match.index)}</span>);
    }
    const username = match[1];
    const isMember = memberUsernames.has(username.toLowerCase());
    parts.push(
      <span
        key={match.index}
        style={{
          fontWeight: 600,
          color: isMember ? '#00d4ff' : textColor,
          background: isMember ? 'rgba(0,212,255,0.12)' : 'transparent',
          borderRadius: 4,
          padding: '0 2px',
        }}
      >
        @{username}
      </span>
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < content.length) {
    parts.push(<span key={lastIdx}>{content.slice(lastIdx)}</span>);
  }
  return (
    <p className="text-sm leading-relaxed break-words" style={{ color: textColor, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {parts}
    </p>
  );
}

// ── VoicePlayer (same as DM) ─────────────────────────────────────────────────

function VoicePlayer({ content, outputVolume, outputDeviceId }: { content: string; outputVolume: number; outputDeviceId: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let url = '';
    try {
      const { data } = JSON.parse(content);
      const blob = base64ToBlob(data, 'audio/webm');
      url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = outputVolume / 100;
      if (outputDeviceId && typeof (audio as any).setSinkId === 'function') {
        (audio as any).setSinkId(outputDeviceId).catch(() => {});
      }
      audioRef.current = audio;
      audio.ontimeupdate = () => setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
      audio.onended = () => { setPlaying(false); setProgress(0); };
    } catch {}
    return () => { audioRef.current?.pause(); if (url) URL.revokeObjectURL(url); };
  }, [content, outputVolume, outputDeviceId]);

  function toggle() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  }

  const dur = (() => { try { return JSON.parse(content).dur ?? 0; } catch { return 0; } })();

  return (
    <div className="flex items-center gap-2.5" style={{ minWidth: 160 }}>
      <button
        onClick={toggle}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
        style={{ background: 'rgba(0,100,200,0.12)', border: '1px solid rgba(0,100,200,0.22)' }}
      >
        {playing
          ? <Pause style={{ width: 13, height: 13, color: 'var(--text-primary)' }} />
          : <Play style={{ width: 13, height: 13, color: 'var(--text-primary)', marginLeft: 1 }} />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="relative h-1 rounded-full" style={{ background: 'rgba(0,80,160,0.18)' }}>
          <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${progress * 100}%`, background: '#1a6fd4' }} />
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtDuration(dur)}</span>
      </div>
    </div>
  );
}

// ── FileMessage ──────────────────────────────────────────────────────────────

function BubbleFileMessage({ content, onImageClick }: { content: string; onImageClick: (img: { url: string; name: string; size: number }) => void }) {
  const { url, name, size, mime } = JSON.parse(content) as { url: string; name: string; size: number; mime: string };
  const isImage = mime?.startsWith('image/');

  if (isImage) {
    return (
      <button type="button" className="block cursor-pointer text-left" onClick={() => onImageClick({ url, name, size })}>
        <img src={url} alt={name} className="rounded-aero block" style={{ maxWidth: 220, maxHeight: 220, objectFit: 'cover', display: 'block' }} />
        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{name}</p>
      </button>
    );
  }

  return (
    <a href={url} download={name} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 no-underline" style={{ minWidth: 180 }}>
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-aero"
        style={{ background: 'rgba(0,100,200,0.12)', border: '1px solid rgba(0,100,200,0.22)' }}>
        <FileIcon style={{ width: 16, height: 16, color: '#1a6fd4' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{name}</p>
        <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtBytes(size)}</p>
      </div>
      <Download style={{ width: 14, height: 14, flexShrink: 0, color: '#1a6fd4' }} />
    </a>
  );
}

// ── MentionAutocomplete ──────────────────────────────────────────────────────

function MentionAutocomplete({ query, members, onSelect }: {
  query: string;
  members: { user_id: string; username?: string }[];
  onSelect: (username: string) => void;
  onClose?: () => void;
}) {
  const filtered = members.filter(m =>
    m.username && m.username.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  if (filtered.length === 0) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-1 rounded-[12px] overflow-hidden"
      style={{
        background: 'var(--sidebar-bg)',
        border: '1px solid var(--panel-divider)',
        boxShadow: '0 -8px 24px rgba(0,0,0,0.3)',
        zIndex: 20,
        maxHeight: 200,
        overflowY: 'auto',
      }}
    >
      {filtered.map(m => (
        <button
          key={m.user_id}
          className="w-full flex items-center gap-2 px-3 py-2 transition-colors text-left"
          style={{ fontSize: 12, color: 'var(--text-primary)' }}
          onMouseDown={e => { e.preventDefault(); onSelect(m.username!); }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ color: '#00d4ff', fontWeight: 600 }}>@</span>
          {m.username}
        </button>
      ))}
    </div>
  );
}

// ── Main BubbleChat ──────────────────────────────────────────────────────────

export const BubbleChat = memo(function BubbleChat() {
  const user = useAuthStore(s => s.user);
  const { selectedBubbleId, bubbles, members } = useServerStore();
  const { roles } = useServerRoleStore();
  const { bubbles: msgCache, setBubble, appendMessage } = useServerMessageStore();
  const { outputVolume, outputDeviceId, inputDeviceId, noiseCancellation, inputVolume } = useAudioStore();

  const bubble = bubbles.find(b => b.id === selectedBubbleId);
  const messages = msgCache[selectedBubbleId ?? ''] ?? [];
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [reactions, setReactions] = useState<ReactionsMap>({});
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string; size: number } | null>(null);
  const [pendingLinkUrl, setPendingLinkUrl] = useState<string | null>(null);
  const [sendError, setSendError] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const recordingPipelineRef = useRef<NoisePipeline | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Mention autocomplete
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerAnchorRef = useRef<HTMLDivElement>(null);
  const reactionsRef = useRef(reactions);
  reactionsRef.current = reactions;

  const memberUsernames = useMemo(
    () => new Set(members.filter(m => m.username).map(m => m.username!.toLowerCase())),
    [members]
  );

  // Load messages + reactions on mount
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

      // Load reactions for these messages
      if (data && data.length > 0) {
        const msgIds = data.map(m => m.id);
        const { data: rxns } = await supabase
          .from('bubble_reactions')
          .select('message_id, user_id, emoji')
          .in('message_id', msgIds);
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
    })();
  }, [selectedBubbleId]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedBubbleId) return;
    const channel = supabase
      .channel(`bubble-full:${selectedBubbleId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bubble_messages',
        filter: `bubble_id=eq.${selectedBubbleId}`,
      }, (payload) => {
        const msg = payload.new as BubbleMessage;
        appendMessage(selectedBubbleId, msg);
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'bubble_reactions',
      }, (payload) => {
        const r = payload.new as { message_id: string; user_id: string; emoji: string };
        setReactions(prev => {
          const next = { ...prev, [r.message_id]: { ...prev[r.message_id] } };
          if (!next[r.message_id][r.emoji]) next[r.message_id][r.emoji] = [];
          if (!next[r.message_id][r.emoji].includes(r.user_id)) {
            next[r.message_id][r.emoji] = [...next[r.message_id][r.emoji], r.user_id];
          }
          return next;
        });
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'bubble_reactions',
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
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [selectedBubbleId, user?.id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Sending ─────────────────────────────────────────────────────────────────

  async function sendContent(content: string) {
    if (!user || !selectedBubbleId) return;
    setSending(true);
    setSendError('');
    const { error } = await supabase.from('bubble_messages').insert({
      bubble_id: selectedBubbleId,
      sender_id: user.id,
      content,
    });
    if (error) setSendError('Failed to send.');
    setSending(false);
  }

  const handleSend = useCallback(async () => {
    if (!input.trim() || !user || !selectedBubbleId || sending) return;
    const text = input.trim();
    setInput('');
    setMentionQuery(null);
    await sendContent(text);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [input, user, selectedBubbleId, sending]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setInput(prev => prev + emoji);
    inputRef.current?.focus();
  }, []);

  const sendContentRef = useRef(sendContent);
  sendContentRef.current = sendContent;

  const handleGifSelect = useCallback(async (gif: { url: string; width: number; height: number; previewUrl: string }) => {
    await sendContentRef.current(JSON.stringify({ _gif: true, ...gif }));
  }, []);

  // ── Delete message ───────────────────────────────────────────────────────────
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user || !selectedBubbleId) return;
    setBubble(selectedBubbleId, messages.filter(m => m.id !== messageId));
    await supabase.from('bubble_messages').delete().eq('id', messageId).eq('sender_id', user.id);
  }, [user, selectedBubbleId, messages, setBubble]);

  // ── Reactions ───────────────────────────────────────────────────────────────

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    const alreadyReacted = reactionsRef.current[messageId]?.[emoji]?.includes(user.id);
    if (alreadyReacted) {
      await supabase.from('bubble_reactions').delete()
        .eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji);
      setReactions(prev => {
        const next = { ...prev, [messageId]: { ...prev[messageId] } };
        next[messageId][emoji] = (next[messageId][emoji] ?? []).filter(id => id !== user.id);
        return next;
      });
    } else {
      await supabase.from('bubble_reactions').insert({ message_id: messageId, user_id: user.id, emoji });
      setReactions(prev => {
        const next = { ...prev, [messageId]: { ...prev[messageId] } };
        next[messageId][emoji] = [...(next[messageId][emoji] ?? []), user.id];
        return next;
      });
    }
  }, [user]);

  // ── Voice recording ─────────────────────────────────────────────────────────

  async function startRecording() {
    try {
      const audioConstraints: MediaTrackConstraints = {
        noiseSuppression: false, echoCancellation: true, autoGainControl: false,
        ...(inputDeviceId ? { deviceId: { exact: inputDeviceId } } : {}),
      };
      const rawStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      rawStreamRef.current = rawStream;

      const pipeline = noiseCancellation
        ? await createNoisePipeline(rawStream)
        : await createGainPipeline(rawStream);
      if (!rawStreamRef.current) { pipeline.dispose(); rawStream.getTracks().forEach(t => t.stop()); return; }
      pipeline.setInputGain(inputVolume / 100);
      recordingPipelineRef.current = pipeline;
      const recordStream = pipeline.processedStream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
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
        setRecordDuration(d => { if (d >= 60) { stopAndSendRecording(); return d; } return d + 1; });
      }, 1000);
    } catch { setSendError('Microphone access denied.'); }
  }

  function cancelRecording() {
    const rs = rawStreamRef.current;
    rawStreamRef.current = null;
    rs?.getTracks().forEach(t => t.stop());
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current) { mediaRecorderRef.current.onstop = null; mediaRecorderRef.current.stop(); mediaRecorderRef.current = null; }
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
      await sendContent(JSON.stringify({ _voice: true, data: base64, dur }));
    };
  }

  // ── File upload ─────────────────────────────────────────────────────────────

  async function uploadAndSendFile(file: File) {
    if (!user) return;
    const isPrem = user?.is_premium === true;
    const maxBytes = isPrem ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxBytes) { setSendError(`File too large (max ${isPrem ? '50' : '10'} MB).${!isPrem ? ' Upgrade for 50 MB.' : ''}`); return; }
    setIsUploading(true);
    setSendError('');
    const bucket = isPrem ? 'chat-files-premium' : 'chat-files';
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const path = `${user.id}/bubbles/${selectedBubbleId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
    if (uploadError) { setSendError('Upload failed.'); setIsUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    await sendContent(JSON.stringify({ _file: true, url: publicUrl, name: file.name, size: file.size, mime: file.type || 'application/octet-stream' }));
    setIsUploading(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    uploadAndSendFile(file);
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

  // ── Mention handling ────────────────────────────────────────────────────────

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInput(val);

    // Check for @ at cursor position
    const cursor = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
    } else {
      setMentionQuery(null);
    }
  }

  function handleMentionSelect(username: string) {
    const cursor = inputRef.current?.selectionStart ?? input.length;
    const textBefore = input.slice(0, cursor);
    const atIdx = textBefore.lastIndexOf('@');
    const newInput = input.slice(0, atIdx) + `@${username} ` + input.slice(cursor);
    setInput(newInput);
    setMentionQuery(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // Helper to get member info + role for a sender
  const getSenderInfo = useCallback((senderId: string) => {
    const member = members.find(m => m.user_id === senderId);
    const role = member ? (roles.find(r => r.id === member.role_id) ?? null) : null;
    return {
      username: member?.username ?? 'Unknown',
      avatarUrl: member?.avatar_url,
      role,
      cardGradient: member?.card_gradient,
      cardImageUrl: member?.card_image_url,
      cardImageParams: member?.card_image_params,
    };
  }, [members, roles]);

  if (!bubble) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }} />
        {messages.map((msg) => {
          const { username, avatarUrl, role, cardGradient, cardImageUrl, cardImageParams } = getSenderInfo(msg.sender_id);
          const isMine = msg.sender_id === user?.id;
          const msgReactions = reactions[msg.id] ?? {};
          const reactionEntries = Object.entries(msgReactions).filter(([, ids]) => ids.length > 0);

          return (
            <BubbleMessageItem
              key={msg.id}
              msg={msg}
              username={username}
              avatarUrl={avatarUrl}
              role={role}
              cardGradient={cardGradient}
              cardImageUrl={cardImageUrl}
              cardImageParams={cardImageParams}
              isMine={isMine}
              msgReactions={reactionEntries}
              memberUsernames={memberUsernames}
              userId={user?.id}
              outputVolume={outputVolume}
              outputDeviceId={outputDeviceId}
              toggleReaction={toggleReaction}
              deleteMessage={deleteMessage}
              setLightboxImage={setLightboxImage}
              setPendingLinkUrl={setPendingLinkUrl}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-3 pb-3" style={{ position: 'relative' }}>
        {sendError && (
          <div className="mb-2 px-3 py-1.5 rounded-aero text-xs" style={{ background: 'rgba(255,80,50,0.12)', color: '#ff5032', border: '1px solid rgba(255,80,50,0.25)' }}>
            {sendError}
          </div>
        )}

        {mentionQuery !== null && (
          <MentionAutocomplete
            query={mentionQuery}
            members={members}
            onSelect={handleMentionSelect}
            onClose={() => setMentionQuery(null)}
          />
        )}

        {isRecording ? (
          <div
            className="flex items-center gap-3 rounded-aero-lg px-3 py-2.5"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
          >
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: '#ff2e63', animation: 'aura-pulse 1s infinite' }} />
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>Recording</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'ui-monospace, monospace' }}>{fmtDuration(recordDuration)}</span>
            <div className="flex-1" />
            <button onClick={cancelRecording} className="rounded-aero px-2.5 py-1 text-xs" style={{ background: 'rgba(255,80,50,0.12)', color: '#ff5032' }}>Cancel</button>
            <button onClick={stopAndSendRecording} className="rounded-aero px-2.5 py-1 text-xs" style={{ background: 'rgba(0,200,100,0.12)', color: '#3dd87a' }}>Send</button>
          </div>
        ) : (
          <div
            ref={pickerAnchorRef}
            className="flex items-center gap-2 rounded-aero-lg px-3"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
          >
            <input
              ref={inputRef}
              className="flex-1 bg-transparent py-2.5 text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
              placeholder={`Message #${bubble.name}...`}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
            />
            <button
              onClick={() => setEmojiPickerOpen(p => !p)}
              className="transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
              title="Emoji & GIF"
            >
              <Smile className="h-4 w-4" />
            </button>
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,.pdf,.txt,.doc,.docx,.zip,.csv,.mp4,.mov,.webm,.avi,.mkv" onChange={handleFileSelect} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || isUploading}
              className="transition-opacity hover:opacity-70 disabled:opacity-30"
              style={{ color: 'var(--text-muted)' }}
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              onClick={startRecording}
              disabled={sending || isUploading}
              className="transition-opacity hover:opacity-70 disabled:opacity-30"
              style={{ color: 'var(--text-muted)' }}
              title="Voice message"
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="transition-opacity hover:opacity-70 disabled:opacity-30"
              style={{ color: '#00d4ff' }}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImage && <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />}

      {/* External link modal */}
      {pendingLinkUrl && (
        <ExternalLinkModal
          url={pendingLinkUrl}
          onConfirm={() => { window.open(pendingLinkUrl, '_blank', 'noopener'); setPendingLinkUrl(null); }}
          onCancel={() => setPendingLinkUrl(null)}
        />
      )}

      <EmojiGifPicker
        open={emojiPickerOpen}
        onClose={() => setEmojiPickerOpen(false)}
        onEmojiSelect={handleEmojiSelect}
        onGifSelect={handleGifSelect}
        userId={user?.id ?? ''}
        anchorRef={pickerAnchorRef}
      />
    </div>
  );
});

// ── Per-message row ──────────────────────────────────────────────────────────

const BubbleMessageItem = memo(function BubbleMessageItem({
  msg, username, avatarUrl, role, cardGradient, cardImageUrl, cardImageParams,
  isMine: _isMine, msgReactions, memberUsernames, userId,
  outputVolume, outputDeviceId, toggleReaction, deleteMessage, setLightboxImage, setPendingLinkUrl,
}: {
  msg: BubbleMessage;
  username: string;
  avatarUrl?: string | null;
  role: { color: string; name: string; is_owner_role: boolean; position: number } | null;
  cardGradient?: string | null;
  cardImageUrl?: string | null;
  cardImageParams?: any;
  isMine: boolean;
  msgReactions: [string, string[]][];
  memberUsernames: Set<string>;
  userId?: string;
  outputVolume: number;
  outputDeviceId: string;
  toggleReaction: (msgId: string, emoji: string) => void;
  deleteMessage: (msgId: string) => void;
  setLightboxImage: (img: { url: string; name: string; size: number } | null) => void;
  setPendingLinkUrl: (url: string | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const isVoice = isVoiceMessage(msg.content);
  const isFile = isFileMessage(msg.content);
  const isGif = isGifMessage(msg.content);

  return (
    <div
      className="flex gap-2.5 py-1.5 group"
      style={{ alignItems: 'flex-start', position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPickerOpen(false); }}
    >
      <ProfileTooltip data={{
        username,
        avatarUrl,
        cardGradient,
        cardImageUrl,
        cardImageParams,
        role: role ? { name: role.is_owner_role ? 'Owner' : role.name, color: role.color } : null,
      }}>
        <AvatarImage username={username} avatarUrl={avatarUrl} size="sm" />
      </ProfileTooltip>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 12, fontWeight: 500, color: role?.color ?? 'var(--text-primary)' }}>
            {username}
          </span>
          {role && !role.is_owner_role && role.position > 1 && (
            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: `${role.color}20`, color: role.color }}>{role.name}</span>
          )}
          {role?.is_owner_role && (
            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: `${role.color}20`, color: role.color }}>Owner</span>
          )}
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Content */}
        <div className="selectable" style={{ marginTop: 2 }}>
          {isGif ? (() => {
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
          })() : isVoice ? (
            <VoicePlayer content={msg.content} outputVolume={outputVolume} outputDeviceId={outputDeviceId} />
          ) : isFile ? (
            <BubbleFileMessage content={msg.content} onImageClick={setLightboxImage} />
          ) : (
            renderMentionContent(msg.content, memberUsernames, 'var(--text-primary)', setPendingLinkUrl, false)
          )}
        </div>

        {/* Reactions display */}
        {msgReactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {msgReactions.map(([emoji, userIds]) => (
              <button
                key={emoji}
                onClick={() => toggleReaction(msg.id, emoji)}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-all"
                style={{
                  background: userId && userIds.includes(userId) ? 'rgba(0,212,255,0.18)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${userId && userIds.includes(userId) ? 'rgba(0,212,255,0.30)' : 'var(--panel-divider)'}`,
                  cursor: 'pointer',
                }}
              >
                <span>{emoji}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{userIds.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover actions — reaction picker + delete */}
      {hovered && (
        <div className="absolute -top-1 right-0 flex items-center gap-1" style={{ zIndex: 10 }}>
          {_isMine && (
            <button
              onClick={() => deleteMessage(msg.id)}
              className="flex items-center justify-center rounded-full transition-all hover:scale-110"
              style={{
                width: 28, height: 28,
                background: 'rgba(220,50,50,0.12)',
                border: '1px solid rgba(220,50,50,0.25)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                color: '#d03030',
              }}
              title="Delete message"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          {pickerOpen ? (
            <div className="flex gap-0.5 rounded-full px-1.5 py-1" style={{ background: 'var(--sidebar-bg)', border: '1px solid var(--panel-divider)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
              {REACTION_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => { toggleReaction(msg.id, emoji); setPickerOpen(false); }}
                  className="h-7 w-7 flex items-center justify-center rounded-full transition-transform hover:scale-125"
                  style={{ fontSize: 14 }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setPickerOpen(true)}
              className="flex items-center justify-center rounded-full transition-all hover:scale-110"
              style={{
                width: 28, height: 28,
                background: 'var(--sidebar-bg)',
                border: '1px solid var(--panel-divider)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                fontSize: 12,
              }}
            >
              😀
            </button>
          )}
        </div>
      )}
    </div>
  );
});
