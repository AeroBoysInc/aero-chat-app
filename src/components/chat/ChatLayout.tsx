import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { ChatWindow } from './ChatWindow';
import type { Profile } from '../../store/authStore';

export function ChatLayout() {
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  return (
    <div className="flex h-screen overflow-hidden rounded-none">
      <Sidebar selectedUser={selectedUser} onSelectUser={setSelectedUser} />
      <main className="flex flex-1 flex-col">
        {selectedUser ? (
          <ChatWindow contact={selectedUser} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <MessageCircle className="mx-auto mb-4 h-16 w-16 text-white/15" />
              <p className="text-lg font-semibold text-white/40">Select a conversation</p>
              <p className="text-sm text-white/25">Search for a user in the sidebar to start chatting</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
