import { X, Shield, Clock } from 'lucide-react';
import { useSecurityStore, EXPIRY_OPTIONS } from '../../store/securityStore';

interface Props { onClose: () => void; }

export function SecurityPanel({ onClose }: Props) {
  const { expiryEnabled, expiryMinutes, setExpiryEnabled, setExpiryMinutes } = useSecurityStore();

  return (
    <div className="absolute bottom-16 left-2 z-50 w-64 rounded-aero-lg border border-white/20 bg-aero-deep/90 p-4 shadow-xl backdrop-blur-xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" style={{ color: '#00d4ff' }} />
          <span className="text-sm font-semibold text-white">Security</span>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Message Expiry */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-white/60" />
            <div>
              <p className="text-sm text-white">Message expiry</p>
              <p className="text-[11px] text-white/40">Auto-delete sent messages</p>
            </div>
          </div>
          {/* Toggle */}
          <button
            onClick={() => setExpiryEnabled(!expiryEnabled)}
            className="relative flex-shrink-0 h-5 w-9 rounded-full transition-colors duration-200"
            style={{ background: expiryEnabled ? '#00d4ff' : 'rgba(255,255,255,0.15)' }}
          >
            <span
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200"
              style={{ left: expiryEnabled ? '18px' : '2px' }}
            />
          </button>
        </div>

        {/* Duration picker — visible only when expiry is on */}
        {expiryEnabled && (
          <div className="mt-3 animate-fade-in">
            <p className="text-[11px] text-white/40 mb-2">Messages expire after</p>
            <div className="flex flex-col gap-1">
              {EXPIRY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setExpiryMinutes(opt.value)}
                  className="flex items-center justify-between rounded-aero px-3 py-1.5 text-sm transition-all"
                  style={{
                    background: expiryMinutes === opt.value ? 'rgba(0,212,255,0.18)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${expiryMinutes === opt.value ? 'rgba(0,212,255,0.50)' : 'transparent'}`,
                    color: expiryMinutes === opt.value ? '#00d4ff' : 'rgba(255,255,255,0.65)',
                  }}
                >
                  {opt.label}
                  {expiryMinutes === opt.value && <span style={{ fontSize: 11, color: '#00d4ff' }}>✓</span>}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[10px] text-white/30 leading-relaxed">
              Applies to messages you send. Both parties lose access after expiry.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
