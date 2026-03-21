import { X, Mic, Volume2, Headphones, Waves } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAudioStore } from '../../store/audioStore';

interface Props { onClose: () => void; }

interface DeviceEntry { deviceId: string; label: string; }

export function GeneralPanel({ onClose }: Props) {
  const { inputDeviceId, outputDeviceId, noiseCancellation, inputVolume, outputVolume, set } = useAudioStore();
  const [inputs,  setInputs]  = useState<DeviceEntry[]>([]);
  const [outputs, setOutputs] = useState<DeviceEntry[]>([]);
  const [permitted, setPermitted] = useState(true);

  useEffect(() => {
    async function enumerate() {
      try {
        // Request permission so labels are populated
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

  const selectStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    padding: '6px 10px',
    width: '100%',
    outline: 'none',
    cursor: 'pointer',
  } as React.CSSProperties;

  return (
    <div className="absolute bottom-16 left-2 z-50 w-72 rounded-aero-lg border border-white/20 bg-aero-deep/90 p-4 shadow-xl backdrop-blur-xl animate-fade-in">

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Headphones className="h-4 w-4" style={{ color: '#00d4ff' }} />
          <span className="text-sm font-semibold text-white">Voice & Audio</span>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!permitted && (
        <p className="mb-3 rounded-aero px-3 py-2 text-[11px] text-white/60"
          style={{ background: 'rgba(220,160,0,0.12)', border: '1px solid rgba(220,160,0,0.25)' }}>
          Microphone access denied. Grant permission to see your devices.
        </p>
      )}

      <div className="flex flex-col gap-4">

        {/* Input device */}
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <Mic className="h-3.5 w-3.5 text-white/50" />
            <p className="text-xs font-semibold text-white/70">Microphone</p>
          </div>
          <select
            style={selectStyle}
            value={inputDeviceId}
            onChange={e => set({ inputDeviceId: e.target.value })}
          >
            <option value="">Default</option>
            {inputs.filter(d => d.deviceId && d.deviceId !== 'default').map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Input volume */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-white/70">Input Volume</p>
            <span className="text-[11px] text-white/40">{inputVolume}%</span>
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
            <Waves className="h-3.5 w-3.5 text-white/50" />
            <div>
              <p className="text-xs font-semibold text-white/80">Noise Cancellation</p>
              <p className="text-[10px] text-white/40">Suppress background noise</p>
            </div>
          </div>
          <button
            onClick={() => set({ noiseCancellation: !noiseCancellation })}
            className="relative flex-shrink-0 h-5 w-9 rounded-full transition-colors duration-200"
            style={{ background: noiseCancellation ? '#00d4ff' : 'rgba(255,255,255,0.15)' }}
          >
            <span
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200"
              style={{ left: noiseCancellation ? '18px' : '2px' }}
            />
          </button>
        </div>

        <div className="h-px bg-white/10" />

        {/* Output device */}
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <Volume2 className="h-3.5 w-3.5 text-white/50" />
            <p className="text-xs font-semibold text-white/70">Output Device</p>
          </div>
          {outputs.length === 0 ? (
            <p className="text-[11px] text-white/35 italic">
              Output selection requires browser support (Chrome/Edge).
            </p>
          ) : (
            <select
              style={selectStyle}
              value={outputDeviceId}
              onChange={e => set({ outputDeviceId: e.target.value })}
            >
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
            <p className="text-xs font-semibold text-white/70">Output Volume</p>
            <span className="text-[11px] text-white/40">{outputVolume}%</span>
          </div>
          <input
            type="range" min={0} max={100}
            value={outputVolume}
            onChange={e => set({ outputVolume: Number(e.target.value) })}
            className="aero-slider w-full"
          />
        </div>

      </div>
    </div>
  );
}
