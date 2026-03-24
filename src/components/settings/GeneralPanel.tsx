import { X, Mic, Volume2, Headphones, Waves, Gamepad2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAudioStore } from '../../store/audioStore';
import { useStatusStore } from '../../store/statusStore';

interface Props { onClose: () => void; }

interface DeviceEntry { deviceId: string; label: string; }

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '4rem',
  left: '0.5rem',
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
  const { inputDeviceId, outputDeviceId, noiseCancellation, inputVolume, outputVolume, set } = useAudioStore();
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
            onChange={e => set({ inputVolume: Number(e.target.value) })}
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
            onClick={() => set({ noiseCancellation: !noiseCancellation })}
            className="relative flex-shrink-0 h-5 w-9 rounded-full transition-colors duration-200"
            style={{ background: noiseCancellation ? '#00d4ff' : 'var(--btn-ghost-border)' }}
          >
            <span
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200"
              style={{ left: noiseCancellation ? '18px' : '2px' }}
            />
          </button>
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
