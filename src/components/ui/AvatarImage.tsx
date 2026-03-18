export type Status = 'online' | 'busy' | 'away' | 'offline';

interface Props {
  username: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: Status | null;
}

const sizeClass = {
  sm: 'h-6  w-6  text-[10px]',
  md: 'h-8  w-8  text-xs',
  lg: 'h-10 w-10 text-sm',
  xl: 'h-12 w-12 text-base',
};

const badgeSize = {
  sm: { dot: 7,  border: 1.5, offset: 0 },
  md: { dot: 9,  border: 1.5, offset: 0 },
  lg: { dot: 11, border: 2,   offset: 0 },
  xl: { dot: 13, border: 2,   offset: 0 },
};

const statusColor: Record<Status, string> = {
  online:  '#3dd87a',
  busy:    '#ff4f4f',
  away:    '#f5a623',
  offline: '#9bb5c8',
};

const statusLabel: Record<Status, string> = {
  online:  'online',
  busy:    'busy',
  away:    'away',
  offline: 'offline',
};

export function AvatarImage({ username, avatarUrl, size = 'md', status }: Props) {
  const cls = `shrink-0 rounded-full object-cover ${sizeClass[size]}`;
  const b   = badgeSize[size];

  const avatar = avatarUrl
    ? <img src={avatarUrl} alt={username} className={cls} />
    : (
      <div
        className={`${cls} flex items-center justify-center font-bold text-white`}
        style={{
          background: 'linear-gradient(135deg, #38ccf8 0%, #1a6fd4 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 6px rgba(0,80,160,0.25)',
        }}
      >
        {username[0].toUpperCase()}
      </div>
    );

  if (!status) return avatar;

  return (
    <div className="relative shrink-0 inline-block">
      {/* Avatar ring */}
      <div
        className="rounded-full p-px"
        style={{
          background: `linear-gradient(135deg, ${statusColor[status]}, rgba(255,255,255,0.5))`,
          boxShadow: `0 0 0 1px rgba(255,255,255,0.7)`,
        }}
      >
        {avatarUrl
          ? <img src={avatarUrl} alt={username} className={cls} style={{ display: 'block' }} />
          : (
            <div
              className={`${sizeClass[size]} flex items-center justify-center rounded-full font-bold text-white`}
              style={{
                background: 'linear-gradient(135deg, #38ccf8 0%, #1a6fd4 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
              }}
            >
              {username[0].toUpperCase()}
            </div>
          )
        }
      </div>
      {/* Status dot badge — bottom-right */}
      <span
        className="absolute rounded-full"
        style={{
          width:  b.dot,
          height: b.dot,
          bottom: -1,
          right:  -1,
          background: statusColor[status],
          border: `${b.border}px solid white`,
          boxShadow: `0 0 6px ${statusColor[status]}aa`,
        }}
      />
    </div>
  );
}

export { statusLabel, statusColor };
