import { useEffect } from 'react';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import { useFriendStore } from './store/friendStore';
import { useChatStore } from './store/chatStore';
import { useUnreadStore } from './store/unreadStore';
import { useStatusStore } from './store/statusStore';
import { usePresenceStore } from './store/presenceStore';
import { generateKeyPair, savePrivateKey, loadPrivateKey } from './lib/crypto';
import { requestNotificationPermission, showMessageNotification } from './lib/notifications';
import { loadSelectedContactId } from './lib/chatCache';
import { AuthPage } from './components/auth/AuthPage';
import { ChatLayout } from './components/chat/ChatLayout';

export default function App() {
  const { user, loading, setUser } = useAuthStore();
  const { loadFriends, subscribeToRequests } = useFriendStore();
  const { increment } = useUnreadStore();

  useEffect(() => {
    let settled = false;

    async function resolveSession(userId: string) {
      // Use maybeSingle so we get null (not a 406 error) when the profile row
      // doesn't exist yet — this happens when onAuthStateChange fires during
      // registration before RegisterForm has finished inserting the profile.
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, public_key, avatar_url, status')
        .eq('id', userId)
        .maybeSingle();

      if (!profile) {
        // Profile not created yet (mid-registration). Leave settled = false so
        // the next auth event (SIGNED_IN after login) will try again.
        setUser(null);
        return;
      }

      // Ensure a keypair exists for this session. Generates a new one only if
      // the private key is missing (new device, cleared storage, post-sign-out).
      if (!loadPrivateKey()) {
        const kp = generateKeyPair();
        savePrivateKey(kp.privateKey);
        await supabase.from('profiles').update({ public_key: kp.publicKey }).eq('id', userId);
        profile.public_key = kp.publicKey;
      }

      setUser(profile);
      settled = true;
      // Push locally-stored status to Supabase so other users see it immediately
      useStatusStore.getState().syncToSupabase(profile.id);
      // Request desktop notification permission once
      requestNotificationPermission();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setUser(null); settled = false; return; }
      if (settled) return;
      resolveSession(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load friends, subscribe to requests, and restore the last open chat
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToRequests(user.id);
    loadFriends(user.id).then(() => {
      // After friends load, restore the last selected contact from localStorage.
      // Only do this once — if a contact is already selected, leave it alone.
      if (useChatStore.getState().selectedContact) return;
      const persistedId = loadSelectedContactId();
      if (!persistedId) return;
      const live = useFriendStore.getState().friends.find(f => f.id === persistedId);
      if (live) useChatStore.getState().setSelectedContact(live);
    });
    return unsub;
  }, [user?.id]);

  // Global unread counter + desktop notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`inbox:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${user.id}`,
      }, (payload) => {
        const msg = payload.new as { sender_id: string };
        const activeId = useChatStore.getState().selectedContact?.id;
        if (msg.sender_id !== activeId) {
          increment(msg.sender_id);
          // Desktop notification
          const sender = useFriendStore.getState().friends.find(f => f.id === msg.sender_id);
          if (sender) showMessageNotification(sender.username, '🔒 Encrypted message');
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Global presence channel — detects who is actually connected
  useEffect(() => {
    if (!user) return;
    const { setOnlineIds, setPresenceReady } = usePresenceStore.getState();
    const channel = supabase
      .channel('global:online', { config: { presence: { key: user.id } } })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const newIds = new Set(Object.keys(state));
        // Skip re-render if the set of online users hasn't changed
        const prev = usePresenceStore.getState().onlineIds;
        const changed = newIds.size !== prev.size || [...newIds].some(id => !prev.has(id));
        if (changed) setOnlineIds(newIds);
        setPresenceReady(true);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ connected: true });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-aero-cyan" />
      </div>
    );
  }

  return user ? <ChatLayout /> : <AuthPage />;
}
