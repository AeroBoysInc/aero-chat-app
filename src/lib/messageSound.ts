/**
 * Bubbly message notification sound via Web Audio API.
 * Two short rising sine tones with a soft attack — sounds like a gentle bubble pop.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function playMessageSound() {
  try {
    const ac = getCtx();
    const now = ac.currentTime;

    // Bubble 1 — low pop
    const osc1 = ac.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(600, now);
    osc1.frequency.exponentialRampToValueAtTime(900, now + 0.08);

    const gain1 = ac.createGain();
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.15, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc1.connect(gain1).connect(ac.destination);
    osc1.start(now);
    osc1.stop(now + 0.13);

    // Bubble 2 — higher pop, slightly delayed
    const osc2 = ac.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(800, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.16);

    const gain2 = ac.createGain();
    gain2.gain.setValueAtTime(0, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.095);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc2.connect(gain2).connect(ac.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.22);
  } catch {
    // Audio context not available — silently skip
  }
}
