import { X, Mic, Volume2, Headphones, Waves, Gamepad2, MessageSquare } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAudioStore } from '../../store/audioStore';
import { useStatusStore } from '../../store/statusStore';
import { useCallStore } from '../../store/callStore';
import { getLiveMicLevel } from '../../lib/noiseSuppression';

interface Props { onClose: () => void; }

interface DeviceEntry { deviceId: string; label: string; }

const panelStyle: React.CSSProperties = {
  zIndex: 50,
  width: '18rem',
  borderRadius: 20,
  border: '1px solid var(--popup-border)',
  background: 'var(--popup-bg)',
  boxShadow: 'var(--popup-shadow)',
  backdropFilter: 'blur(28px)',
  padding: '1rem',
};

export function GeneralPanel({ onClose }: Props) {
  const { inputDeviceId, outputDeviceId, noiseCancellation, inputVolume, outputVolume, inputSensitivity, chatPosition, set } = useAudioStore();
  const { showGameActivity, setShowGameActivity } = useStatusStore();
  const [inputs,  setInputs]  = useState<DeviceEntry[]>([]);
  const [outputs, setOutputs] = useState<DeviceEntry[]>([]);
  const [permitted, setPermitted] = useState(true);

  useEffect(() => {
    async function enumerate() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
      } catch {
        setPermitted(false);
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const ins  = devices.filter(d => d.kind === 'audioinput');
        const outs = devices.filter(d => d.kind === 'audiooutput');
        setInputs(ins.map((d, i)  => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` })));
        setOutputs(outs.map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Speaker ${i + 1}` })));
      } catch {}
    }
    enumerate();
  }, []);

  const selectStyle: React.CSSProperties = {
    background: 'var(--popup-select-bg)',
    border: '1px solid var(--popup-select-border)',
    borderRadius: 8,
    color: 'var(--popup-select-text)',
    fontSize: 12,
    padding: '6px 10px',
    width: '100%',
    outline: 'none',
    cursor: 'pointer',
  };

  return (
    <div style={panelStyle} className="animate-fade-in">

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Headphones className="h-4 w-4" style={{ color: 'var(--popup-icon)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--popup-text)' }}>Voice & Audio</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 transition-colors"
          style={{ color: 'var(--popup-text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--popup-text)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--popup-text-muted)'; }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!permitted && (
        <p className="mb-3 rounded-aero px-3 py-2 text-[11px]"
          style={{ color: 'var(--popup-text-secondary)', background: 'rgba(220,160,0,0.12)', border: '1px solid rgba(220,160,0,0.25)' }}>
          Microphone access denied. Grant permission to see your devices.
        </p>
      )}

      <div className="flex flex-col gap-4">

        {/* Input device */}
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <Mic className="h-3.5 w-3.5" style={{ color: 'var(--popup-text-muted)' }} />
            <p className="text-xs font-semibold" style={{ color: 'var(--popup-text-label)' }}>Microphone</p>
          </div>
          <select style={selectStyle} value={inputDeviceId} onChange={e => set({ inputDeviceId: e.target.value })}>
            <option value="">Default</option>
            {inputs.filter(d => d.deviceId && d.deviceId !== 'default').map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Input volume */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold" style={{ color: 'var(--popup-text-label)' }}>Input Volume</p>
            <span className="text-[11px]" style={{ color: 'var(--popup-text-muted)' }}>{inputVolume}%</span>
          </div>
          <input
            type="range" min={0} max={100}
            value={inputVolume}
            // Write goes through callStore so active calls hear the change immediately
            onChange={e => useCallStore.getState().setInputGain(Number(e.target.value))}
            className="aero-slider w-full"
          />
        </div>

        {/* Noise cancellation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waves className="h-3.5 w-3.5" style={{ color: 'var(--popup-text-muted)' }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--popup-text)' }}>Noise Cancellation</p>
              <p className="text-[10px]" style={{ color: 'var(--popup-text-muted)' }}>Suppress background noise</p>
            </div>
          </div>
          <button
            // Write goes through callStore so mid-call toggle also swaps the WebRTC audio track
            onClick={() => useCallStore.getState().setNoiseCancellation(!noiseCancellation)}
            className="relative flex-shrink-0 h-5 w-9 rounded-full transition-colors duration-200"
            style={{ background: noiseCancellation ? '#00d4ff' : 'var(--btn-ghost-border)' }}
          >
            <span
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200"
              style={{ left: noiseCancellation ? '18px' : '2px' }}
            />
          </button>
        </div>

        {/* Input sensitivity */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold" style={{ color: 'var(--popup-text-label)' }}>Input Sensitivity</p>
            <span className="text-[10px]" style={{ color: 'var(--popup-text-muted)' }}>
              {inputSensitivity === 0 ? 'Off' : `${inputSensitivity}%`}
            </span>
          </div>
          <SensitivityMeter sensitivity={inputSensitivity} />
          <input
            type="range" min={0} max={100}
            value={inputSensitivity}
            onChange={e => set({ inputSensitivity: Number(e.target.value) })}
            className="aero-slider w-full mt-1.5"
          />
          <p className="text-[10px] mt-1" style={{ color: 'var(--popup-text-muted)' }}>
            Adjust so background noise stays below the threshold line
          </p>
        </div>

        <div className="h-px" style={{ background: 'var(--popup-divider)' }} />

        {/* Output device */}
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <Volume2 className="h-3.5 w-3.5" style={{ color: 'var(--popup-text-muted)' }} />
            <p className="text-xs font-semibold" style={{ color: 'var(--popup-text-label)' }}>Output Device</p>
          </div>
          {outputs.length === 0 ? (
            <p className="text-[11px] italic" style={{ color: 'var(--popup-text-muted)' }}>
              Output selection requires browser support (Chrome/Edge).
            </p>
          ) : (
            <select style={selectStyle} value={outputDeviceId} onChange={e => set({ outputDeviceId: e.target.value })}>
              <option value="">Default</option>
              {outputs.filter(d => d.deviceId && d.deviceId !== 'default').map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* Output volume */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold" style={{ color: 'var(--popup-text-label)' }}>Output Volume</p>
            <span className="text-[11px]" style={{ color: 'var(--popup-text-muted)' }}>{outputVolume}%</span>
          </div>
          <input
            type="range" min={0} max={100}
            value={outputVolume}
            onChange={e => set({ outputVolume: Number(e.target.value) })}
            className="aero-slider w-full"
          />
        </div>

        <div className="h-px" style={{ background: 'var(--popup-divider)' }} />

        {/* Chat position during calls */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5" style={{ color: 'var(--popup-text-muted)' }} />
            <p className="text-xs font-semibold" style={{ color: 'var(--popup-text-label)' }}>In-call Chat Position</p>
          </div>
          <div className="flex gap-2">
            {(['right', 'bottom'] as const).map(pos => (
              <button
                key={pos}
                onClick={() => set({ chatPosition: pos })}
                className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
                style={{
                  background: chatPosition === pos ? 'rgba(0,212,255,0.12)' : 'var(--popup-select-bg)',
                  border: chatPosition === pos ? '1px solid rgba(0,212,255,0.35)' : '1px solid var(--popup-select-border)',
                  color: chatPosition === pos ? '#00d4ff' : 'var(--popup-select-text)',
                }}
              >
                {pos === 'right' ? 'Right' : 'Bottom'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px" style={{ background: 'var(--popup-divider)' }} />

        {/* Privacy section */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Gamepad2 className="h-3.5 w-3.5" style={{ color: 'var(--popup-text-muted)' }} />
            <p className="text-xs font-semibold" style={{ color: 'var(--popup-text-label)' }}>Privacy</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--popup-text)' }}>Show game activity</p>
              <p className="text-[10px]" style={{ color: 'var(--popup-text-muted)' }}>Let friends see what game you're playing</p>
            </div>
            <button
              aria-label={showGameActivity ? 'Disable show game activity' : 'Enable show game activity'}
              onClick={() => setShowGameActivity(!showGameActivity)}
              className="relative flex-shrink-0 h-5 w-9 rounded-full transition-colors duration-200"
              style={{ background: showGameActivity ? '#00d4ff' : 'var(--btn-ghost-border)' }}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200"
                style={{ left: showGameActivity ? '18px' : '2px' }}
              />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Input sensitivity meter ─────────────────────────────────────────────── */
// Shows a real-time bar of mic input level with a threshold line overlay.
// Grabs mic stream when no active pipeline exists (e.g. not in a call),
// or reads from the active pipeline's analyser when in a call/recording.

function SensitivityMeter({ sensitivity }: { sensitivity: number }) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const inputDeviceId = useAudioStore(s => s.inputDeviceId);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        // Use the same audio constraints as calls/recordings so the meter
        // shows levels that match what the noise gate actually sees.
        // AGC boosts quiet signals — without it, the meter would show lower
        // noise levels than the gate gets, making the threshold useless.
        const constraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
          ...(inputDeviceId ? { deviceId: { exact: inputDeviceId } } : {}),
        };
        const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const ctx = new AudioContext();
        ctxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        analyserRef.current = analyser;
        ctx.createMediaStreamSource(stream).connect(analyser);

        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (cancelled) return;
          // Prefer active pipeline level if available (shows post-processing level)
          const pipelineLevel = getLiveMicLevel();
          if (pipelineLevel > 0) {
            setLevel(pipelineLevel);
          } else {
            analyser.getByteFrequencyData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i];
            setLevel(sum / buf.length / 255);
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // No mic access — fall back to pipeline level polling
        const tick = () => {
          if (cancelled) return;
          setLevel(getLiveMicLevel());
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      }
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [inputDeviceId]);

  // Map sensitivity to the same threshold used by the noise gate
  const thresholdNorm = 0.002 + (0.08 - 0.002) * ((sensitivity / 100) ** 2);
  // Scale for display: threshold and level are both 0–~0.1 range, map to 0–100%
  const displayScale = 0.12; // max expected level for display purposes
  const levelPct = Math.min(100, (level / displayScale) * 100);
  const thresholdPct = sensitivity === 0 ? 0 : Math.min(100, (thresholdNorm / displayScale) * 100);

  const isAbove = level > thresholdNorm;

  return (
    <div style={{
      position: 'relative',
      height: 18,
      borderRadius: 6,
      background: 'var(--popup-select-bg)',
      border: '1px solid var(--popup-select-border)',
      overflow: 'hidden',
    }}>
      {/* Level bar */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, bottom: 0,
        width: `${levelPct}%`,
        background: isAbove
          ? 'linear-gradient(90deg, rgba(0,212,255,0.35), rgba(0,212,255,0.55))'
          : 'linear-gradient(90deg, rgba(255,160,0,0.25), rgba(255,160,0,0.40))',
        borderRadius: 5,
        transition: 'width 0.06s linear',
      }} />
      {/* Threshold line */}
      {sensitivity > 0 && (
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0,
          left: `${thresholdPct}%`,
          width: 2,
          background: isAbove ? 'rgba(0,212,255,0.8)' : 'rgba(255,100,50,0.7)',
          borderRadius: 1,
          boxShadow: isAbove ? '0 0 4px rgba(0,212,255,0.5)' : '0 0 4px rgba(255,100,50,0.4)',
          transition: 'left 0.15s ease, background 0.2s ease',
        }} />
      )}
    </div>
  );
}
