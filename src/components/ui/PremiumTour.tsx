import { useState, useEffect, useCallback } from 'react';
import { useTourStore } from '../../store/tourStore';
import type { TourAction } from '../../store/tourStore';

const TOTAL_SLIDES = 7;

// Style constants
const MODAL_BG = 'linear-gradient(135deg, #0a1628 0%, #1a3a5c 50%, #0d2240 100%)';
const GOLD = '#FFD700';
const GOLD_GRADIENT = 'linear-gradient(135deg, #FFD700, #FFA500)';
const CARD_BG = 'rgba(255,255,255,0.04)';
const CARD_BORDER = 'rgba(255,255,255,0.08)';
const TEXT_SUB = 'rgba(255,255,255,0.5)';
const TEXT_MUTED = 'rgba(255,255,255,0.3)';
const AMBIENT = `radial-gradient(circle at 50% 20%, rgba(255,215,0,0.06) 0%, transparent 60%), radial-gradient(circle at 20% 80%, rgba(91,200,245,0.04) 0%, transparent 50%)`;

const navBtnBase: React.CSSProperties = {
  padding: '10px 28px',
  borderRadius: 12,
  border: 'none',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const goldBtn: React.CSSProperties = {
  background: GOLD_GRADIENT,
  color: '#0a1628',
  boxShadow: '0 4px 16px rgba(255,215,0,0.25)',
};

const ghostBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.5)',
  border: '1px solid rgba(255,255,255,0.1)',
};

const slideInnerStyle: React.CSSProperties = {
  padding: '40px 36px',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const featureIconStyle: React.CSSProperties = {
  fontSize: 64,
  marginBottom: 16,
  lineHeight: 1,
};

const featureTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: '#fff',
  marginBottom: 6,
  fontFamily: 'Inter, system-ui, sans-serif',
};

const featureDescStyle: React.CSSProperties = {
  fontSize: 13,
  color: TEXT_SUB,
  lineHeight: 1.6,
  maxWidth: 360,
  marginBottom: 16,
};

const ctaBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '10px 24px',
  borderRadius: 12,
  background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,165,0,0.08))',
  border: '1px solid rgba(255,215,0,0.25)',
  color: GOLD,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: 8,
  fontFamily: 'Inter, system-ui, sans-serif',
};

const featureGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  width: '100%',
};

interface FeatureCardProps {
  icon: string;
  name: string;
  description: string;
}

function FeatureCard({ icon, name, description }: FeatureCardProps) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: '14px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: 28, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}>{name}</span>
      <span style={{ fontSize: 10, color: TEXT_MUTED, lineHeight: 1.5, fontFamily: 'Inter, system-ui, sans-serif' }}>{description}</span>
    </div>
  );
}

interface SlideContentProps {
  slide: number;
  onTryIt: (action: TourAction) => void;
}

function SlideContent({ slide, onTryIt }: SlideContentProps) {
  switch (slide) {
    // Slide 0 — Welcome
    case 0:
      return (
        <div style={slideInnerStyle}>
          <div style={{ fontSize: 56, marginBottom: 16, lineHeight: 1 }}>🎉</div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: GOLD,
              marginBottom: 10,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            Welcome to Aero Chat+
          </h2>
          <p style={{ ...featureDescStyle, marginBottom: 24 }}>
            Congratulations! You're now part of the Aero Plus club. Let us show you everything you've unlocked.
          </p>
          <div style={featureGridStyle}>
            <FeatureCard icon="🎨" name="Premium Themes" description="Exclusive color palettes & ultra themes" />
            <FeatureCard icon="💎" name="Card Effects" description="Shimmer, bubbles, aurora & more" />
            <FeatureCard icon="💬" name="Bubble Styles" description="Personalize every message you send" />
            <FeatureCard icon="⚡" name="Unlimited XP" description="No daily cap on experience points" />
          </div>
        </div>
      );

    // Slide 1 — Premium Themes
    case 1:
      return (
        <div style={slideInnerStyle}>
          <div style={featureIconStyle}>🎨</div>
          <h2 style={featureTitleStyle}>Premium Themes</h2>
          <p style={featureDescStyle}>
            Transform your entire chat experience with exclusive color themes. Each one is hand-crafted for maximum immersion.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              justifyContent: 'center',
              marginBottom: 12,
              width: '100%',
            }}
          >
            {[
              {
                emoji: '🌊',
                label: 'Ocean',
                bg: 'linear-gradient(135deg, #041e30, #0a6e8a)',
                color: '#00d4ff',
              },
              {
                emoji: '🌅',
                label: 'Sunset',
                bg: 'linear-gradient(135deg, #2a1008, #8b3a0e)',
                color: '#ff8c3c',
              },
              {
                emoji: '🌌',
                label: 'Aurora',
                bg: 'linear-gradient(135deg, #080620, #2a1050)',
                color: '#a855f7',
              },
              {
                emoji: '🌸',
                label: 'Sakura',
                bg: 'linear-gradient(135deg, #1e081a, #4a1040)',
                color: '#ff78b4',
              },
            ].map((theme) => (
              <div
                key={theme.label}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: theme.bg,
                  color: theme.color,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {theme.emoji} {theme.label}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 12, fontFamily: 'Inter, system-ui, sans-serif' }}>
            Plus Ultra themes available for purchase: John Frutiger &amp; Golden Hour
          </p>
          <button style={ctaBtnStyle} onClick={() => onTryIt('theme-switcher')}>
            Open Theme Switcher →
          </button>
        </div>
      );

    // Slide 2 — Card Customization
    case 2:
      return (
        <div style={slideInnerStyle}>
          <div style={featureIconStyle}>💎</div>
          <h2 style={featureTitleStyle}>Card Customization</h2>
          <p style={featureDescStyle}>
            Make your profile card uniquely yours. Choose colors, add effects, and craft a bio that shows who you are.
          </p>
          <div style={{ ...featureGridStyle, marginBottom: 16 }}>
            <FeatureCard icon="🌈" name="Custom Colors" description="Full color picker" />
            <FeatureCard icon="✨" name="Name Effects" description="Rainbow, wave, pulse, glitch, sparkle" />
            <FeatureCard icon="🎭" name="Card Effects" description="Shimmer, bubbles, sparkles, aurora, rain, fireflies" />
            <FeatureCard icon="📝" name="Extended Bio" description="Up to 500 characters" />
          </div>
          <button style={ctaBtnStyle} onClick={() => onTryIt('identity-editor')}>
            Open Identity Editor →
          </button>
        </div>
      );

    // Slide 3 — Bubble Styles
    case 3:
      return (
        <div style={slideInnerStyle}>
          <div style={featureIconStyle}>💬</div>
          <h2 style={featureTitleStyle}>Chat Bubble Styles</h2>
          <p style={featureDescStyle}>
            Your messages, your style. Pick from a range of premium bubble themes that make your chats stand out.
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 8,
              width: '100%',
              marginBottom: 12,
            }}
          >
            {[
              {
                label: 'Aero Cyan ✨',
                bg: 'linear-gradient(135deg, #00b4d8, #0096c7)',
                color: 'white',
              },
              {
                label: 'Sunset Warm 🌅',
                bg: 'linear-gradient(135deg, #ff6b35, #f7931e)',
                color: 'white',
              },
              {
                label: 'Midnight 🌙',
                bg: 'linear-gradient(135deg, #1a1a3e, #2d2d5e)',
                color: '#b0b0ff',
              },
              {
                label: 'Neon Pink 💖',
                bg: 'linear-gradient(135deg, #ff1493, #ff69b4)',
                color: 'white',
              },
            ].map((bubble) => (
              <div
                key={bubble.label}
                style={{
                  background: bubble.bg,
                  color: bubble.color,
                  padding: '10px 16px',
                  borderRadius: '16px 16px 4px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  maxWidth: '80%',
                }}
              >
                {bubble.label}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 12, fontFamily: 'Inter, system-ui, sans-serif' }}>
            + Aurora Violet, Frosted Glass, Matte Dark
          </p>
          <button style={ctaBtnStyle} onClick={() => onTryIt('bubble-picker')}>
            Open Bubble Picker →
          </button>
        </div>
      );

    // Slide 4 — Animated Avatars
    case 4:
      return (
        <div style={slideInnerStyle}>
          <div style={featureIconStyle}>🖼️</div>
          <h2 style={featureTitleStyle}>Animated Avatars</h2>
          <p style={featureDescStyle}>
            Upload animated GIFs as your avatar. Stand out in every chat, friend list, and group conversation.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 32,
              marginBottom: 24,
            }}
          >
            {/* Static avatar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4a4a4a, #6a6a6a)',
                  border: '2px solid rgba(255,255,255,0.1)',
                }}
              />
              <span style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: 'Inter, system-ui, sans-serif' }}>Static</span>
            </div>

            {/* Arrow */}
            <span style={{ fontSize: 24, color: TEXT_SUB }}>→</span>

            {/* Animated avatar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: GOLD_GRADIENT,
                  border: `2px solid ${GOLD}`,
                  boxShadow: `0 0 20px rgba(255,215,0,0.4)`,
                  animation: 'premiumTourShimmer 2s ease-in-out infinite',
                }}
              />
              <span style={{ fontSize: 11, color: GOLD, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 600 }}>
                GIF ✨
              </span>
            </div>
          </div>
          <style>{`
            @keyframes premiumTourShimmer {
              0%, 100% { opacity: 1; box-shadow: 0 0 20px rgba(255,215,0,0.4); }
              50% { opacity: 0.85; box-shadow: 0 0 36px rgba(255,215,0,0.7); }
            }
          `}</style>
          <button style={ctaBtnStyle} onClick={() => onTryIt('settings')}>
            Upload Avatar →
          </button>
        </div>
      );

    // Slide 5 — More Perks
    case 5:
      return (
        <div style={slideInnerStyle}>
          <div style={featureIconStyle}>⚡</div>
          <h2 style={featureTitleStyle}>More Perks</h2>
          <p style={featureDescStyle}>
            Aero Chat+ comes loaded with quality-of-life upgrades that make every interaction smoother and more powerful.
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              width: '100%',
              marginBottom: 16,
            }}
          >
            {[
              {
                icon: '📊',
                title: 'Unlimited XP',
                description: 'No daily cap — earn as much as you want',
              },
              {
                icon: '📁',
                title: '50 MB File Uploads',
                description: '5x the free tier limit',
              },
            ].map((perk) => (
              <div
                key={perk.title}
                style={{
                  background: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 12,
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{perk.icon}</span>
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#fff',
                      marginBottom: 2,
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  >
                    {perk.title}
                  </div>
                  <div style={{ fontSize: 12, color: TEXT_SUB, fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {perk.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    // Slide 6 — Done
    case 6:
      return (
        <div style={slideInnerStyle}>
          <div style={{ fontSize: 56, marginBottom: 16, lineHeight: 1 }}>🏆</div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: GOLD,
              marginBottom: 10,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            You're All Set!
          </h2>
          <p style={{ ...featureDescStyle, marginBottom: 20 }}>
            You now have full access to every Aero Chat+ feature. Start exploring — apply a theme, customize your card, and make every chat truly yours. You can revisit this tour anytime via the logo.
          </p>
          <p style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: 'Inter, system-ui, sans-serif' }}>
            Tip: Click the AeroChat logo in the header to reopen this tour
          </p>
        </div>
      );

    default:
      return null;
  }
}

interface PremiumTourProps {
  open: boolean;
  onClose: () => void;
}

export function PremiumTour({ open, onClose }: PremiumTourProps) {
  const [slide, setSlide] = useState(0);
  const [visible, setVisible] = useState(false);
  const { setPendingAction, markSeen } = useTourStore();

  useEffect(() => {
    if (open) {
      setSlide(0);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  const userId = (() => {
    try {
      const raw = localStorage.getItem('aero-auth');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return parsed?.state?.user?.id ?? '';
    } catch {
      return '';
    }
  })();

  const handleClose = useCallback(() => {
    if (userId) markSeen(userId);
    setVisible(false);
    setTimeout(onClose, 150);
  }, [userId, markSeen, onClose]);

  const handleTryIt = useCallback(
    (action: TourAction) => {
      if (userId) markSeen(userId);
      setPendingAction(action);
      setVisible(false);
      setTimeout(onClose, 150);
    },
    [userId, markSeen, setPendingAction, onClose],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, handleClose]);

  if (!open) return null;

  const isFirst = slide === 0;
  const isLast = slide === TOTAL_SLIDES - 1;

  return (
    // Fixed overlay
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
    >
      {/* Inner modal — stop propagation so clicks inside don't close */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: MODAL_BG,
          borderRadius: 24,
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          transform: visible ? 'scale(1)' : 'scale(0.95)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.2s ease, opacity 0.2s ease',
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: AMBIENT,
            pointerEvents: 'none',
            borderRadius: 24,
          }}
        />

        {/* Slide content area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <SlideContent slide={slide} onTryIt={handleTryIt} />
        </div>

        {/* Dot indicators */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            paddingBottom: 8,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <div
              key={i}
              onClick={() => setSlide(i)}
              style={{
                width: i === slide ? 24 : 8,
                height: 8,
                borderRadius: i === slide ? 4 : '50%',
                background: i === slide ? GOLD : 'rgba(255,255,255,0.2)',
                cursor: 'pointer',
                transition: 'width 0.2s ease, background 0.2s ease',
                flexShrink: 0,
              }}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: isFirst ? 'flex-end' : 'space-between',
            alignItems: 'center',
            padding: '12px 24px 20px',
            gap: 12,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {isFirst ? (
            <>
              <button style={{ ...navBtnBase, ...ghostBtn }} onClick={handleClose}>
                Skip Tour
              </button>
              <button style={{ ...navBtnBase, ...goldBtn }} onClick={() => setSlide(1)}>
                Let's Go →
              </button>
            </>
          ) : (
            <>
              <button style={{ ...navBtnBase, ...ghostBtn }} onClick={() => setSlide((s) => s - 1)}>
                ← Back
              </button>
              {isLast ? (
                <button style={{ ...navBtnBase, ...goldBtn }} onClick={handleClose}>
                  Start Exploring →
                </button>
              ) : (
                <button style={{ ...navBtnBase, ...goldBtn }} onClick={() => setSlide((s) => s + 1)}>
                  Next →
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
