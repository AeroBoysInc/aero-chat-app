/// <reference types="vite/client" />

declare module '@jitsi/rnnoise-wasm' {
  interface RNNoiseModule {
    _rnnoise_create(modelPtr: number): number;
    _rnnoise_destroy(state: number): void;
    _rnnoise_process_frame(state: number, outPtr: number, inPtr: number): number;
    _malloc(size: number): number;
    _free(ptr: number): void;
    HEAPF32: Float32Array;
    ready: Promise<RNNoiseModule>;
  }
  export function createRNNWasmModule(): Promise<RNNoiseModule>;
  // Sync variant has WASM inlined as base64 — no network fetch, works in production builds
  export function createRNNWasmModuleSync(): RNNoiseModule;
}
