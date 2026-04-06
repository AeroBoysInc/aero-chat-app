// src/components/corners/AvatarCorner.tsx
import React, { useEffect } from 'react';
import { MessageCircle, Gamepad2, PenTool, Palette, Award } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../../store/authStore';
import { useXpStore } from '../../store/xpStore';
import { useAvatarStore } from '../../store/avatarStore';
import { type XpBar, BAR_META, DAILY_XP_CAP, deriveLevel, deriveOverallLevel } from '../../lib/xpConfig';
import { getAvatarBase } from '../../lib/avatarConfig';
import { AeroAgent } from './AeroAgent';

const BAR_ICONS: Record<XpBar, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  chatter: MessageCircle,
  gamer: Gamepad2,
  writer: PenTool,
};

// ── XP Bar (upgraded style) ─────────────────────────────────────────────────

const StatBar = React.memo(function StatBar({ bar, isPremium }: { bar: XpBar; isPremium: boolean }) {
  const totalXp = useXpStore(s => s[`${bar}_xp`]);
  const dailyUsed = useXpStore(s => s[`${bar}_daily`]);
  const { level, currentXp, nextXp } = deriveLevel(totalXp);
  const meta = BAR_META[bar];
  const Icon = BAR_ICONS[bar];
  const progress = level >= 100 ? 100 : nextXp > 0 ? Math.round((currentXp / nextXp) * 100) : 0;
  const dailyProgress = isPremium ? 0 : Math.min(dailyUsed / DAILY_XP_CAP, 1);

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon style={{ width: 12, height: 12, color: meta.color, opacity: 0.8 }} />
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            color: 'var(--text-secondary)', textTransform: 'uppercase',
          }}>
            {meta.label}
          </span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: meta.color }}>
          LEVEL {level}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 10, borderRadius: 6,
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          height: '100%', borderRadius: 6,
          background: `linear-gradient(90deg, ${meta.color}99, ${meta.color})`,
          width: `${progress}%`,
          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: `0 0 10px ${meta.color}40`,
        }} />
      </div>

      {/* EXP counter */}
      <div style={{
        fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', marginTop: 3,
        fontWeight: 500, letterSpacing: '0.02em',
      }}>
        {level >= 100
          ? 'MAX LEVEL'
          : `EXP ${currentXp.toLocaleString()} / ${nextXp.toLocaleString()}`}
      </div>

      {/* Daily cap (free users only) */}
      {!isPremium && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <div style={{
            flex: 1, height: 3, borderRadius: 2,
            background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: dailyProgress >= 1 ? 'rgba(255,80,50,0.6)' : `${meta.color}44`,
              width: `${Math.round(dailyProgress * 100)}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ fontSize: 8, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {dailyUsed}/{DAILY_XP_CAP} daily
          </span>
        </div>
      )}
    </div>
  );
});

// ── Main component ───────────────────────────────────────────────────────────

export function AvatarCorner() {
  const user = useAuthStore(s => s.user);
  const isPremium = useAuthStore(s => s.user?.is_premium === true);
  const loadXp = useXpStore(s => s.loadXp);
  const loaded = useXpStore(s => s.loaded);
  const chatterXp = useXpStore(s => s.chatter_xp);
  const gamerXp = useXpStore(s => s.gamer_xp);
  const writerXp = useXpStore(s => s.writer_xp);
  const selectedBase = useAvatarStore(s => s.selectedBase);
  const equipped = useAvatarStore(useShallow(s => s.equipped));

  const avatarBase = getAvatarBase(selectedBase);
  const overallLevel = deriveOverallLevel(chatterXp, gamerXp, writerXp);

  useEffect(() => {
    if (user?.id && !loaded) {
      loadXp(user.id);
    }
  }, [user?.id, loaded, loadXp]);

  if (!user) return null;

  return (
    <div
      className="flex h-full"
      style={{
        background: 'var(--chat-bg)',
        border: '1px solid var(--chat-border)',
        borderRadius: 16,
        boxShadow: 'var(--chat-shadow)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Gloss overlay */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 80,
        background: 'var(--chat-gloss)', pointerEvents: 'none', borderRadius: 'inherit',
        zIndex: 10,
      }} />

      {/* ── LEFT PANEL: Character ── */}
      <div style={{
        flex: '0 0 45%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px 20px',
        borderRight: '1px solid var(--panel-divider)',
        position: 'relative',
      }}>
        {/* Decorative corner orb */}
        <div className="pointer-events-none absolute" style={{
          width: 100, height: 100, top: -30, left: -30,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,255,0.10) 0%, transparent 65%)',
        }} />

        {/* Character display */}
        <div style={{ width: '80%', maxWidth: 240, position: 'relative' }}>
          <AeroAgent
            base={avatarBase.src}
            helmet={equipped.helmet}
            armor={equipped.armor}
            weapon={equipped.weapon}
            wings={equipped.wings}
          />
        </div>

        {/* Agent label */}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <div style={{
            fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
            color: 'var(--text-muted)', textTransform: 'uppercase',
          }}>
            {isPremium ? 'Premium User' : 'Free User'}
          </div>
          <div style={{
            fontSize: 13, fontWeight: 800, color: 'var(--text-primary)',
            marginTop: 2, fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            AGENT: {avatarBase.label.toUpperCase()}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            disabled
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 10,
              background: 'rgba(168,85,247,0.12)',
              border: '1px solid rgba(168,85,247,0.25)',
              color: 'rgba(168,85,247,0.5)',
              fontSize: 11, fontWeight: 700,
              cursor: 'not-allowed', opacity: 0.6,
            }}
          >
            <Palette style={{ width: 13, height: 13 }} />
            Customize
          </button>
          <button
            disabled
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 10,
              background: 'rgba(255,180,0,0.10)',
              border: '1px solid rgba(255,180,0,0.22)',
              color: 'rgba(255,180,0,0.5)',
              fontSize: 11, fontWeight: 700,
              cursor: 'not-allowed', opacity: 0.6,
            }}
          >
            <Award style={{ width: 13, height: 13 }} />
            Badges
          </button>
        </div>
      </div>

      {/* ── RIGHT PANEL: Stats ── */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        padding: '24px 20px 20px',
        position: 'relative',
        overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
              color: 'var(--text-muted)', textTransform: 'uppercase',
            }}>
              Current Level:
            </div>
            <h2 style={{
              fontSize: 16, fontWeight: 800, color: 'var(--text-primary)',
              fontFamily: 'Inter, system-ui, sans-serif',
              margin: '2px 0 0',
              letterSpacing: '-0.3px',
            }}>
              AERO AGENT STATUS
            </h2>
            {isPremium && (
              <span style={{
                display: 'inline-block', marginTop: 4,
                padding: '2px 8px', borderRadius: 10,
                fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,165,0,0.10))',
                color: '#FFD700',
                border: '1px solid rgba(255,215,0,0.28)',
              }}>
                Aero Chat+
              </span>
            )}
          </div>

          {/* Overall level circle */}
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,120,255,0.08))',
            border: '2px solid rgba(0,212,255,0.35)',
            boxShadow: '0 0 12px rgba(0,212,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: 18, fontWeight: 800, color: '#00d4ff',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              {overallLevel}
            </span>
          </div>
        </div>

        {/* XP Bars */}
        {!loaded ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 13,
          }}>
            Loading XP data...
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            <StatBar bar="chatter" isPremium={isPremium} />
            <StatBar bar="writer" isPremium={isPremium} />
            <StatBar bar="gamer" isPremium={isPremium} />
          </div>
        )}

        {/* Tip */}
        <div style={{
          marginTop: 'auto', padding: '10px 14px', borderRadius: 10,
          background: 'var(--popup-item-bg)',
          border: '1px solid var(--panel-divider)',
          fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5,
        }}>
          {isPremium
            ? 'Aero Chat+ \u2014 No daily XP cap. Earn unlimited XP!'
            : 'Free users earn up to 100 XP per bar per day. Upgrade to Aero Chat+ to remove the cap!'}
        </div>
      </div>
    </div>
  );
}
