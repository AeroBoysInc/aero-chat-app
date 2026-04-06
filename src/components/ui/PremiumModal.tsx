// src/components/ui/PremiumModal.tsx
import { memo } from 'react';
import { X, Check, Lock } from 'lucide-react';

interface PremiumModalProps {
  open: boolean;
  onClose: () => void;
}

const FREE_FEATURES = [
  'DMs, Servers, Bubbles, Calls',
  'Emoji Picker + GIF Search',
  'Games (Chess + more)',
  'Writer\'s Corner',
  'Avatar Corner (base avatar)',
  'Free cosmetics at milestones',
];

const FREE_LIMITS = [
  'Daily XP cap (100/bar/day)',
  '10 MB file upload limit',
  '3 profile card presets',
  'Day / Night themes only',
  'Default bubble style only',
  'No custom server emoji',
];

const PLUS_FEATURES = [
  'Everything in Free',
  'Unlimited daily XP',
  '100 MB file uploads',
  'Full gradient library + custom colors',
  'Animated profile card effects',
  'Custom aura ring colors',
  'Full theme library (6+ themes)',
  'Chat bubble styles + custom colors',
  'Sound packs (5+ sets)',
  'Custom server emoji uploads',
  'Premium avatar cosmetic catalog',
  'Exclusive Shop access',
];

export const PremiumModal = memo(function PremiumModal({ open, onClose }: PremiumModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[680px] mx-4 animate-fade-in"
        style={{
          background: 'var(--popup-bg)',
          border: '1px solid var(--popup-border)',
          borderRadius: 20,
          backdropFilter: 'blur(28px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1.5 transition-all hover:scale-110"
          style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)' }}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div style={{ padding: '28px 28px 0', textAlign: 'center' }}>
          <h2 style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 24, fontWeight: 800,
            background: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Upgrade to Aero Chat+
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
            Unlock your full visual identity and unlimited progression
          </p>
        </div>

        {/* Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '24px 28px' }}>
          {/* Free column */}
          <div style={{
            borderRadius: 14, padding: '18px 16px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(80,145,255,0.08)',
          }}>
            <div style={{
              display: 'inline-block', padding: '4px 12px', borderRadius: 20,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
              background: 'rgba(80,200,120,0.12)', color: '#50c878',
              border: '1px solid rgba(80,200,120,0.25)', marginBottom: 14,
            }}>
              FREE
            </div>

            {FREE_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                <Check className="h-3 w-3 flex-shrink-0" style={{ color: '#50c878' }} />
                {f}
              </div>
            ))}

            <div style={{ height: 1, background: 'rgba(80,145,255,0.06)', margin: '10px 0' }} />

            {FREE_LIMITS.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12, color: 'var(--text-muted)', opacity: 0.5 }}>
                <Lock className="h-3 w-3 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>

          {/* Plus column */}
          <div style={{
            borderRadius: 14, padding: '18px 16px',
            background: 'linear-gradient(160deg, rgba(255,215,0,0.06), rgba(255,165,0,0.03))',
            border: '1px solid rgba(255,215,0,0.18)',
            boxShadow: '0 0 30px rgba(255,215,0,0.04)',
          }}>
            <div style={{
              display: 'inline-block', padding: '4px 12px', borderRadius: 20,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
              background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,165,0,0.12))',
              color: '#FFD700',
              border: '1px solid rgba(255,215,0,0.3)', marginBottom: 14,
            }}>
              AERO CHAT+
            </div>

            {PLUS_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12, color: 'var(--text-primary)' }}>
                <Check className="h-3 w-3 flex-shrink-0" style={{ color: '#FFD700' }} />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Subscribe button */}
        <div style={{ padding: '0 28px 28px', textAlign: 'center' }}>
          <button
            className="transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              padding: '12px 40px',
              borderRadius: 14,
              border: '1px solid rgba(255,215,0,0.35)',
              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
              color: '#1a0e00',
              fontSize: 15,
              fontWeight: 800,
              fontFamily: 'Inter, system-ui, sans-serif',
              letterSpacing: '-0.2px',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(255,165,0,0.25), inset 0 1px 0 rgba(255,255,255,0.30)',
            }}
          >
            Subscribe Now
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, opacity: 0.5 }}>
            Pricing coming soon
          </p>
        </div>
      </div>
    </div>
  );
});
