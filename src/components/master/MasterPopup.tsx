import { memo, useEffect, useCallback, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useIsMobile } from '../../lib/useIsMobile';

interface MasterPopupProps {
  title: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

export const MasterPopup = memo(function MasterPopup({ title, icon, onClose, children }: MasterPopupProps) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);
  const isMobile = useIsMobile();

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isMobile ? '#050505' : 'rgba(0,0,0,0.60)',
        backdropFilter: isMobile ? 'none' : 'blur(6px)',
      }}
      onClick={(e) => { if (!isMobile && e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="animate-fade-in"
        style={{
          ...(isMobile
            ? { width: '100%', height: '100%', borderRadius: 0, border: 'none', boxShadow: 'none' }
            : { width: '92%', maxWidth: 960, height: '85%', maxHeight: 680, borderRadius: 22, border: '1px solid rgba(0,230,118,0.18)', boxShadow: '0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(0,230,118,0.08)' }
          ),
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(145deg, rgba(0,230,118,0.06), rgba(0,20,12,0.95))',
          backdropFilter: isMobile ? 'none' : 'blur(20px)',
          position: 'relative',
        }}
      >
        {/* Gloss highlight */}
        {!isMobile && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '30%',
            background: 'linear-gradient(180deg, rgba(0,230,118,0.05) 0%, transparent 100%)',
            borderRadius: '22px 22px 0 0',
            pointerEvents: 'none', zIndex: 1,
          }} />
        )}

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: isMobile ? '12px 14px' : '14px 18px',
          borderBottom: '1px solid rgba(0,230,118,0.10)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 2,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 10,
            background: 'rgba(0,230,118,0.10)',
            border: '1px solid rgba(0,230,118,0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </div>
          <span style={{
            fontSize: 13, fontWeight: 700, color: '#00e676',
            flex: 1,
          }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              width: isMobile ? 36 : 28, height: isMobile ? 36 : 28, borderRadius: 8,
              background: 'rgba(0,230,118,0.06)',
              border: '1px solid rgba(0,230,118,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(0,230,118,0.40)',
              outline: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.06)')}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1, minHeight: 0, overflow: 'hidden',
          position: 'relative', zIndex: 2,
        }}>
          {children}
        </div>
      </div>
    </div>
  );
});
