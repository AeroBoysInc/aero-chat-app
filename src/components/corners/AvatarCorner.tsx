// src/components/corners/AvatarCorner.tsx
import { useEffect } from 'react';
import { MessageCircle, Gamepad2, PenTool } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useXpStore } from '../../store/xpStore';
import { type XpBar, BAR_META, DAILY_XP_CAP, deriveLevel, getRank } from '../../lib/xpConfig';
import { AvatarImage } from '../ui/AvatarImage';

const BAR_ICONS: Record<XpBar, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  chatter: MessageCircle,
  gamer: Gamepad2,
  writer: PenTool,
};

function XpBarCard({ bar, isPremium }: { bar: XpBar; isPremium: boolean }) {
  const totalXp = useXpStore(s => s[`${bar}_xp`]);
  const dailyUsed = useXpStore(s => s[`${bar}_daily`]);
  const { level, currentXp, nextXp } = deriveLevel(totalXp);
  const rank = getRank(bar, level);
  const meta = BAR_META[bar];
  const Icon = BAR_ICONS[bar];
  const progress = level >= 100 ? 1 : nextXp > 0 ? currentXp / nextXp : 0;
  const dailyProgress = isPremium ? 0 : Math.min(dailyUsed / DAILY_XP_CAP, 1);

  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 14,
        padding: '14px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Gloss */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
        background: 'var(--card-gloss)', borderRadius: 'inherit', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative' }}>
        {/* Header row: icon + bar label + rank badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `${meta.color}18`, border: `1px solid ${meta.color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon style={{ width: 14, height: 14, color: meta.color }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              {meta.label}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: meta.color, marginTop: 1 }}>
              {rank}
            </div>
          </div>
          <div style={{
            fontSize: 20, fontWeight: 800, color: meta.color,
            lineHeight: 1,
          }}>
            {level}
          </div>
        </div>

        {/* XP progress bar */}
        <div style={{
          height: 8, borderRadius: 4, background: 'var(--slider-track)',
          overflow: 'hidden', marginBottom: 6,
        }}>
          <div
            style={{
              height: '100%', borderRadius: 4,
              background: `linear-gradient(90deg, ${meta.color}cc, ${meta.color})`,
              width: `${Math.round(progress * 100)}%`,
              transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: `0 0 8px ${meta.color}40`,
            }}
          />
        </div>

        {/* XP numbers */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
          <span>
            {level >= 100 ? 'MAX LEVEL' : `${currentXp.toLocaleString()} / ${nextXp.toLocaleString()} XP`}
          </span>
          <span>
            Total: {totalXp.toLocaleString()} XP
          </span>
        </div>

        {/* Daily cap indicator (free users only) */}
        {!isPremium && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              flex: 1, height: 3, borderRadius: 2,
              background: 'var(--slider-track)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: dailyProgress >= 1
                  ? 'rgba(255,80,50,0.6)'
                  : `${meta.color}55`,
                width: `${Math.round(dailyProgress * 100)}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {dailyUsed}/{DAILY_XP_CAP} daily
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function AvatarCorner() {
  const user = useAuthStore(s => s.user);
  const loadXp = useXpStore(s => s.loadXp);
  const loaded = useXpStore(s => s.loaded);
  const isPremium = user?.is_premium === true;

  useEffect(() => {
    if (user?.id && !loaded) {
      loadXp(user.id);
    }
  }, [user?.id, loaded, loadXp]);

  if (!user) return null;

  return (
    <div
      className="flex h-full flex-col"
      style={{
        background: 'var(--chat-bg)',
        border: '1px solid var(--chat-border)',
        borderRadius: 16,
        boxShadow: 'var(--chat-shadow)',
        overflow: 'hidden',
      }}
    >
      {/* Gloss overlay */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 80,
        background: 'var(--chat-gloss)', pointerEvents: 'none', borderRadius: 'inherit',
      }} />

      {/* Header */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid var(--panel-divider)',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AvatarImage username={user.username} avatarUrl={user.avatar_url} size="lg" />
          <div>
            <h2 style={{
              fontSize: 18, fontWeight: 800, color: 'var(--text-title)',
              fontFamily: 'Inter, system-ui, sans-serif', margin: 0,
            }}>
              Avatar Corner
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {user.username}
              {isPremium && (
                <span style={{
                  marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px',
                  borderRadius: 4,
                  background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,165,0,0.10))',
                  color: '#FFD700',
                }}>
                  Chat+
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* XP Bars */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!loaded ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', fontSize: 13 }}>
            Loading XP data...
          </div>
        ) : (
          <>
            <XpBarCard bar="chatter" isPremium={isPremium} />
            <XpBarCard bar="gamer" isPremium={isPremium} />
            <XpBarCard bar="writer" isPremium={isPremium} />

            {/* Tip */}
            <div style={{
              marginTop: 4, padding: '10px 14px', borderRadius: 10,
              background: 'var(--popup-item-bg)',
              border: '1px solid var(--panel-divider)',
              fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5,
            }}>
              {isPremium
                ? 'Aero Chat+ \u2014 No daily XP cap. Earn unlimited XP!'
                : 'Free users earn up to 100 XP per bar per day. Upgrade to Aero Chat+ to remove the cap!'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
