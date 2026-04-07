// src/hooks/useParallax.ts
import { useRef, useCallback, useEffect, type RefObject, type CSSProperties } from 'react';

interface ParallaxResult {
  style: CSSProperties;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function useParallax(
  ref: RefObject<HTMLElement | null>,
  maxRotate = 15,
): ParallaxResult {
  const mouseX = useRef(0);
  const mouseY = useRef(0);
  const currentRX = useRef(0);
  const currentRY = useRef(0);
  const rafId = useRef(0);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const styleRef = useRef<CSSProperties>({
    transform: 'perspective(800px) rotateY(0deg) rotateX(0deg)',
    transition: 'transform 0.1s ease-out',
  });

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mouseX.current = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    mouseY.current = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
  }, [ref]);

  const onMouseEnter = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    const el = ref.current;
    if (el) el.style.willChange = 'transform';
  }, [ref]);

  const onMouseLeave = useCallback(() => {
    mouseX.current = 0;
    mouseY.current = 0;
    leaveTimer.current = setTimeout(() => {
      const el = ref.current;
      if (el) el.style.willChange = '';
    }, 600);
  }, [ref]);

  useEffect(() => {
    const animate = () => {
      const targetRX = mouseX.current * maxRotate;
      const targetRY = mouseY.current * -maxRotate;
      currentRX.current += (targetRX - currentRX.current) * 0.12;
      currentRY.current += (targetRY - currentRY.current) * 0.12;

      const el = ref.current;
      if (el) {
        el.style.transform =
          `perspective(800px) rotateY(${currentRX.current.toFixed(2)}deg) rotateX(${currentRY.current.toFixed(2)}deg)`;
      }
      rafId.current = requestAnimationFrame(animate);
    };
    rafId.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId.current);
  }, [ref, maxRotate]);

  return { style: styleRef.current, onMouseMove, onMouseEnter, onMouseLeave };
}
