import { useEffect } from 'react';
import { ArrowLeft, Shield, Check, X } from 'lucide-react';
import { useWriterStore } from '../../../store/writerStore';
import { hexToRgb } from '../../../lib/writerUtils';

const GOLD = '#fbbf24';

export function AdminPanel() {
  const { pendingApplications, setView, fetchPendingApplications, approveWriter, rejectWriter } =
    useWriterStore();

  useEffect(() => {
    fetchPendingApplications();
  }, []);

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
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: `rgba(${hexToRgb(GOLD)}, 0.15)`, border: `1px solid rgba(${hexToRgb(GOLD)}, 0.30)` }}
        >
          <Shield className="h-5 w-5" style={{ color: GOLD }} />
        </div>
        <div>
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Admin Panel</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Manage writer applications</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-aero p-5">
        {pendingApplications.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-center">
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>No pending applications</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>All caught up!</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingApplications.map(app => (
              <div
                key={app.user_id}
                className="flex items-center gap-3 rounded-2xl p-4"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {app.username}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Applied {new Date(app.applied_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveWriter(app.user_id)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl transition-all"
                    style={{
                      background: 'rgba(34,197,94,0.15)',
                      border: '1px solid rgba(34,197,94,0.35)',
                      color: '#22c55e',
                    }}
                    title="Approve"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => rejectWriter(app.user_id)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl transition-all"
                    style={{
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.35)',
                      color: '#ef4444',
                    }}
                    title="Reject"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
