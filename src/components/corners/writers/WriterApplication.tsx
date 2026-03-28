import { useState } from 'react';
import { ArrowLeft, PenTool, Send } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useWriterStore } from '../../../store/writerStore';
import { hexToRgb } from '../../../lib/writerUtils';

const ACCENT = '#a855f7';

export function WriterApplication() {
  const user = useAuthStore(s => s.user);
  const { applicationPending, setView, applyForWriter } = useWriterStore();
  const [submitted, setSubmitted] = useState(false);

  async function handleApply() {
    if (!user) return;
    await applyForWriter(user.id);
    setSubmitted(true);
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <button
          onClick={() => setView('hub')}
          className="flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Apply to Write</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div
            className="inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
            style={{
              background: `rgba(${hexToRgb(ACCENT)}, 0.15)`,
              border: `1px solid rgba(${hexToRgb(ACCENT)}, 0.30)`,
            }}
          >
            <PenTool className="h-8 w-8" style={{ color: ACCENT }} />
          </div>

          {applicationPending || submitted ? (
            <>
              <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Application Submitted!
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Your application is being reviewed. You'll be able to write stories once approved by an admin.
              </p>
              <button
                onClick={() => setView('hub')}
                className="rounded-xl px-6 py-2.5 text-sm font-bold transition-all"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--text-secondary)',
                }}
              >
                Back to Hub
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Become a Writer
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Writers can publish stories for the AeroChat community to read.
                Your application will be reviewed by an admin. Once approved, you'll
                see a "New Story" button in the hub.
              </p>
              <button
                onClick={handleApply}
                className="flex items-center gap-2 mx-auto rounded-xl px-6 py-3 text-sm font-bold transition-all"
                style={{
                  background: `linear-gradient(135deg, ${ACCENT}, #7c3aed)`,
                  color: '#fff',
                  boxShadow: `0 4px 16px rgba(${hexToRgb(ACCENT)}, 0.35)`,
                }}
              >
                <Send className="h-4 w-4" />
                Submit Application
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
