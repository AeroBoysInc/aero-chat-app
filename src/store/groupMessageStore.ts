import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { encryptGroupMessage, decryptGroupMessage } from '../lib/groupCrypto';
import { useGroupChatStore } from './groupChatStore';

// ── Types ──────────────────────────────────────────────────────────────────

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string; // decrypted plaintext
  created_at: string;
}

interface RawGroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string; // ciphertext base64
  nonce: string;   // base64
  created_at: string;
}

// ── Store ──────────────────────────────────────────────────────────────────

interface GroupMessageStore {
  chats: Record<string, GroupMessage[]>; // groupId → messages

  loadMessages: (groupId: string) => Promise<void>;
  sendMessage: (groupId: string, plaintext: string, senderId: string) => Promise<void>;
  appendMessage: (groupId: string, raw: RawGroupMessage) => void;
  clearChat: (groupId: string) => void;
}

export const useGroupMessageStore = create<GroupMessageStore>()((set, get) => ({
  chats: {},

  loadMessages: async (groupId) => {
    const groupKey = useGroupChatStore.getState().groupKeys.get(groupId);
    if (!groupKey) return;

    const { data } = await supabase
      .from('group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (!data) return;

    const decrypted: GroupMessage[] = [];
    for (const raw of data as RawGroupMessage[]) {
      const text = decryptGroupMessage(raw.content, raw.nonce, groupKey);
      if (text !== null) {
        decrypted.push({
          id: raw.id,
          group_id: raw.group_id,
          sender_id: raw.sender_id,
          content: text,
          created_at: raw.created_at,
        });
      }
    }

    set(s => ({ chats: { ...s.chats, [groupId]: decrypted } }));
  },

  sendMessage: async (groupId, plaintext, senderId) => {
    const groupKey = useGroupChatStore.getState().groupKeys.get(groupId);
    if (!groupKey) return;

    const { ciphertext, nonce } = encryptGroupMessage(plaintext, groupKey);

    const { data, error } = await supabase
      .from('group_messages')
      .insert({
        group_id: groupId,
        sender_id: senderId,
        content: ciphertext,
        nonce,
      })
      .select()
      .single();

    if (error || !data) return;

    // Optimistically add to local cache
    const msg: GroupMessage = {
      id: data.id,
      group_id: groupId,
      sender_id: senderId,
      content: plaintext,
      created_at: data.created_at,
    };
    set(s => ({
      chats: {
        ...s.chats,
        [groupId]: [...(s.chats[groupId] ?? []), msg],
      },
    }));
  },

  appendMessage: (groupId, raw) => {
    const groupKey = useGroupChatStore.getState().groupKeys.get(groupId);
    if (!groupKey) return;

    // Don't append duplicates
    const existing = get().chats[groupId] ?? [];
    if (existing.some(m => m.id === raw.id)) return;

    const text = decryptGroupMessage(raw.content, raw.nonce, groupKey);
    if (text === null) return;

    const msg: GroupMessage = {
      id: raw.id,
      group_id: raw.group_id,
      sender_id: raw.sender_id,
      content: text,
      created_at: raw.created_at,
    };

    set(s => ({
      chats: {
        ...s.chats,
        [groupId]: [...(s.chats[groupId] ?? []), msg],
      },
    }));
  },

  clearChat: (groupId) => {
    set(s => {
      const chats = { ...s.chats };
      delete chats[groupId];
      return { chats };
    });
  },
}));
