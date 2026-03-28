/// <reference types="vite/client" />

declare module '@jitsi/rnnoise-wasm' {
  interface RNNoiseModule {
    _rnnoise_create(modelPtr: number): number;
    _rnnoise_destroy(state: number): void;
    _rnnoise_process_frame(state: number, outPtr: number, inPtr: number): number;
    _malloc(size: number): number;
    _free(ptr: number): void;
    HEAPF32: Float32Array;
  }
  export function createRNNWasmModule(): Promise<RNNoiseModule>;
  export function createRNNWasmModuleSync(): RNNoiseModule;
}
