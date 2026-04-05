// src/lib/gameLoader.ts
import React from 'react';
import ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';

const CACHE_NAME = 'aero-games-v1';
const BUCKET_VERSION = 'v1';

function getBundleUrl(gameId: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/storage/v1/object/public/game-bundles/${BUCKET_VERSION}/${gameId}.mjs`;
}

function getCacheKey(gameId: string): string {
  return `https://aero-game.local/${gameId}`;
}

/** Ensure React globals are set so externalized game bundles can resolve imports. */
function ensureGlobals() {
  const w = window as any;
  if (!w.__aero_react) {
    w.__aero_react = React;
    w.__aero_react_dom = ReactDOM;
    w.__aero_jsx_runtime = jsxRuntime;
  }
}

/**
 * Download a game bundle from Supabase Storage and cache it.
 * Reports real download progress via onProgress(0–100).
 */
export async function downloadGame(
  gameId: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const url = getBundleUrl(gameId);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${gameId}: ${response.status}`);

  const contentLength = Number(response.headers.get('content-length') || 0);
  const reader = response.body?.getReader();

  if (!reader || !contentLength) {
    // Fallback: no streaming progress, just cache the whole response
    const cache = await caches.open(CACHE_NAME);
    await cache.put(getCacheKey(gameId), response);
    onProgress?.(100);
    return;
  }

  // Stream the response to track progress
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress?.(Math.min(100, Math.round((received / contentLength) * 100)));
  }

  // Reconstruct the response and cache it
  const blob = new Blob(chunks, { type: 'application/javascript' });
  const cachedResponse = new Response(blob, {
    status: 200,
    headers: { 'Content-Type': 'application/javascript' },
  });
  const cache = await caches.open(CACHE_NAME);
  await cache.put(getCacheKey(gameId), cachedResponse);
  onProgress?.(100);
}

/**
 * Load a game component from cache (or network fallback).
 * Returns the default-exported React component.
 */
export async function loadGame(gameId: string): Promise<React.ComponentType> {
  ensureGlobals();

  const cache = await caches.open(CACHE_NAME);
  let response = await cache.match(getCacheKey(gameId));

  if (!response) {
    // Cache miss — fetch, cache, then load
    const url = getBundleUrl(gameId);
    const fetched = await fetch(url);
    if (!fetched.ok) throw new Error(`Failed to fetch ${gameId}: ${fetched.status}`);
    await cache.put(getCacheKey(gameId), fetched.clone());
    response = fetched;
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  try {
    const mod = await import(/* @vite-ignore */ blobUrl);
    return mod.default as React.ComponentType;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Remove a cached game bundle.
 */
export async function removeGame(gameId: string): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(getCacheKey(gameId));
}

/**
 * Check whether a game bundle is in the local cache.
 */
export async function isGameCached(gameId: string): Promise<boolean> {
  const cache = await caches.open(CACHE_NAME);
  const match = await cache.match(getCacheKey(gameId));
  return match !== undefined;
}
