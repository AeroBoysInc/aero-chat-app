import { useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';

interface Props {
  url: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function ExternalLinkModal({ url, onConfirm, onCancel }: Props) {
  const domain = getDomain(url);
  const displayUrl = url.length > 60 ? url.slice(0, 60) + '…' : url;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter')  onConfirm();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative w-full max-w-sm p-5 shadow-2xl animate-fade-in"
        style={{
          borderRadius: 20,
          border: '1px solid var(--popup-border)',
          background: 'var(--popup-bg)',
          boxShadow: 'var(--popup-shadow)',
          backdropFilter: 'blur(28px)',
        }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.30)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ExternalLink style={{ width: 14, height: 14, color: '#f59e0b' }} />
            </div>
            <span className="text-sm font-bold" style={{ color: 'var(--popup-text)' }}>
              Leaving AeroChat
            </span>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1 transition-colors"
            style={{ color: 'var(--popup-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--popup-text)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '';                   (e.currentTarget as HTMLElement).style.color = 'var(--popup-text-muted)'; }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <p className="text-sm mb-2" style={{ color: 'var(--popup-text-secondary)' }}>
          You're about to open an external link to{' '}
          <span style={{ color: 'var(--popup-text)', fontWeight: 600 }}>{domain}</span>.
          This will take you outside of AeroChat.
        </p>
        <div
          className="mb-4 rounded-xl px-3 py-2 text-xs break-all"
          style={{
            background: 'var(--popup-item-bg)',
            border: '1px solid var(--popup-divider)',
            color: 'var(--popup-text-muted)',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {displayUrl}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm font-semibold transition-all"
            style={{ background: 'var(--btn-ghost-bg)', border: '1px solid var(--btn-ghost-border)', color: 'var(--popup-text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--btn-ghost-bg)'}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl px-4 py-2 text-sm font-semibold transition-all"
            style={{ background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.35)', color: '#f59e0b' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.24)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.14)'}
          >
            Open Link
          </button>
        </div>
      </div>
    </div>
  );
}
