/**
 * Soothing ringtone generated via Web Audio API.
 * Plays a gentle repeating chime pattern — no audio file needed.
 */

let ctx: AudioContext | null = null;
let loopTimer: ReturnType<typeof setTimeout> | null = null;
let playing = false;

/** Frequencies for a soft C-major pentatonic chime (C5, E5, G5, C6) */
const CHIME_NOTES = [523.25, 659.25, 783.99, 1046.50];
const NOTE_DURATION = 0.35;
const NOTE_GAP = 0.18;
const LOOP_PAUSE = 2200; // ms pause between chime sequences

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function playChimeSequence() {
  const ac = getCtx();
  const now = ac.currentTime;

  CHIME_NOTES.forEach((freq, i) => {
    const start = now + i * (NOTE_DURATION + NOTE_GAP);

    // Oscillator — soft sine tone
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    // Gain envelope — gentle fade in/out
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.12, start + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, start + NOTE_DURATION);

    osc.connect(gain);
    gain.connect(ac.destination);

    osc.start(start);
    osc.stop(start + NOTE_DURATION + 0.05);
  });
}

/** Start the ringtone loop. Safe to call multiple times. */
export function startRingtone() {
  if (playing) return;
  playing = true;
  playChimeSequence();

  const totalChimeDuration = CHIME_NOTES.length * (NOTE_DURATION + NOTE_GAP) * 1000;

  function scheduleNext() {
    if (!playing) return;
    loopTimer = setTimeout(() => {
      if (!playing) return;
      playChimeSequence();
      scheduleNext();
    }, totalChimeDuration + LOOP_PAUSE);
  }
  scheduleNext();
}

/** Stop the ringtone. */
export function stopRingtone() {
  playing = false;
  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
}
