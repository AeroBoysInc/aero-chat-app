// src/lib/tenor.ts
const BASE = 'https://tenor.googleapis.com/v2';
const KEY = import.meta.env.VITE_TENOR_API_KEY ?? '';
const CLIENT_KEY = 'aero-chat';

export interface TenorGif {
  id: string;
  url: string;       // full animated GIF
  previewUrl: string; // tinygif static/small
  width: number;
  height: number;
}

interface TenorMediaFormat {
  url: string;
  dims: [number, number];
  size: number;
}

interface TenorResult {
  id: string;
  media_formats: Record<string, TenorMediaFormat>;
}

interface TenorResponse {
  results: TenorResult[];
  next: string;
}

function mapResults(results: TenorResult[]): TenorGif[] {
  return results
    .filter(r => r.media_formats?.gif && r.media_formats?.tinygif)
    .map(r => ({
      id: r.id,
      url: r.media_formats.gif.url,
      previewUrl: r.media_formats.tinygif.url,
      width: r.media_formats.gif.dims[0],
      height: r.media_formats.gif.dims[1],
    }));
}

export async function fetchTrending(limit = 20): Promise<TenorGif[]> {
  if (!KEY) return [];
  const params = new URLSearchParams({
    key: KEY, client_key: CLIENT_KEY,
    limit: String(limit),
    media_filter: 'gif,tinygif',
  });
  const res = await fetch(`${BASE}/featured?${params}`);
  if (!res.ok) throw new Error(`Tenor API error: ${res.status}`);
  const data: TenorResponse = await res.json();
  return mapResults(data.results);
}

export async function searchGifs(query: string, limit = 20): Promise<TenorGif[]> {
  if (!KEY || !query.trim()) return [];
  const params = new URLSearchParams({
    key: KEY, client_key: CLIENT_KEY, q: query.trim(),
    limit: String(limit),
    media_filter: 'gif,tinygif',
  });
  const res = await fetch(`${BASE}/search?${params}`);
  if (!res.ok) throw new Error(`Tenor API error: ${res.status}`);
  const data: TenorResponse = await res.json();
  return mapResults(data.results);
}
