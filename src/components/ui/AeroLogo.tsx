interface Props {
  size?: number;
  className?: string;
}

/** AeroChat logo — glossy winged chat bubble */
export function AeroLogo({ size = 40, className = '' }: Props) {
  return (
    <img
      src="/logo.png"
      alt="AeroChat"
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
      draggable={false}
    />
  );
}
