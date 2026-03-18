import { Lock } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { ChatWindow } from './ChatWindow';
import { AeroLogo } from '../ui/AeroLogo';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { useChatStore } from '../../store/chatStore';

export function ChatLayout() {
  const { selectedContact, setSelectedContact } = useChatStore();

  return (
    <div className="relative flex h-screen overflow-hidden p-3 gap-3">

      {/* Theme switcher — fixed top-right, always visible */}
      <div className="fixed top-4 right-5 z-50 drag-region">
        <ThemeSwitcher />
      </div>

      {/* Left panel — sidebar */}
      <Sidebar selectedUser={selectedContact} onSelectUser={setSelectedContact} />

      {/* Right panel — chat area */}
      <main className="glass-chat flex flex-1 flex-col overflow-hidden">
        {selectedContact ? (
          <ChatWindow contact={selectedContact} />
        ) : (
          <div className="relative flex h-full items-center justify-center overflow-hidden">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="orb h-60 w-60 animate-pulse-glow"
                style={{ background: 'rgba(0,190,255,0.14)', left: '18%', top: '8%' }} />
              <div className="orb h-48 w-48 animate-pulse-glow"
                style={{ background: 'rgba(255,160,0,0.12)', right: '12%', bottom: '18%', animationDelay: '1.5s' }} />
            </div>

            <div className="relative text-center animate-fade-in">
              <div className="mx-auto mb-5 animate-float">
                <AeroLogo size={72} className="opacity-40" />
              </div>
              <p className="text-base font-bold" style={{ color: 'var(--text-secondary)' }}>
                Select a conversation
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                Choose a friend from the sidebar to start chatting
              </p>
              <div className="mt-5 flex items-center justify-center gap-1.5 text-xs"
                style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                <Lock className="h-3 w-3" />
                <span>All messages are end-to-end encrypted</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
