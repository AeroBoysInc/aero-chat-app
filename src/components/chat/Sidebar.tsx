import { useState, useEffect } from 'react';
import { Search, LogOut, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore, type Profile } from '../../store/authStore';

interface Props {
  selectedUser: Profile | null;
  onSelectUser: (user: Profile) => void;
}

export function Sidebar({ selectedUser, onSelectUser }: Props) {
  const { user, signOut } = useAuthStore();
  const [contacts,  setContacts]  = useState<Profile[]>([]);
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  // Load recent conversations (users we have messages with)
  useEffect(() => {
    if (!user) return;
    supabase
      .from('messages')
      .select('sender_id, recipient_id')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .then(async ({ data }) => {
        if (!data) return;
        const ids = [...new Set(
          data.flatMap(m => [m.sender_id, m.recipient_id]).filter(id => id !== user.id)
        )];
        if (!ids.length) return;
        const { data: profiles } = await supabase
          .from('profiles').select('id, username, public_key').in('id', ids);
        setContacts(profiles ?? []);
      });
  }, [user]);

  // Search users by username
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, username, public_key')
        .ilike('username', `%${query}%`)
        .neq('id', user?.id)
        .limit(8);
      setResults(data ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, user]);

  const displayList = query ? results : contacts;

  return (
    <aside className="flex h-full w-64 flex-col border-r border-white/15 bg-white/5">
      {/* Header */}
      <div className="drag-region flex items-center justify-between px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-2 no-drag">
          <MessageCircle className="h-5 w-5 text-aero-cyan" />
          <span className="font-bold text-white text-shadow">AeroChat</span>
        </div>
        <button onClick={signOut} className="no-drag rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors" title="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
          <input
            className="aero-input pl-8 py-2 text-sm"
            placeholder="Find user..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Section label */}
      <div className="px-4 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
          {query ? 'Search Results' : 'Direct Messages'}
        </p>
      </div>

      {/* Contact list */}
      <nav className="flex-1 overflow-y-auto scrollbar-aero px-2 pb-2">
        {searching && <p className="px-2 py-4 text-center text-xs text-white/40">Searching…</p>}
        {!searching && displayList.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-white/40">
            {query ? 'No users found' : 'No conversations yet.\nSearch for someone to start chatting.'}
          </p>
        )}
        {displayList.map(contact => (
          <button
            key={contact.id}
            onClick={() => onSelectUser(contact)}
            className={`flex w-full items-center gap-3 rounded-aero px-3 py-2.5 text-left transition-all duration-100 ${
              selectedUser?.id === contact.id
                ? 'bg-white/20 text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-aero-cyan/60 to-aero-blue text-sm font-bold text-white">
              {contact.username[0].toUpperCase()}
            </div>
            <span className="truncate text-sm font-medium">{contact.username}</span>
          </button>
        ))}
      </nav>

      {/* Current user */}
      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-aero-teal/60 to-aero-blue text-sm font-bold text-white">
            {user?.username?.[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user?.username}</p>
            <p className="text-[10px] text-aero-green">● Encrypted</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
