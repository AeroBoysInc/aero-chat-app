import { X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { AvatarUpload } from './AvatarUpload';

interface Props { onClose: () => void; }

const panelStyle: React.CSSProperties = {
  zIndex: 50,
  width: '15rem',
  borderRadius: 20,
  border: '1px solid var(--popup-border)',
  background: 'var(--popup-bg)',
  boxShadow: 'var(--popup-shadow)',
  backdropFilter: 'blur(28px)',
  padding: '1rem',
};

export function SettingsPanel({ onClose }: Props) {
  const { user } = useAuthStore();

  return (
    <div style={panelStyle}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: 'var(--popup-text)' }}>Profile Settings</span>
        <button
          onClick={onClose}
          className="rounded-lg p-1 transition-colors"
          style={{ color: 'var(--popup-text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--popup-text)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--popup-text-muted)'; }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <AvatarUpload />

      <div className="mt-4 pt-3 text-center" style={{ borderTop: '1px solid var(--popup-divider)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--popup-text)' }}>{user?.username}</p>
        <p className="text-xs" style={{ color: '#4fc97a' }}>● Encrypted</p>
      </div>
    </div>
  );
}
