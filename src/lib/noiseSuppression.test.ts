import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @jitsi/rnnoise-wasm before importing noiseSuppression
vi.mock('@jitsi/rnnoise-wasm', () => ({
  default: vi.fn(),
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
    // Reset module-level WASM cache between tests
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
    const rnnoiseModule = await import('@jitsi/rnnoise-wasm');
    (rnnoiseModule.default as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('WASM load failed'));

    const { createNoisePipeline } = await import('./noiseSuppression');
    const rawStream = makeMockStream(true);
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const pipeline = await createNoisePipeline(rawStream);
    expect(pipeline.processedStream).toBe(rawStream);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[NC]'), expect.anything());
    pipeline.dispose();
  });

  it('returns a processedStream and a dispose function when WASM loads successfully', async () => {
    const mockState = 42;
    const mockRNNoiseModule = {
      newState: vi.fn(() => mockState),
      deleteState: vi.fn(),
      processFrame: vi.fn(),
    };
    const rnnoiseModule = await import('@jitsi/rnnoise-wasm');
    (rnnoiseModule.default as ReturnType<typeof vi.fn>).mockResolvedValue(mockRNNoiseModule);

    const { createNoisePipeline } = await import('./noiseSuppression');
    const rawStream = makeMockStream(true);

    const pipeline = await createNoisePipeline(rawStream);
    expect(pipeline.processedStream).toBe(mockDestinationStream);
    expect(mockRNNoiseModule.newState).toHaveBeenCalled();

    pipeline.dispose();
    expect(mockRNNoiseModule.deleteState).toHaveBeenCalledWith(mockState);
    expect(mockClose).toHaveBeenCalled();
  });
});
