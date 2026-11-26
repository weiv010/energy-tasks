export interface GeoResult {
  lat: number;
  lng: number;
  label: string;
}

/** OpenStreetMap Nominatim 주소 검색 (관리자가 결과를 직접 골라야 좌표가 저장됨) */
export async function geocode(query: string): Promise<GeoResult[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'kr');
  url.searchParams.set('accept-language', 'ko');
  url.searchParams.set('q', query);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`검색 실패 (${res.status})`);
  const json = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return json.map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name }));
}

export const hasCoords = (p: { lat: number | null; lng: number | null }) =>
  typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng);
