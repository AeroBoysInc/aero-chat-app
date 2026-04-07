// src/hooks/useFlip.ts
import { useRef, useCallback } from 'react';

interface FlipState {
  captureFirst: (el: HTMLElement) => void;
  playExpand: (el: HTMLElement, onDone?: () => void) => void;
  playCollapse: (el: HTMLElement, targetRect: DOMRect, onDone?: () => void) => void;
}

export function useFlip(): FlipState {
  const firstRect = useRef<DOMRect | null>(null);

  const captureFirst = useCallback((el: HTMLElement) => {
    firstRect.current = el.getBoundingClientRect();
  }, []);

  const playExpand = useCallback((el: HTMLElement, onDone?: () => void) => {
    const first = firstRect.current;
    if (!first) {
      onDone?.();
      return;
    }

    const last = el.getBoundingClientRect();
    const dx = first.left - last.left + (first.width - last.width) / 2;
    const dy = first.top - last.top + (first.height - last.height) / 2;
    const sx = first.width / last.width;
    const sy = first.height / last.height;

    el.style.willChange = 'transform';
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    el.style.transformOrigin = 'top left';
    el.style.borderRadius = '18px';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.45s cubic-bezier(0.23, 1, 0.32, 1), border-radius 0.45s cubic-bezier(0.23, 1, 0.32, 1)';
        el.style.transform = 'translate(0, 0) scale(1, 1)';
        el.style.borderRadius = '0px';

        const cleanup = () => {
          el.style.willChange = '';
          el.style.transition = '';
          el.style.transformOrigin = '';
          el.removeEventListener('transitionend', cleanup);
          onDone?.();
        };
        el.addEventListener('transitionend', cleanup, { once: true });
      });
    });
  }, []);

  const playCollapse = useCallback((el: HTMLElement, targetRect: DOMRect, onDone?: () => void) => {
    const last = el.getBoundingClientRect();
    const dx = targetRect.left - last.left + (targetRect.width - last.width) / 2;
    const dy = targetRect.top - last.top + (targetRect.height - last.height) / 2;
    const sx = targetRect.width / last.width;
    const sy = targetRect.height / last.height;

    el.style.willChange = 'transform';
    el.style.transition = 'transform 0.35s cubic-bezier(0.445, 0.05, 0.55, 0.95), border-radius 0.35s cubic-bezier(0.445, 0.05, 0.55, 0.95)';
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    el.style.transformOrigin = 'top left';
    el.style.borderRadius = '18px';

    const cleanup = () => {
      el.style.willChange = '';
      el.style.transition = '';
      el.style.transform = '';
      el.style.transformOrigin = '';
      el.style.borderRadius = '';
      el.removeEventListener('transitionend', cleanup);
      onDone?.();
    };
    el.addEventListener('transitionend', cleanup, { once: true });
  }, []);

  return { captureFirst, playExpand, playCollapse };
}
