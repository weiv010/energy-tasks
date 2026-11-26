import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Place } from '../lib/types';
import { hasCoords } from '../lib/geocode';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const GYEONGJU: L.LatLngTuple = [35.8365, 129.2185];

function popupHtml(p: Place) {
  const kakao = `https://map.kakao.com/link/search/${encodeURIComponent(p.address || `경주 ${p.name}`)}`;
  return `<div style="min-width:150px">
    <div style="font-family:Gaegu,cursive;font-size:19px;font-weight:700">${esc(p.emoji)} ${esc(p.name)}</div>
    ${p.description ? `<div style="font-size:13px;margin-top:2px">${esc(p.description)}</div>` : ''}
    ${p.address ? `<div style="font-size:12px;color:#A39588;margin-top:4px">${esc(p.address)}</div>` : ''}
    <a href="${kakao}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:6px;font-size:12px;color:#D97870">카카오맵에서 보기 →</a>
  </div>`;
}

export default function TripMap({
  places,
  activeId,
  onSelect,
  picking,
  onPick,
}: {
  places: Place[];
  activeId: string | null;
  onSelect: (id: string) => void;
  picking: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const lastFit = useRef('');
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { scrollWheelZoom: false, zoomControl: true }).setView(GYEONGJU, 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    let alive = true;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => alive && m.invalidateSize({ pan: false }));
    });
    ro.observe(el.current);
    return () => {
      // 애니메이션 중에 지도가 제거되면 Leaflet 이 _leaflet_pos 오류를 내므로 먼저 멈춘다
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      m.stop();
      // Leaflet 은 확대 애니메이션 종료를 250ms 타이머로 처리하는데(핸들 미보관), 그 전에 제거되면 오류가 난다
      (m as unknown as { _onZoomTransitionEnd: () => void })._onZoomTransitionEnd = () => {};
      m.closePopup();
      m.off();
      m.remove();
      map.current = null;
      layer.current = null;
      markers.current.clear();
    };
  }, []);

  // 마커 그리기
  useEffect(() => {
    const m = map.current;
    const lg = layer.current;
    if (!m || !lg) return;
    lg.clearLayers();
    markers.current.clear();
    const located = places.filter(hasCoords);
    for (const p of located) {
      const icon = L.divIcon({
        className: `trip-marker${p.id === activeId ? ' active' : ''}`,
        html: `<div class="pin"><div class="bubble"><span>${esc(p.emoji)}</span></div><div class="name">${esc(p.name)}</div></div>`,
        iconSize: [0, 0],
        popupAnchor: [0, -46],
      });
      const mk = L.marker([p.lat!, p.lng!], { icon, title: p.name, riseOnHover: true })
        .bindPopup(popupHtml(p))
        .on('click', () => onSelectRef.current(p.id))
        .addTo(lg);
      markers.current.set(p.id, mk);
    }
    // 좌표 구성이 바뀔 때만 화면 맞춤
    const sig = located.map((p) => `${p.id}:${p.lat},${p.lng}`).join('|');
    if (sig !== lastFit.current) {
      lastFit.current = sig;
      if (located.length > 1) m.fitBounds(L.latLngBounds(located.map((p) => [p.lat!, p.lng!])), { padding: [40, 40], maxZoom: 16, animate: false });
      else if (located.length === 1) m.setView([located[0].lat!, located[0].lng!], 16, { animate: false });
    }
  }, [places, activeId]);

  // 선택된 장소로 이동
  useEffect(() => {
    if (!activeId) return;
    const mk = markers.current.get(activeId);
    if (mk && map.current) {
      map.current.setView(mk.getLatLng(), Math.max(map.current.getZoom(), 16), { animate: true });
      mk.openPopup();
    }
  }, [activeId]);

  // 지도에서 위치 찍기
  useEffect(() => {
    const m = map.current;
    if (!m || !picking) return;
    const h = (e: L.LeafletMouseEvent) => onPick(Number(e.latlng.lat.toFixed(7)), Number(e.latlng.lng.toFixed(7)));
    m.on('click', h);
    return () => {
      m.off('click', h);
    };
  }, [picking, onPick]);

  return (
    <div className={`isolate overflow-hidden rounded-[18px] border border-cocoa-line ${picking ? 'picking ring-2 ring-berry' : ''}`}>
      <div ref={el} className="h-[300px] w-full sm:h-[380px]" aria-label="여행 지도" data-testid="trip-map" />
    </div>
  );
}
