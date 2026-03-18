interface Props {
  username: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClass = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export function AvatarImage({ username, avatarUrl, size = 'md' }: Props) {
  const cls = `shrink-0 rounded-full object-cover ${sizeClass[size]}`;

  if (avatarUrl) {
    return <img src={avatarUrl} alt={username} className={cls} />;
  }

  return (
    <div className={`${cls} flex items-center justify-center bg-gradient-to-br from-aero-cyan/60 to-aero-blue font-bold text-white`}>
      {username[0].toUpperCase()}
    </div>
  );
}
