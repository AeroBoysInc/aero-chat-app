import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';

interface OGData {
  title?: string;
  description?: string;
  image?: string;
}

interface Props {
  url: string;
  isMine: boolean;
  onClickLink: (url: string) => void;
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// Simple in-memory cache so repeated renders don't re-fetch
const ogCache = new Map<string, OGData | 'failed'>();

export function LinkPreview({ url, isMine, onClickLink }: Props) {
  const [data,    setData]    = useState<OGData | null>(ogCache.get(url) === 'failed' ? null : (ogCache.get(url) as OGData | null) ?? null);
  const [loading, setLoading] = useState(!ogCache.has(url));
  const [failed,  setFailed]  = useState(ogCache.get(url) === 'failed');

  const domain = getDomain(url);

  useEffect(() => {
    if (ogCache.has(url)) return;
    let cancelled = false;

    fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        if (json.status === 'success') {
          const d: OGData = {
            title:       json.data?.title       ?? undefined,
            description: json.data?.description ?? undefined,
            image:       json.data?.image?.url  ?? undefined,
          };
          ogCache.set(url, d);
          setData(d);
        } else {
          ogCache.set(url, 'failed');
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) { ogCache.set(url, 'failed'); setFailed(true); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [url]);

  // Loading skeleton
  if (loading) {
    return (
      <div
        style={{
          marginTop: 6, borderRadius: 10, padding: '10px 12px',
          border: `1px solid ${isMine ? 'rgba(255,255,255,0.18)' : 'var(--popup-border)'}`,
          background: isMine ? 'rgba(255,255,255,0.10)' : 'var(--popup-item-bg)',
          display: 'flex', flexDirection: 'column', gap: 7, maxWidth: 280,
        }}
      >
        <div style={{ height: 11, borderRadius: 4, background: isMine ? 'rgba(255,255,255,0.18)' : 'var(--btn-ghost-border)', width: '55%' }} />
        <div style={{ height: 10, borderRadius: 4, background: isMine ? 'rgba(255,255,255,0.12)' : 'var(--btn-ghost-bg)', width: '90%' }} />
        <div style={{ height: 10, borderRadius: 4, background: isMine ? 'rgba(255,255,255,0.08)' : 'var(--btn-ghost-bg)', width: '70%' }} />
      </div>
    );
  }

  // Fetch failed — no preview, but still show a styled link pill
  if (failed || !data) return null;

  const hasContent = data.title || data.description;
  if (!hasContent && !data.image) return null;

  return (
    <button
      onClick={() => onClickLink(url)}
      style={{
        display: 'block', textAlign: 'left', cursor: 'pointer',
        marginTop: 6, borderRadius: 10, overflow: 'hidden', maxWidth: 280,
        border: `1px solid ${isMine ? 'rgba(255,255,255,0.18)' : 'var(--popup-border)'}`,
        background: isMine ? 'rgba(255,255,255,0.10)' : 'var(--popup-item-bg)',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.80'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
    >
      {data.image && (
        <img
          src={data.image}
          alt=""
          style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div style={{ padding: '7px 11px 9px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{
          fontSize: 10, display: 'flex', alignItems: 'center', gap: 3,
          color: isMine ? 'rgba(255,255,255,0.55)' : 'var(--popup-text-muted)',
        }}>
          <ExternalLink style={{ width: 9, height: 9, flexShrink: 0 }} />
          {domain}
        </span>
        {data.title && (
          <span style={{
            fontSize: 12, fontWeight: 600, lineHeight: 1.3,
            color: isMine ? '#fff' : 'var(--popup-text)',
          }}>
            {data.title.length > 80 ? data.title.slice(0, 80) + '…' : data.title}
          </span>
        )}
        {data.description && (
          <span style={{
            fontSize: 11, lineHeight: 1.4,
            color: isMine ? 'rgba(255,255,255,0.68)' : 'var(--popup-text-secondary)',
          }}>
            {data.description.length > 100 ? data.description.slice(0, 100) + '…' : data.description}
          </span>
        )}
      </div>
    </button>
  );
}
