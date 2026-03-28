import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @jitsi/rnnoise-wasm with the real named export
vi.mock('@jitsi/rnnoise-wasm', () => ({
  createRNNWasmModule: vi.fn(),
}));

// Mock AudioContext and related Web Audio APIs
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockClose = vi.fn();
const mockResume = vi.fn().mockResolvedValue(undefined);
const mockCreateMediaStreamSource = vi.fn(() => ({ connect: mockConnect, disconnect: mockDisconnect }));
const mockCreateScriptProcessor = vi.fn(() => ({
  connect: mockConnect,
  disconnect: mockDisconnect,
  onaudioprocess: null,
}));
const mockDestinationStream = new EventTarget() as MediaStream;
const mockCreateMediaStreamDestination = vi.fn(() => ({ stream: mockDestinationStream }));

vi.stubGlobal('AudioContext', vi.fn(function () {
  return {
    state: 'running',
    resume: mockResume,
    createMediaStreamSource: mockCreateMediaStreamSource,
    createScriptProcessor: mockCreateScriptProcessor,
    createMediaStreamDestination: mockCreateMediaStreamDestination,
    close: mockClose,
  };
}));

function makeMockStream(hasAudio = true): MediaStream {
  const track = { kind: 'audio', stop: vi.fn() } as unknown as MediaStreamTrack;
  return {
    getAudioTracks: () => (hasAudio ? [track] : []),
    getTracks: () => (hasAudio ? [track] : []),
  } as unknown as MediaStream;
}

describe('createNoisePipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns raw stream unchanged when input has no audio tracks', async () => {
    const { createNoisePipeline } = await import('./noiseSuppression');
    const rawStream = makeMockStream(false);
    const pipeline = await createNoisePipeline(rawStream);
    expect(pipeline.processedStream).toBe(rawStream);
    pipeline.dispose(); // should not throw
  });

  it('returns raw stream as fallback when WASM fails to load', async () => {
    const mod = await import('@jitsi/rnnoise-wasm');
    (mod.createRNNWasmModule as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('WASM load failed'));

    const { createNoisePipeline } = await import('./noiseSuppression');
    const rawStream = makeMockStream(true);
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const pipeline = await createNoisePipeline(rawStream);
    expect(pipeline.processedStream).toBe(rawStream);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[NC]'), expect.anything());
    pipeline.dispose();
  });

  it('returns a processedStream and a dispose function when WASM loads successfully', async () => {
    const mockHeapF32 = new Float32Array(4096);
    const mockState = 42;
    const mockModule = {
      _rnnoise_create: vi.fn(() => mockState),
      _rnnoise_destroy: vi.fn(),
      _rnnoise_process_frame: vi.fn(),
      _malloc: vi.fn(() => 0),
      _free: vi.fn(),
      HEAPF32: mockHeapF32,
    };
    const mod = await import('@jitsi/rnnoise-wasm');
    (mod.createRNNWasmModule as ReturnType<typeof vi.fn>).mockResolvedValue(mockModule);

    const { createNoisePipeline } = await import('./noiseSuppression');
    const rawStream = makeMockStream(true);

    const pipeline = await createNoisePipeline(rawStream);
    expect(pipeline.processedStream).toBe(mockDestinationStream);
    expect(mockModule._rnnoise_create).toHaveBeenCalledWith(0);

    pipeline.dispose();
    expect(mockModule._rnnoise_destroy).toHaveBeenCalledWith(mockState);
    expect(mockModule._free).toHaveBeenCalledTimes(2); // inPtr and outPtr
    expect(mockClose).toHaveBeenCalled();
  });
});
