import { create } from 'zustand';

const STORAGE_KEY = 'aero_security_settings';

export const EXPIRY_OPTIONS = [
  { label: '5 minutes',  value: 5     },
  { label: '1 hour',     value: 60    },
  { label: '8 hours',    value: 480   },
  { label: '24 hours',   value: 1440  },
  { label: '7 days',     value: 10080 },
] as const;

interface SecuritySettings {
  expiryEnabled: boolean;
  expiryMinutes: number;
}

interface SecurityStore extends SecuritySettings {
  setExpiryEnabled: (v: boolean) => void;
  setExpiryMinutes: (v: number) => void;
}

function load(): SecuritySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { expiryEnabled: false, expiryMinutes: 1440 };
  } catch { return { expiryEnabled: false, expiryMinutes: 1440 }; }
}

function save(s: SecuritySettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

export const useSecurityStore = create<SecurityStore>()((set) => ({
  ...load(),
  setExpiryEnabled: (expiryEnabled) =>
    set(s => { const next = { ...s, expiryEnabled }; save(next); return next; }),
  setExpiryMinutes: (expiryMinutes) =>
    set(s => { const next = { ...s, expiryMinutes }; save(next); return next; }),
}));

export function getExpiresAt(): string | null {
  const { expiryEnabled, expiryMinutes } = useSecurityStore.getState();
  if (!expiryEnabled) return null;
  return new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
}
