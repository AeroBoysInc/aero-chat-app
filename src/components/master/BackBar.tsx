import { memo, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useIsMobile } from '../../lib/useIsMobile';

interface BackBarProps {
  title: string;
  onBack: () => void;
}

export const BackBar = memo(function BackBar({ title, onBack }: BackBarProps) {
  const isMobile = useIsMobile();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onBack]);

  return (
    <div
      style={{
        height: isMobile ? 44 : 36,
        display: 'flex',
        alignItems: 'center',
        padding: isMobile ? '0 10px' : '0 14px',
        gap: 10,
        borderBottom: '1px solid rgba(0,230,118,0.08)',
        background: 'rgba(0,230,118,0.03)',
        flexShrink: 0,
      }}
    >
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: isMobile ? '8px 14px' : '4px 10px',
          borderRadius: 8,
          background: 'rgba(0,230,118,0.06)',
          border: '1px solid rgba(0,230,118,0.12)',
          color: 'rgba(0,230,118,0.55)',
          fontSize: isMobile ? 12 : 10,
          fontWeight: 700,
          cursor: 'pointer',
          outline: 'none',
          transition: 'background 0.15s',
          minHeight: isMobile ? 36 : undefined,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.12)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,230,118,0.06)')}
      >
        <ArrowLeft style={{ width: isMobile ? 14 : 12, height: isMobile ? 14 : 12 }} />
        Dashboard
      </button>
      <span style={{ fontSize: isMobile ? 14 : 12, fontWeight: 700, color: 'rgba(0,230,118,0.60)' }}>
        {title}
      </span>
    </div>
  );
});
