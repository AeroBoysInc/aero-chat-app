// src/lib/giphy.ts
const BASE = 'https://api.giphy.com/v1/gifs';
const KEY = import.meta.env.VITE_GIPHY_API_KEY ?? '';

export interface GiphyGif {
  id: string;
  url: string;       // full animated GIF
  previewUrl: string; // fixed-width still (small preview)
  width: number;
  height: number;
}

interface GiphyImage {
  url: string;
  width: string;
  height: string;
}

interface GiphyResult {
  id: string;
  images: {
    original: GiphyImage;
    fixed_width_small: GiphyImage;
    fixed_width_small_still: GiphyImage;
  };
}

interface GiphyResponse {
  data: GiphyResult[];
}

function mapResults(results: GiphyResult[]): GiphyGif[] {
  return results
    .filter(r => r.images?.original?.url && r.images?.fixed_width_small?.url)
    .map(r => ({
      id: r.id,
      url: r.images.original.url,
      previewUrl: r.images.fixed_width_small.url,
      width: parseInt(r.images.original.width, 10) || 320,
      height: parseInt(r.images.original.height, 10) || 240,
    }));
}

export async function fetchTrending(limit = 20): Promise<GiphyGif[]> {
  if (!KEY) return [];
  const params = new URLSearchParams({
    api_key: KEY,
    limit: String(limit),
    rating: 'g',
  });
  const res = await fetch(`${BASE}/trending?${params}`);
  if (!res.ok) throw new Error(`GIPHY API error: ${res.status}`);
  const data: GiphyResponse = await res.json();
  return mapResults(data.data);
}

export async function searchGifs(query: string, limit = 20): Promise<GiphyGif[]> {
  if (!KEY || !query.trim()) return [];
  const params = new URLSearchParams({
    api_key: KEY, q: query.trim(),
    limit: String(limit),
    rating: 'g',
  });
  const res = await fetch(`${BASE}/search?${params}`);
  if (!res.ok) throw new Error(`GIPHY API error: ${res.status}`);
  const data: GiphyResponse = await res.json();
  return mapResults(data.data);
}
