import { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface ImageLightboxProps {
  image: { url: string; name: string; size: number } | null;
  onClose: () => void;
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function ImageLightbox({ image, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!image) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="glass-elevated mx-4 max-w-[90vw] p-4 animate-fade-in relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
          style={{ background: 'rgba(0,0,0,0.35)', color: '#fff' }}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image */}
        <img
          src={image.url}
          alt={image.name}
          className="rounded-aero block"
          style={{ maxWidth: '85vw', maxHeight: '75vh', objectFit: 'contain' }}
        />

        {/* Info bar + download */}
        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {image.name}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {fmtBytes(image.size)}
            </p>
          </div>
          <a
            href={image.url}
            download={image.name}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center gap-2 rounded-aero px-4 text-sm font-semibold transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(180deg, #00e0ff 0%, #00a8cc 100%)',
              color: '#fff',
              border: '1px solid rgba(0,212,255,0.50)',
              boxShadow: '0 3px 12px rgba(0,180,220,0.30)',
            }}
          >
            <Download className="h-4 w-4" />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}
