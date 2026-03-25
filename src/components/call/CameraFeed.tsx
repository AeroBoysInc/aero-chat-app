import { useEffect, useRef } from 'react';

interface CameraFeedProps {
  stream: MediaStream | null;
  muted?: boolean;
  /** css width / height e.g. '100%' or '80px' */
  style?: React.CSSProperties;
  className?: string;
  label?: string; // shown when stream is null
}

export function CameraFeed({ stream, muted = false, style, className, label }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [stream]);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 12,
        background: 'rgba(0, 0, 0, 0.6)',
        border: '1.5px solid rgba(91, 200, 245, 0.35)',
        boxShadow: '0 0 16px rgba(0, 180, 255, 0.15)',
        ...style,
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {!stream && label && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: 'rgba(255,255,255,0.4)',
          fontFamily: 'Inter, sans-serif',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}
