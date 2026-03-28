import { X, BookOpen, PenTool, Search } from 'lucide-react';
import { hexToRgb } from '../../../lib/writerUtils';

const ACCENT = '#a855f7';

interface Props {
  onClose: () => void;
}

export function WriterOnboarding({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl p-6"
        style={{
          background: 'var(--sidebar-bg)',
          border: `1px solid rgba(${hexToRgb(ACCENT)}, 0.30)`,
          boxShadow: `0 8px 40px rgba(${hexToRgb(ACCENT)}, 0.20), inset 0 1px 0 rgba(255,255,255,0.10)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 transition-all"
          style={{ color: 'var(--text-muted)' }}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-center mb-6">
          <div
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-3"
            style={{
              background: `rgba(${hexToRgb(ACCENT)}, 0.15)`,
              border: `1px solid rgba(${hexToRgb(ACCENT)}, 0.30)`,
            }}
          >
            <PenTool className="h-7 w-7" style={{ color: ACCENT }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Welcome to Writers Corner
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            A place to read and share short stories with the AeroChat community
          </p>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <OnboardingStep
            icon={Search}
            title="Browse Stories"
            desc="Discover stories by category — fantasy, horror, sci-fi, and more. Filter by what you love."
          />
          <OnboardingStep
            icon={BookOpen}
            title="Start Reading"
            desc="Tap any story card to dive in. Like stories to help them trend."
          />
          <OnboardingStep
            icon={PenTool}
            title="Want to Write?"
            desc="Apply for a Writer role to publish your own stories. Pick a category, add a cover, and share with the world."
          />
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl py-3 text-sm font-bold transition-all"
          style={{
            background: `linear-gradient(135deg, ${ACCENT}, #7c3aed)`,
            color: '#fff',
            border: 'none',
            boxShadow: `0 4px 16px rgba(${hexToRgb(ACCENT)}, 0.35)`,
          }}
        >
          Got it, let's go!
        </button>
      </div>
    </div>
  );
}

function OnboardingStep({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-3 items-start">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
        style={{
          background: `rgba(${hexToRgb(ACCENT)}, 0.10)`,
          border: `1px solid rgba(${hexToRgb(ACCENT)}, 0.20)`,
        }}
      >
        <Icon className="h-4 w-4" style={{ color: ACCENT }} />
      </div>
      <div>
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
      </div>
    </div>
  );
}
