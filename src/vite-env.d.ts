/// <reference types="vite/client" />

declare module '@jitsi/rnnoise-wasm' {
  interface RNNoiseModule {
    newState(): number;
    deleteState(state: number): void;
    processFrame(state: number, input: Float32Array, output: Float32Array): number;
  }
  export default function createRNNoise(): Promise<RNNoiseModule>;
}
