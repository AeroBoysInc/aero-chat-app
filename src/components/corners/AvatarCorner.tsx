// src/components/corners/AvatarCorner.tsx
import React, { useEffect } from 'react';
import { MessageCircle, Gamepad2, PenTool, Palette, Award, Trophy } from 'lucide-react';
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

// ── Crystal XP Bar ──────────────────────────────────────────────────────────

const StatBar = React.memo(function StatBar({ bar, isPremium }: { bar: XpBar; isPremium: boolean }) {
  const totalXp = useXpStore(s => s[`${bar}_xp`]);
  const dailyUsed = useXpStore(s => s[`${bar}_daily`]);
  const { level, currentXp, nextXp } = deriveLevel(totalXp);
  const meta = BAR_META[bar];
  const Icon = BAR_ICONS[bar];
  const progress = level >= 100 ? 100 : nextXp > 0 ? Math.round((currentXp / nextXp) * 100) : 0;
  const dailyProgress = isPremium ? 0 : Math.min(dailyUsed / DAILY_XP_CAP, 1);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
          color: 'var(--text-secondary)', textTransform: 'uppercase',
        }}>
          {meta.label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: meta.color }}>
          LEVEL {level}
        </span>
      </div>

      {/* Bar row — circle icon connected to glass tube */}
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        {/* Circular icon — overlaps left edge of bar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: 'var(--card-bg-solid)',
          border: `2px solid ${meta.color}50`,
          boxShadow: `0 0 10px ${meta.color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', zIndex: 3,
        }}>
          <Icon style={{ width: 16, height: 16, color: meta.color }} />
        </div>

        {/* Glass tube — extends from behind the circle */}
        <div style={{
          flex: 1, height: 24, borderRadius: 12,
          background: 'var(--slider-track)',
          position: 'relative',
          marginLeft: -14,
          border: '1px solid var(--card-border)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15)',
          overflow: 'visible',
        }}>
          {/* Liquid fill */}
          <div style={{
            height: '100%', borderRadius: 12,
            background: `
              linear-gradient(90deg, ${meta.color}70 0%, ${meta.color}90 30%, ${meta.color}aa 55%, rgba(120,230,200,0.7) 80%, rgba(200,255,240,0.85) 100%),
              linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 40%, rgba(0,0,0,0.08) 100%)
            `,
            backgroundBlendMode: 'screen',
            width: `${progress}%`,
            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: `0 0 16px ${meta.color}35, inset 0 -2px 4px rgba(0,0,0,0.12), inset 0 2px 4px rgba(255,255,255,0.20)`,
            position: 'relative',
            minWidth: progress > 0 ? 20 : 0,
            overflow: 'hidden',
          }}>
            {/* Liquid gloss — top highlight */}
            <div style={{
              position: 'absolute', top: 1, left: 4, right: 4, height: '38%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.50) 0%, rgba(255,255,255,0.10) 100%)',
              borderRadius: 10,
            }} />
            {/* Liquid shimmer — animated light refraction */}
            <div className="xp-liquid-shimmer" style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.25) 35%, rgba(255,255,255,0.40) 40%, rgba(255,255,255,0.25) 45%, transparent 60%)`,
              backgroundSize: '200% 100%',
              borderRadius: 'inherit',
            }} />
            {/* Diamond/crystal tip at the end of the fill */}
            {progress > 0 && (
              <div style={{
                position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)',
                width: 0, height: 0,
                borderTop: '12px solid transparent',
                borderBottom: '12px solid transparent',
                borderLeft: `12px solid ${meta.color}`,
                filter: `drop-shadow(0 0 4px ${meta.color}80)`,
                zIndex: 2,
              }} />
            )}
          </div>
        </div>
      </div>

      {/* EXP counter */}
      <div style={{
        fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', marginTop: 4,
        fontWeight: 600, letterSpacing: '0.02em',
      }}>
        {level >= 100
          ? 'MAX LEVEL'
          : `EXP ${currentXp.toLocaleString()} / ${nextXp.toLocaleString()}`}
      </div>

      {/* Daily cap (free users only) */}
      {!isPremium && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, paddingLeft: 22 }}>
          <div style={{
            flex: 1, height: 3, borderRadius: 2,
            background: 'var(--slider-track)', overflow: 'hidden',
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

// ── Circular icon button ────────────────────────────────────────────────────

interface IconBtnProps {
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  label: string;
  color: string;
  bg: string;
  border: string;
}

const IconBtn = React.memo(function IconBtn({ icon: Icon, label, color, bg, border }: IconBtnProps) {
  return (
    <button
      disabled
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        background: 'none', border: 'none', padding: 0,
        cursor: 'not-allowed', opacity: 0.7,
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: bg,
        border: `1.5px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 8px ${border}`,
      }}>
        <Icon style={{ width: 22, height: 22, color }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.02em' }}>
        {label}
      </span>
    </button>
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
    /* Full-area centering wrapper */
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      {/* ── Two-panel layout ── */}
      <div style={{
        display: 'flex', gap: 14,
        width: '100%', maxWidth: 1060,
        height: '100%', maxHeight: 580,
        position: 'relative',
      }}>

        {/* ── LEFT PANEL: Character + Buttons ── */}
        <div style={{
          flex: '0 0 42%',
          position: 'relative',
          background: 'linear-gradient(145deg, rgba(0,150,255,0.08), rgba(0,80,200,0.04), rgba(120,0,200,0.03))',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 20,
          boxShadow: '0 8px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          overflow: 'hidden',
          minHeight: 420,
        }}>
          {/* Gloss */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)',
            pointerEvents: 'none', borderRadius: 'inherit', zIndex: 10,
          }} />
          {/* Character — fills entire panel, centered vertically */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'visible',
          }}>
            <div style={{
              width: 900,
              flexShrink: 0,
              position: 'relative',
              zIndex: 2,
              marginLeft: -80,
            }}>
              <AeroAgent
                base={avatarBase.src}
                helmet={equipped.helmet}
                armor={equipped.armor}
                weapon={equipped.weapon}
                wings={equipped.wings}
              />
            </div>
          </div>

          {/* Icon buttons — absolutely positioned, right side */}
          <div style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', flexDirection: 'column',
            gap: 14, zIndex: 12,
          }}>
            <IconBtn
              icon={Palette}
              label="Customize"
              color="#a855f7"
              bg="rgba(168,85,247,0.12)"
              border="rgba(168,85,247,0.30)"
            />
            <IconBtn
              icon={Award}
              label="Badges"
              color="#ffb400"
              bg="rgba(255,180,0,0.10)"
              border="rgba(255,180,0,0.25)"
            />
            <IconBtn
              icon={Trophy}
              label="Achievements"
              color="#3dd87a"
              bg="rgba(61,216,122,0.10)"
              border="rgba(61,216,122,0.25)"
            />
          </div>

          {/* Agent label — absolutely positioned at bottom */}
          <div style={{
            position: 'absolute', bottom: 14, left: 0, right: 0,
            textAlign: 'center', zIndex: 12,
          }}>
            <div style={{
              fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
              color: 'var(--text-muted)', textTransform: 'uppercase',
            }}>
              {isPremium ? 'Premium User' : 'Free User'}
            </div>
            <div style={{
              fontSize: 14, fontWeight: 800, color: 'var(--text-primary)',
              marginTop: 2, fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              AGENT: {avatarBase.label.toUpperCase()}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Stats ── */}
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          padding: '22px 24px 18px 22px',
          position: 'relative',
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 20,
          boxShadow: 'var(--chat-shadow)',
          overflow: 'visible',
        }}>
          {/* Gloss */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
            background: 'var(--card-gloss)',
            pointerEvents: 'none', borderRadius: 20, zIndex: 10,
            overflow: 'hidden',
          }} />

          {/* Overall level circle — large, overlapping top-right edge */}
          <div style={{
            position: 'absolute', top: -20, right: -20, zIndex: 15,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'var(--card-bg-solid)',
              border: '3px solid var(--card-border)',
              boxShadow: 'var(--chat-shadow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontSize: 32, fontWeight: 800, color: 'var(--text-title)',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}>
                {overallLevel}
              </span>
            </div>
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
              color: 'var(--text-muted)', textTransform: 'uppercase',
              marginTop: 4,
            }}>
              Current Level
            </span>
          </div>

          {/* Header */}
          <div style={{ marginBottom: 20, position: 'relative', zIndex: 2, paddingRight: 70 }}>
            <h2 style={{
              fontSize: 22, fontWeight: 800, color: 'var(--text-title)',
              fontFamily: 'Inter, system-ui, sans-serif',
              margin: 0,
              letterSpacing: '-0.3px',
            }}>
              AERO AGENT STATUS
            </h2>
            {isPremium && (
              <span style={{
                display: 'inline-block', marginTop: 8,
                padding: '3px 10px', borderRadius: 10,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,165,0,0.10))',
                color: '#FFD700',
                border: '1px solid rgba(255,215,0,0.28)',
              }}>
                Aero Chat+
              </span>
            )}
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
              <StatBar bar="chatter" isPremium={isPremium} />
              <StatBar bar="writer" isPremium={isPremium} />
              <StatBar bar="gamer" isPremium={isPremium} />
            </div>
          )}

          {/* Tip */}
          <div style={{
            marginTop: 'auto', padding: '8px 12px', borderRadius: 10,
            background: 'var(--popup-item-bg)',
            border: '1px solid var(--panel-divider)',
            fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5,
            position: 'relative', zIndex: 2,
          }}>
            {isPremium
              ? 'Aero Chat+ \u2014 No daily XP cap. Earn unlimited XP!'
              : 'Free users earn up to 100 XP per bar per day. Upgrade to Aero Chat+ to remove the cap!'}
          </div>
        </div>
      </div>
    </div>
  );
}
