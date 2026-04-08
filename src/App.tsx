import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import { useFriendStore } from './store/friendStore';
import { useChatStore } from './store/chatStore';
import { useCornerStore } from './store/cornerStore';
import { useUnreadStore } from './store/unreadStore';
import { useStatusStore } from './store/statusStore';
import { usePresenceStore } from './store/presenceStore';
import { useCallStore } from './store/callStore';
import { useGroupCallStore } from './store/groupCallStore';
import { useServerStore } from './store/serverStore';
import { useXpStore } from './store/xpStore';
import { generateKeyPair, savePrivateKey, loadPrivateKey, encryptPrivateKey, decryptPrivateKey } from './lib/crypto';
import { consumePendingPassword } from './lib/keyRestoration';
import { requestNotificationPermission, showMessageNotification, showCallNotification } from './lib/notifications';
import { clearAllChatCaches, pruneUnscopedCaches } from './lib/chatCache';
import { AuthPage } from './components/auth/AuthPage';
import { ChatLayout } from './components/chat/ChatLayout';
import { GameNotification } from './components/ui/GameNotification';
import { MentionNotification } from './components/ui/MentionNotification';
import { SplashScreen } from './components/ui/SplashScreen';

const SPLASH_MIN_MS = 1800; // minimum splash display time

export default function App() {
  const { user, loading, setUser } = useAuthStore();
  const { loadFriends, subscribeToRequests } = useFriendStore();
  const { loadServers, loadAllServerMembers, subscribeBubbleUnreads, seedBubbleUnreads } = useServerStore();
  const { increment, seed } = useUnreadStore();
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingPresenceSync = useRef(false);
  const selectedGame       = useCornerStore(s => s.selectedGame);
  const { showGameActivity } = useStatusStore();

  // ── Splash screen state ──
  const [splashReady, setSplashReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const splashStart = useRef(0);

  // Track when user becomes available — start the minimum timer
  useEffect(() => {
    if (!user) {
      setSplashReady(false);
      setSplashDone(false);
      splashStart.current = 0;
      return;
    }
    if (!splashStart.current) splashStart.current = Date.now();
    const elapsed = Date.now() - splashStart.current;
    const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
    const t = setTimeout(() => setSplashReady(true), remaining);
    return () => clearTimeout(t);
  }, [user]);

  const handleSplashRevealed = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    // Idle = tab hidden OR another window/app has OS focus (e.g. gaming on primary monitor
    // while AeroChat sits on a second monitor). Both conditions kill GPU/JS frame work.
    const idle = () => document.hidden || !document.hasFocus()

    const handler = () => {
      const isIdle = idle()
      document.documentElement.classList.toggle('paused', isIdle)
      document.dispatchEvent(
        new CustomEvent('aerochat:visibilitychange', { detail: { hidden: isIdle } })
      )

      // Flush any presence sync that was skipped while the tab was fully hidden
      if (!document.hidden && pendingPresenceSync.current) {
        pendingPresenceSync.current = false;
        const ch = presenceChannelRef.current;
        if (ch) {
          const { setOnlineIds, setPresenceReady, setPlayingGames } = usePresenceStore.getState();
          const state = ch.presenceState();
          const newIds = new Set(Object.keys(state));
          const prev = usePresenceStore.getState().onlineIds;
          const changed = newIds.size !== prev.size || [...newIds].some(id => !prev.has(id));
          if (changed) setOnlineIds(newIds);
          setPresenceReady(true);
          const newGames = new Map<string, string>();
          for (const [userId, presences] of Object.entries(state)) {
            const p = (presences as any[])[0];
            if (p?.playingGame) newGames.set(userId, p.playingGame);
          }
          const prevGames = usePresenceStore.getState().playingGames;
          const gamesChanged = newGames.size !== prevGames.size ||
            [...newGames.entries()].some(([k, v]) => prevGames.get(k) !== v);
          if (gamesChanged) setPlayingGames(newGames);
        }
      }
    }
    document.addEventListener('visibilitychange', handler)
    window.addEventListener('blur', handler)
    window.addEventListener('focus', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
      window.removeEventListener('blur', handler)
      window.removeEventListener('focus', handler)
    }
  }, [])

  useEffect(() => {
    let settled = false;

    async function resolveSession(userId: string) {
      // Use maybeSingle so we get null (not a 406 error) when the profile row
      // doesn't exist yet — this happens when onAuthStateChange fires during
      // registration before RegisterForm has finished inserting the profile.
      const { data: row } = await supabase
        .from('profiles')
        .select('id, username, public_key, avatar_url, status, encrypted_private_key, card_gradient, card_image_url, card_image_params, is_premium')
        .eq('id', userId)
        .maybeSingle();

      if (!row) {
        // Profile not created yet (mid-registration). Leave settled = false so
        // the next auth event (SIGNED_IN after login) will try again.
        setUser(null);
        return;
      }

      const pendingPw = consumePendingPassword();

      if (!loadPrivateKey(userId)) {
        // No local key — try to restore from the encrypted backup in Supabase.
        let restored = false;
        if (row.encrypted_private_key && pendingPw) {
          const privateKey = await decryptPrivateKey(row.encrypted_private_key, pendingPw);
          if (privateKey) {
            savePrivateKey(privateKey, userId);
            restored = true;
          }
        }

        if (!restored) {
          // No backup or decryption failed — generate a fresh keypair.
          // This happens for brand-new accounts (backup was just created by
          // RegisterForm) or for very old accounts that predate this feature.
          const kp = generateKeyPair();
          savePrivateKey(kp.privateKey, userId);
          await supabase.from('profiles').update({ public_key: kp.publicKey }).eq('id', userId);
          row.public_key = kp.publicKey;
          // Old messages can no longer be decrypted — clear the cache.
          clearAllChatCaches();

          // Save an encrypted backup so future new-device logins can restore.
          if (pendingPw) {
            const blob = await encryptPrivateKey(kp.privateKey, pendingPw);
            await supabase.from('profiles').update({ encrypted_private_key: blob }).eq('id', userId);
          }
        }
      } else if (!row.encrypted_private_key && pendingPw) {
        // Key is already in localStorage but no backup exists yet (existing user
        // who registered before this feature). Backfill the encrypted blob now.
        const blob = await encryptPrivateKey(loadPrivateKey(userId)!, pendingPw);
        await supabase.from('profiles').update({ encrypted_private_key: blob }).eq('id', userId);
      }

      // Strip the encrypted blob before storing in app state — it's not needed
      // anywhere in the UI and we don't want it floating around in memory.
      const { encrypted_private_key: _epk, ...profile } = row;
      setUser(profile);
      pruneUnscopedCaches();   // ← sweep legacy unscoped keys on every login
      settled = true;
      // Push locally-stored status to Supabase so other users see it immediately
      useStatusStore.getState().syncToSupabase(profile.id);
      // Request desktop notification permission once
      requestNotificationPermission();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        // Hang up any active call before signing out
        const { status } = useCallStore.getState();
        if (status !== 'idle') {
          useCallStore.getState().hangUp();
        }
        setUser(null);
        settled = false;
        return;
      }
      if (settled) return;
      resolveSession(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load friends and subscribe to requests on login
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToRequests(user.id);
    loadFriends(user.id);
    useXpStore.getState().loadXp(user.id);
    return unsub;
  }, [user?.id]);

  // Load user's servers + seed persistent unreads + subscribe to realtime
  useEffect(() => {
    if (!user) return;
    loadServers().then(() => {
      loadAllServerMembers();
      seedBubbleUnreads(user.id);
    });
    const unsub = subscribeBubbleUnreads(user.id, user.username);
    return unsub;
  }, [user?.id]);

  // Seed unread counts from DB on login (covers messages received while offline)
  useEffect(() => {
    if (!user) return;
    supabase
      .from('messages')
      .select('sender_id')
      .eq('recipient_id', user.id)
      .is('read_at', null)
      .then(({ data }) => {
        if (!data) return;
        const counts: Record<string, number> = {};
        for (const { sender_id } of data) {
          counts[sender_id] = (counts[sender_id] ?? 0) + 1;
        }
        seed(counts);
      });
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
        const inGame   = useCornerStore.getState().gameViewActive;
        const appIdle  = document.hidden || !document.hasFocus();
        // Treat as unread if: sender isn't the open chat, OR user is in game view,
        // OR the app is idle (second monitor / other window) — user isn't watching.
        if (msg.sender_id !== activeId || inGame || appIdle) {
          increment(msg.sender_id);
          // Desktop notification
          const sender = useFriendStore.getState().friends.find(f => f.id === msg.sender_id);
          if (sender) showMessageNotification(sender.username, '🔒 Encrypted message');
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // OS notification for incoming calls — fires once on transition to ringing
  useEffect(() => {
    let prevStatus = useCallStore.getState().status;
    return useCallStore.subscribe(state => {
      if (state.status === 'ringing' && prevStatus !== 'ringing' && state.contact) {
        showCallNotification(state.contact.username, state.callType ?? 'audio');
      }
      prevStatus = state.status;
    });
  }, []);

  // Global presence channel — detects who is actually connected + game activity
  useEffect(() => {
    if (!user) return;
    const { setOnlineIds, setPresenceReady, setPlayingGames } = usePresenceStore.getState();

    function syncPresenceState(state: ReturnType<typeof channel.presenceState>) {
      const newIds = new Set(Object.keys(state));
      const prev = usePresenceStore.getState().onlineIds;
      const changed = newIds.size !== prev.size || [...newIds].some(id => !prev.has(id));
      if (changed) setOnlineIds(newIds);
      setPresenceReady(true);
      const newGames = new Map<string, string>();
      for (const [userId, presences] of Object.entries(state)) {
        const p = (presences as any[])[0];
        if (p?.playingGame) newGames.set(userId, p.playingGame);
      }
      const prevGames = usePresenceStore.getState().playingGames;
      const gamesChanged = newGames.size !== prevGames.size ||
        [...newGames.entries()].some(([k, v]) => prevGames.get(k) !== v);
      if (gamesChanged) setPlayingGames(newGames);
    }

    const channel = supabase
      .channel('global:online', { config: { presence: { key: user.id } } })
      .on('presence', { event: 'sync' }, () => {
        // Only defer when the tab is completely hidden (not visible at all).
        // When visible-but-not-focused (second monitor), presence updates are cheap
        // and the user needs to see online/offline changes in real time.
        if (document.hidden) {
          pendingPresenceSync.current = true;
          return;
        }
        syncPresenceState(channel.presenceState());
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { showGameActivity: sga } = useStatusStore.getState();
          const { selectedGame: sg }      = useCornerStore.getState();
          await channel.track({ connected: true, playingGame: sga ? sg : null });
        }
      });
    presenceChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Re-broadcast game activity when selectedGame or showGameActivity changes
  useEffect(() => {
    if (!user?.id) return;
    presenceChannelRef.current?.track({
      connected: true,
      playingGame: showGameActivity ? selectedGame : null,
    });
  }, [selectedGame, showGameActivity, user?.id]);

  // ── Incoming call ring subscription ────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`call:ring:${user.id}`)
      .on('broadcast', { event: 'call:offer' }, ({ payload }) => {
        const { sdp, callId, callType, callerId } = payload;
        if (!sdp || !callId || !callerId) return;

        // Look up caller's profile from friends list
        const caller = useFriendStore.getState().friends.find(f => f.id === callerId);
        if (!caller) return; // Only accept calls from confirmed friends

        useCallStore.getState().handleIncomingOffer(sdp, callId, caller, callType ?? 'audio', user.id);
      })
      .on('broadcast', { event: 'call:group-invite' }, ({ payload }) => {
        const { callId, inviter, participants } = payload;
        if (!callId || !inviter) return;

        // Only accept from friends
        const friend = useFriendStore.getState().friends.find(f => f.id === inviter.userId);
        if (!friend) return;

        // Check not already in a call
        const groupStatus = useGroupCallStore.getState().status;
        const callStatus = useCallStore.getState().status;
        if (groupStatus !== 'idle' || callStatus !== 'idle') return;

        useGroupCallStore.getState().handleIncomingGroupInvite(
          callId,
          participants ?? [],
          { ...friend },
        );
      })
      .on('broadcast', { event: 'call:group-escalate' }, async ({ payload }) => {
        const { callId, inviter, participants } = payload;
        if (!callId || !inviter) return;

        // Only accept from friends
        const friend = useFriendStore.getState().friends.find(f => f.id === inviter.userId);
        if (!friend) return;

        // This is for users already in a 1:1 call — auto-join the group
        const callStatus = useCallStore.getState().status;
        if (callStatus !== 'connected') return;

        const groupStore = useGroupCallStore.getState();
        if (groupStore.status !== 'idle') return;

        // End the 1:1 call silently (the other side already escalated)
        useCallStore.getState().hangUp();

        try {
          await groupStore.joinGroupCall(callId, inviter.userId, participants ?? []);
        } catch (err) {
          console.error('[group-call] Auto-escalation failed', err);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-aero-cyan" />
      </div>
    );
  }

  return (
    <>
      {user ? <ChatLayout /> : <AuthPage />}
      {user && <GameNotification />}
      {user && <MentionNotification />}
      {user && !splashDone && (
        <SplashScreen ready={splashReady} onRevealed={handleSplashRevealed} />
      )}
    </>
  );
}
