interface Props {
  size?: number;
  className?: string;
}

/** Custom AeroChat logo — Frutiger Aero-style glossy chat bubble */
export function AeroLogo({ size = 40, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="ac-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00d4ff" />
          <stop offset="100%" stopColor="#1248b8" />
        </linearGradient>
        <linearGradient id="ac-gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <linearGradient id="ac-dot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,1)" />
          <stop offset="100%" stopColor="rgba(200,240,255,0.85)" />
        </linearGradient>
        <filter id="ac-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Drop shadow layer */}
      <path
        d="M7 5 H30 Q35 5 35 10 V22 Q35 27 30 27 H21 L14 35 V27 H10 Q5 27 5 22 V10 Q5 5 7 5 Z"
        fill="rgba(0,50,150,0.3)"
        transform="translate(1,1.5)"
      />

      {/* Main bubble body */}
      <path
        d="M7 5 H30 Q35 5 35 10 V22 Q35 27 30 27 H21 L14 35 V27 H10 Q5 27 5 22 V10 Q5 5 7 5 Z"
        fill="url(#ac-fill)"
      />

      {/* Top gloss sheen */}
      <path
        d="M7 5 H30 Q35 5 35 10 V16 Q28 9 20 8 Q12 7 5 12 V10 Q5 5 7 5 Z"
        fill="url(#ac-gloss)"
        opacity="0.55"
      />

      {/* 3 chat dots */}
      <circle cx="13" cy="16" r="2.4" fill="url(#ac-dot)" filter="url(#ac-glow)" />
      <circle cx="20" cy="16" r="2.4" fill="url(#ac-dot)" filter="url(#ac-glow)" />
      <circle cx="27" cy="16" r="2.4" fill="url(#ac-dot)" filter="url(#ac-glow)" />

      {/* Rim highlight (left+top edge) */}
      <path
        d="M7 5 H30 Q35 5 35 10 V22 Q35 27 30 27 H21 L14 35 V27 H10 Q5 27 5 22 V10 Q5 5 7 5 Z"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.8"
      />
    </svg>
  );
}
