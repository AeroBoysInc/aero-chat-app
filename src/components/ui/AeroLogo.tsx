interface Props {
  size?: number;
  className?: string;
}

/** AeroChat logo — glossy winged chat bubble placeholder SVG */
export function AeroLogo({ size = 40, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left wing */}
      <path
        d="M12 52 C4 42, 6 28, 18 24 C24 22, 30 26, 34 32 C28 36, 22 44, 20 52 Z"
        fill="url(#wingGrad)"
        opacity={0.85}
      />
      {/* Right wing */}
      <path
        d="M88 52 C96 42, 94 28, 82 24 C76 22, 70 26, 66 32 C72 36, 78 44, 80 52 Z"
        fill="url(#wingGrad)"
        opacity={0.85}
      />
      {/* Chat bubble body */}
      <ellipse cx={50} cy={50} rx={26} ry={22} fill="url(#bubbleGrad)" />
      {/* Bubble tail */}
      <path d="M38 66 L44 76 L50 66" fill="url(#bubbleGrad)" />
      {/* Gloss highlight */}
      <ellipse cx={50} cy={42} rx={18} ry={10} fill="rgba(255,255,255,0.35)" />
      {/* Chat dots */}
      <circle cx={40} cy={52} r={3} fill="rgba(255,255,255,0.9)" />
      <circle cx={50} cy={52} r={3} fill="rgba(255,255,255,0.9)" />
      <circle cx={60} cy={52} r={3} fill="rgba(255,255,255,0.9)" />
      {/* Gradients */}
      <defs>
        <linearGradient id="bubbleGrad" x1="50" y1="28" x2="50" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5BC8F5" />
          <stop offset="100%" stopColor="#0A8DD6" />
        </linearGradient>
        <linearGradient id="wingGrad" x1="50" y1="20" x2="50" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8AE0FF" />
          <stop offset="100%" stopColor="#3DBCE8" />
        </linearGradient>
      </defs>
    </svg>
  );
}
