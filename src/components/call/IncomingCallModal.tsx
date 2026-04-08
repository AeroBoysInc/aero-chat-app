import { useEffect } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useCallStore } from '../../store/callStore';
import { AvatarImage } from '../ui/AvatarImage';
import { startRingtone, stopRingtone } from '../../lib/ringtone';
import { getCallTier, getTierPalette } from '../../lib/callTierVisuals';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

export function IncomingCallModal() {
  const { contact, callType, answerCall, rejectCall } = useCallStore();
  const user = useAuthStore(s => s.user);
  const activeTheme = useThemeStore(s => s.theme);
  const myTier = getCallTier(user, activeTheme);
  const palette = getTierPalette(myTier);

  // Play ringtone while modal is shown
  useEffect(() => {
    startRingtone();
    return () => stopRingtone();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') answerCall();
      if (e.key === 'Escape') rejectCall();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answerCall, rejectCall]);

  if (!contact) return null;

  return (
    // Backdrop — blurred chat behind
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: palette.ringingBg,
      backdropFilter: 'blur(12px)',
      zIndex: 50,
    }}>
      {/* Ambient effects */}
      <div className="pointer-events-none" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {palette.orbs.map((orb, i) => (
          <div key={`orb-${i}`} style={{
            position: 'absolute',
            width: orb.width, height: orb.height,
            borderRadius: '50%',
            background: orb.background,
            filter: `blur(${orb.blur}px)`,
            top: orb.top, bottom: orb.bottom, left: orb.left, right: orb.right,
            pointerEvents: 'none',
          }} />
        ))}
        {palette.particles.map((p, i) => (
          <div key={`particle-${i}`} style={{
            position: 'absolute',
            width: p.size, height: p.size,
            borderRadius: '50%',
            background: p.color,
            boxShadow: p.glow,
            top: p.top, left: p.left,
            animation: `orb-drift ${5 + (i % 3) * 1.5}s ease-in-out ${(i * 0.8) % 3}s infinite`,
            pointerEvents: 'none',
          }} />
        ))}
      </div>
      {/* Card */}
      <div style={{
        width: 280,
        background: 'rgba(4, 12, 35, 0.92)',
        border: palette.tier === 'master'
          ? '1px solid rgba(255,200,0,0.22)'
          : palette.tier === 'free'
            ? '1px solid rgba(255,255,255,0.15)'
            : '1px solid rgba(0,200,255,0.22)',
        borderRadius: 24,
        boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,200,255,0.08)',
        backdropFilter: 'blur(20px)',
        padding: '32px 24px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        textAlign: 'center',
      }}>

        {/* Pulsing avatar ring */}
        <div style={{
          position: 'relative',
          width: 80,
          height: 80,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Animated ring */}
          <div style={{
            position: 'absolute',
            inset: -8,
            borderRadius: '50%',
            border: palette.ringingRingColor,
            boxShadow: palette.ringingRingGlow,
            animation: 'pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
          }} />
          <div style={{
            position: 'absolute',
            inset: -16,
            borderRadius: '50%',
            border: palette.tier === 'master'
              ? '2px solid rgba(255,200,0,0.25)'
              : palette.tier === 'ultra' || palette.tier === 'premium'
                ? '2px solid rgba(0,200,255,0.25)'
                : '2px solid rgba(255,255,255,0.2)',
            animation: 'pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) 0.3s infinite',
          }} />
          <AvatarImage username={contact.username} avatarUrl={contact.avatar_url} size="xl" />
        </div>

        <div>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter, sans-serif' }}>
            {contact.username}
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {callType === 'video' ? <Video className="h-3 w-3" style={{ color: palette.ringingIconColor }} /> : <Phone className="h-3 w-3" style={{ color: palette.ringingIconColor }} />}
            Incoming {callType === 'video' ? 'video' : 'voice'} call
          </p>
        </div>

        {/* Accept / Reject */}
        <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
          <button
            onClick={rejectCall}
            title="Reject (Esc)"
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(220,50,50,0.85)',
              border: '1px solid rgba(220,50,50,0.9)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(220,50,50,0.4)',
              transition: 'transform 0.1s',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <PhoneOff className="h-5 w-5" />
          </button>
          <button
            onClick={answerCall}
            title="Accept (Enter)"
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(0,180,80,0.85)',
              border: '1px solid rgba(0,200,100,0.9)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,180,80,0.4)',
              transition: 'transform 0.1s',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <Phone className="h-5 w-5" />
          </button>
        </div>

        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
          Enter to accept · Esc to reject
        </p>
      </div>

      {/* Add pulse-ring keyframes to the document once */}
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 1; }
          80%  { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
