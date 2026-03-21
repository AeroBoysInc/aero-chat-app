import { create } from 'zustand';

const KEY = 'aero_audio_settings';

export interface AudioSettings {
  inputDeviceId:  string;   // '' = default
  outputDeviceId: string;   // '' = default
  noiseCancellation: boolean;
  inputVolume:  number;     // 0–100
  outputVolume: number;     // 0–100
}

interface AudioStore extends AudioSettings {
  set: (patch: Partial<AudioSettings>) => void;
}

function load(): AudioSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
  } catch { return defaults(); }
}

function defaults(): AudioSettings {
  return { inputDeviceId: '', outputDeviceId: '', noiseCancellation: true, inputVolume: 80, outputVolume: 100 };
}

function save(s: AudioSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export const useAudioStore = create<AudioStore>()((set) => ({
  ...load(),
  set: (patch) => set(s => { const next = { ...s, ...patch }; save(next); return next; }),
}));
