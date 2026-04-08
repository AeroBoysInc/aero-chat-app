interface Props {
  size?: number;
  className?: string;
}

/** AeroChat logo — glossy winged chat bubble (2816×1536 source, ~1.83:1) */
export function AeroLogo({ size = 40, className = '' }: Props) {
  return (
    <img
      src="/logo.png"
      alt="AeroChat"
      className={className}
      style={{ width: size, height: 'auto' }}
      draggable={false}
    />
  );
}
