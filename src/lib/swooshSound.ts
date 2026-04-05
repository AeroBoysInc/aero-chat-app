// Procedural swoosh sound via Web Audio API — no audio files needed
let ctx: AudioContext | null = null;

export function playSwoosh() {
  try {
    if (!ctx) ctx = new AudioContext();
    const now = ctx.currentTime;

    // Filtered noise burst → swoosh texture
    const duration = 0.35;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.6;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Bandpass filter sweeps from 800Hz → 2400Hz
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + duration * 0.6);
    filter.frequency.exponentialRampToValueAtTime(600, now + duration);

    // Volume envelope: quick rise, gentle fade
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
    gain.gain.linearRampToValueAtTime(0.08, now + duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);
  } catch {
    // Audio context not available — silently skip
  }
}
