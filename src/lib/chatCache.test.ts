import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadChatCache,
  saveChatCache,
  clearChatCache,
  pruneUnscopedCaches,
  type CachedMessage,
} from './chatCache';

const USER_A = 'user-aaa';
const USER_B = 'user-bbb';
const CONTACT = 'contact-111';

const msg = (id: string): CachedMessage => ({
  id,
  sender_id: USER_A,
  content: 'hello',
  created_at: new Date().toISOString(),
});

beforeEach(() => localStorage.clear());

describe('scoped cache keys', () => {
  it('saves and loads under userId:contactId key', () => {
    saveChatCache(USER_A, CONTACT, [msg('m1')]);
    const result = loadChatCache(USER_A, CONTACT);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m1');
  });

  it('user B cannot read user A cache', () => {
    saveChatCache(USER_A, CONTACT, [msg('m1')]);
    const result = loadChatCache(USER_B, CONTACT);
    expect(result).toHaveLength(0);
  });

  it('clearChatCache removes only the scoped key', () => {
    saveChatCache(USER_A, CONTACT, [msg('m1')]);
    saveChatCache(USER_B, CONTACT, [msg('m2')]);
    clearChatCache(USER_A, CONTACT);
    expect(loadChatCache(USER_A, CONTACT)).toHaveLength(0);
    expect(loadChatCache(USER_B, CONTACT)).toHaveLength(1);
  });

  it('stores key in aero-chat-{userId}:{contactId} format', () => {
    saveChatCache(USER_A, CONTACT, [msg('m1')]);
    expect(localStorage.getItem(`aero-chat-${USER_A}:${CONTACT}`)).not.toBeNull();
  });
});

describe('pruneUnscopedCaches', () => {
  it('removes old-format keys (no colon)', () => {
    localStorage.setItem('aero-chat-contact-111', JSON.stringify([msg('old')]));
    pruneUnscopedCaches();
    expect(localStorage.getItem('aero-chat-contact-111')).toBeNull();
  });

  it('leaves new scoped keys intact', () => {
    saveChatCache(USER_A, CONTACT, [msg('m1')]);
    pruneUnscopedCaches();
    expect(loadChatCache(USER_A, CONTACT)).toHaveLength(1);
  });

  it('leaves unrelated keys intact', () => {
    localStorage.setItem('aero-clear-user-aaa-contact-111', new Date().toISOString());
    pruneUnscopedCaches();
    expect(localStorage.getItem('aero-clear-user-aaa-contact-111')).not.toBeNull();
  });
});
