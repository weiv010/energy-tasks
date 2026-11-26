import { useEffect, useState } from 'react';
import type { TripActions } from '../lib/useTrip';
import type { Place, TripData } from '../lib/types';
import { geocode, hasCoords, type GeoResult } from '../lib/geocode';
import { uid } from '../lib/seed';
import { EditIcon, Sheet, TrashIcon } from '../components/ui';

const EMOJIS = ['🏨', '🎀', '🌳', '⭐', '☕', '🌙', '🍜', '📸', '🎄', '🛍️', '🚗', '🏯', '🍰', '📍'];

export default function PlaceManager({
  open,
  onClose,
  data,
  actions,
  notify,
  draft,
  setDraft,
  onRequestPick,
}: {
  open: boolean;
  onClose: () => void;
  data: TripData;
  actions: TripActions;
  notify: (m: string, t?: 'info' | 'error') => void;
  draft: Place | null;
  setDraft: (p: Place | null) => void;
  onRequestPick: () => void;
}) {
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [latText, setLatText] = useState<string | null>(null);
  const [lngText, setLngText] = useState<string | null>(null);
  // 다른 장소를 열면 입력 중이던 좌표 텍스트를 초기화
  useEffect(() => {
    setLatText(null);
    setLngText(null);
    setResults(null);
  }, [draft?.id]);
  const isNew = draft ? !data.places.some((p) => p.id === draft.id) : false;

  const startEdit = (p: Place | null) => {
    setResults(null);
    setLatText(null);
    setLngText(null);
    setDraft(
      p ?? {
        id: uid(),
        trip_id: data.trip.id,
        name: '',
        emoji: '📍',
        description: '',
        address: '',
        lat: null,
        lng: null,
        sort_order: Math.max(0, ...data.places.map((x) => x.sort_order)) + 1,
      },
    );
  };

  const set = <K extends keyof Place>(k: K, v: Place[K]) => draft && setDraft({ ...draft, [k]: v });

  const search = async () => {
    if (!draft) return;
    const q = draft.address.trim() || `경주 ${draft.name}`;
    setSearching(true);
    setResults(null);
    try {
      const r = await geocode(q);
      setResults(r);
      if (!r.length) notify('검색 결과가 없어요. 좌표를 직접 입력하거나 지도에서 찍어주세요', 'error');
    } catch (e) {
      notify(`주소 검색 실패: ${(e as Error).message}`, 'error');
    } finally {
      setSearching(false);
    }
  };

  const parseCoord = (s: string | null, fallback: number | null, min: number, max: number) => {
    if (s === null) return { ok: true, v: fallback };
    if (s.trim() === '') return { ok: true, v: null };
    const n = Number(s);
    return Number.isFinite(n) && n >= min && n <= max ? { ok: true, v: n } : { ok: false, v: null };
  };

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) return notify('장소 이름을 입력해주세요', 'error');
    const lat = parseCoord(latText, draft.lat, -90, 90);
    const lng = parseCoord(lngText, draft.lng, -180, 180);
    if (!lat.ok || !lng.ok) return notify('좌표 형식이 올바르지 않아요 (예: 35.8347, 129.2190)', 'error');
    if ((lat.v === null) !== (lng.v === null)) return notify('위도와 경도를 모두 입력하거나 모두 비워주세요', 'error');
    const row: Place = { ...draft, name: draft.name.trim(), lat: lat.v, lng: lng.v };
    if (isNew) actions.insert('places', row);
    else {
      const { id, trip_id: _t, ...patch } = row;
      actions.update('places', id, patch);
    }
    notify(isNew ? '장소를 추가했어요' : '장소를 저장했어요');
    setDraft(null);
  };

  const remove = (p: Place) => {
    const used = data.schedule.filter((s) => s.place_id === p.id).length;
    if (!confirm(`'${p.name}' 장소를 삭제할까요?${used ? `\n연결된 일정 ${used}개의 관련 위치가 비워집니다.` : ''}`)) return;
    actions.remove('places', p.id);
    notify('장소를 삭제했어요');
  };

  const latVal = latText ?? (draft?.lat ?? '').toString();
  const lngVal = lngText ?? (draft?.lng ?? '').toString();

  return (
    <Sheet
      open={open}
      onClose={draft ? () => setDraft(null) : onClose}
      title={draft ? (isNew ? '📍 장소 추가' : '📍 장소 수정') : '📍 장소 관리'}
      footer={
        draft ? (
          <>
            <button className="btn-ghost flex-1" onClick={() => setDraft(null)}>목록으로</button>
            <button className="btn-primary flex-[2]" onClick={save}>저장</button>
          </>
        ) : (
          <button className="btn-primary w-full" onClick={() => startEdit(null)}>＋ 장소 추가</button>
        )
      }
    >
      {!draft ? (
        <ul className="space-y-2">
          {data.places.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-2xl border border-cocoa-line p-2.5">
              <span className="text-2xl">{p.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="font-bold">{p.name}</div>
                <div className="truncate text-xs text-cocoa-soft">
                  {hasCoords(p) ? `${p.lat!.toFixed(5)}, ${p.lng!.toFixed(5)}` : '⚠️ 위치 미입력'}
                  {p.address && ` · ${p.address}`}
                </div>
              </div>
              <button className="icon-btn" onClick={() => startEdit(p)} aria-label={`${p.name} 수정`}><EditIcon /></button>
              <button className="icon-btn hover:!text-berry" onClick={() => remove(p)} aria-label={`${p.name} 삭제`}><TrashIcon /></button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3.5">
          <div>
            <span className="label">아이콘</span>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => set('emoji', e)} className={`h-9 w-9 rounded-xl border text-lg ${draft.emoji === e ? 'border-berry bg-berry-soft' : 'border-cocoa-line'}`}>{e}</button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="label">장소 이름 *</span>
            <input className="field" value={draft.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <label className="block">
            <span className="label">간단한 설명</span>
            <input className="field" value={draft.description} onChange={(e) => set('description', e.target.value)} />
          </label>
          <label className="block">
            <span className="label">주소</span>
            <div className="flex gap-2">
              <input className="field" value={draft.address} onChange={(e) => set('address', e.target.value)} placeholder="예: 경북 경주시 ..." />
              <button className="btn-sage shrink-0 !px-3" onClick={search} disabled={searching}>{searching ? '검색 중' : '좌표 찾기'}</button>
            </div>
          </label>
          {results && results.length > 0 && (
            <div className="rounded-2xl border border-butter bg-butter-soft p-2">
              <p className="px-1 pb-1 text-xs">맞는 위치를 골라주세요 (OpenStreetMap 검색 결과)</p>
              {results.map((r, i) => (
                <button
                  key={i}
                  className="block w-full rounded-xl px-2 py-1.5 text-left text-xs hover:bg-white"
                  onClick={() => { setDraft({ ...draft, lat: r.lat, lng: r.lng }); setLatText(null); setLngText(null); setResults(null); }}
                >
                  📍 {r.label}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <label>
              <span className="label">위도 (lat)</span>
              <input className="field" inputMode="decimal" value={latVal} onChange={(e) => setLatText(e.target.value)} placeholder="35.8347" />
            </label>
            <label>
              <span className="label">경도 (lng)</span>
              <input className="field" inputMode="decimal" value={lngVal} onChange={(e) => setLngText(e.target.value)} placeholder="129.2190" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => { setLatText(null); setLngText(null); onRequestPick(); }}>🗺️ 지도에서 찍기</button>
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => { setDraft({ ...draft, lat: null, lng: null }); setLatText(null); setLngText(null); }}>좌표 지우기</button>
          </div>
          <p className="text-xs text-cocoa-soft">정확한 위치를 모르면 비워두세요. 비워둔 장소는 지도에 표시되지 않아요.</p>
        </div>
      )}
    </Sheet>
  );
}
