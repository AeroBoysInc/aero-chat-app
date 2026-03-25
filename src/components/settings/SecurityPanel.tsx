import { X, Shield, Clock } from 'lucide-react';
import { useSecurityStore, EXPIRY_OPTIONS } from '../../store/securityStore';

interface Props { onClose: () => void; }

const panelStyle: React.CSSProperties = {
  zIndex: 50,
  width: '16rem',
  borderRadius: 20,
  border: '1px solid var(--popup-border)',
  background: 'var(--popup-bg)',
  boxShadow: 'var(--popup-shadow)',
  backdropFilter: 'blur(28px)',
  padding: '1rem',
};

export function SecurityPanel({ onClose }: Props) {
  const { expiryEnabled, expiryMinutes, setExpiryEnabled, setExpiryMinutes } = useSecurityStore();

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" style={{ color: 'var(--popup-icon)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--popup-text)' }}>Security</span>
        </div>
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

      {/* Message Expiry */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" style={{ color: 'var(--popup-text-muted)' }} />
            <div>
              <p className="text-sm" style={{ color: 'var(--popup-text)' }}>Message expiry</p>
              <p className="text-[11px]" style={{ color: 'var(--popup-text-muted)' }}>Auto-delete sent messages</p>
            </div>
          </div>
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

        {/* Duration picker */}
        {expiryEnabled && (
          <div className="mt-3 animate-fade-in">
            <p className="text-[11px] mb-2" style={{ color: 'var(--popup-text-muted)' }}>Messages expire after</p>
            <div className="flex flex-col gap-1">
              {EXPIRY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setExpiryMinutes(opt.value)}
                  className="flex items-center justify-between rounded-aero px-3 py-1.5 text-sm transition-all"
                  style={{
                    background: expiryMinutes === opt.value ? 'rgba(0,212,255,0.15)' : 'var(--popup-item-bg)',
                    border: `1px solid ${expiryMinutes === opt.value ? 'rgba(0,212,255,0.45)' : 'transparent'}`,
                    color: expiryMinutes === opt.value ? '#00b4d8' : 'var(--popup-text-secondary)',
                  }}
                  onMouseEnter={e => { if (expiryMinutes !== opt.value) (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'; }}
                  onMouseLeave={e => { if (expiryMinutes !== opt.value) (e.currentTarget as HTMLElement).style.background = 'var(--popup-item-bg)'; }}
                >
                  {opt.label}
                  {expiryMinutes === opt.value && <span style={{ fontSize: 11, color: '#00b4d8' }}>✓</span>}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[10px] leading-relaxed" style={{ color: 'var(--popup-text-muted)' }}>
              Applies to messages you send. Both parties lose access after expiry.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
