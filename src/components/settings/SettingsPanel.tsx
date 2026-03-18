import { X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { AvatarUpload } from './AvatarUpload';

interface Props { onClose: () => void; }

export function SettingsPanel({ onClose }: Props) {
  const { user } = useAuthStore();

  return (
    <div className="absolute bottom-16 left-2 z-50 w-60 rounded-aero-lg border border-white/20 bg-aero-deep/90 p-4 shadow-xl backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Profile Settings</span>
        <button onClick={onClose} className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <AvatarUpload />

      <div className="mt-4 border-t border-white/10 pt-3 text-center">
        <p className="text-sm font-semibold text-white">{user?.username}</p>
        <p className="text-xs text-aero-green">● Encrypted</p>
      </div>
    </div>
  );
}
