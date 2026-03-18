import { useEffect } from 'react';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';
import { useFriendStore } from './store/friendStore';
import { AuthPage } from './components/auth/AuthPage';
import { ChatLayout } from './components/chat/ChatLayout';

export default function App() {
  const { user, loading, setUser } = useAuthStore();
  const { loadFriends, subscribeToRequests } = useFriendStore();

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { setUser(null); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, public_key, avatar_url')
        .eq('id', data.session.user.id)
        .single();
      setUser(profile ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) { setUser(null); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, public_key, avatar_url')
        .eq('id', session.user.id)
        .single();
      setUser(profile ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load friends + subscribe to requests when user is set
  useEffect(() => {
    if (!user) return;
    loadFriends(user.id);
    const unsub = subscribeToRequests(user.id);
    return unsub;
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
