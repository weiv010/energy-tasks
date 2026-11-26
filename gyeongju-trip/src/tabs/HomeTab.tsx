import { useCallback, useMemo, useRef, useState } from 'react';
import type { ViewProps } from '../components/TripView';
import type { Place, ScheduleItem } from '../lib/types';
import { formatDayKo, groupByDay, moveSchedule } from '../lib/schedule';
import { hasCoords } from '../lib/geocode';
import { uid } from '../lib/seed';
import { EditIcon, SectionTitle, Snowflake, Star, TrashIcon } from '../components/ui';
import TripMap from './TripMap';
import ScheduleEditor from './ScheduleEditor';
import PlaceManager from './PlaceManager';

export default function HomeTab({ data, actions, readOnly, notify }: ViewProps) {
  const [activePlace, setActivePlace] = useState<string | null>(null);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [placeDraft, setPlaceDraft] = useState<Place | null>(null);
  const [picking, setPicking] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => groupByDay(data.schedule), [data.schedule]);
  const placeById = useMemo(() => new Map(data.places.map((p) => [p.id, p])), [data.places]);
  const unlocated = data.places.filter((p) => !hasCoords(p));
  const doneCount = data.schedule.filter((s) => s.done).length;

  const focusPlace = (id: string) => {
    setActivePlace(null);
    requestAnimationFrame(() => setActivePlace(id));
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openNew = () => {
    const lastDay = days.at(-1)?.items.at(-1);
    setIsNew(true);
    setEditing({
      id: uid(),
      trip_id: data.trip.id,
      day: data.trip.start_date,
      time: lastDay && lastDay.day === data.trip.start_date ? lastDay.time : '12:00',
      time_label: '',
      title: '',
      theme: '',
      details: '',
      place_id: null,
      is_optional: false,
      done: false,
      sort_order: Math.max(0, ...data.schedule.map((s) => s.sort_order)) + 1,
    });
  };

  const move = (id: string, dir: -1 | 1) => {
    const patches = moveSchedule(data.schedule, id, dir);
    patches.forEach((p) => actions.update('schedule_items', p.id, p.patch));
  };

  const remove = (s: ScheduleItem) => {
    if (!confirm(`'${s.title}' 일정을 삭제할까요?`)) return;
    actions.remove('schedule_items', s.id);
    notify('일정을 삭제했어요');
  };

  const onPick = useCallback((lat: number, lng: number) => {
    setPicking(false);
    setPlaceDraft((d) => (d ? { ...d, lat, lng } : d));
    setPlacesOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* A. 지도 */}
      <section ref={mapRef} className="scroll-mt-4">
        <SectionTitle
          deco={<span className="text-xl">🗺️</span>}
          right={
            !readOnly && (
              <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setPlacesOpen(true)}>
                📍 장소 관리
              </button>
            )
          }
        >
          여행 지도
        </SectionTitle>
        <div className="card p-2">
          {picking && (
            <div className="mb-2 flex items-center justify-between rounded-2xl bg-butter-soft px-3 py-2 text-sm">
              <span>📌 지도를 눌러 <b>{placeDraft?.name || '장소'}</b> 위치를 정해주세요</span>
              <button className="text-xs underline" onClick={() => { setPicking(false); setPlacesOpen(true); }}>취소</button>
            </div>
          )}
          <TripMap places={data.places} activeId={activePlace} onSelect={setActivePlace} picking={picking} onPick={onPick} />
          <div className="flex flex-wrap gap-1.5 px-1 pb-1 pt-2.5">
            {data.places.map((p) => {
              const ok = hasCoords(p);
              return (
                <button
                  key={p.id}
                  onClick={() => (ok ? focusPlace(p.id) : !readOnly && (setPlaceDraft(p), setPlacesOpen(true)))}
                  className={`chip ${ok ? (activePlace === p.id ? 'border-cocoa bg-butter text-cocoa' : 'border-cocoa-line bg-white') : 'border-dashed border-cocoa-line bg-cream text-cocoa-soft'}`}
                  title={ok ? `${p.name} 위치 보기` : '위치 미입력'}
                >
                  <span>{p.emoji}</span>
                  {p.name}
                  {!ok && <span className="text-[10px]">· 위치 미입력</span>}
                </button>
              );
            })}
          </div>
          {unlocated.length > 0 && !readOnly && (
            <p className="px-1 pb-1 text-xs text-cocoa-soft">
              ✏️ 확인된 좌표가 없는 장소는 지도에 표시되지 않아요. 장소를 눌러 주소 검색이나 좌표 입력, 지도 클릭으로 위치를 정할 수 있어요.
            </p>
          )}
        </div>
      </section>

      {/* B. 로드맵 */}
      <section>
        <SectionTitle
          deco={<Star className="text-butter" size={18} />}
          right={<span className="text-xs text-cocoa-soft">완료 {doneCount}/{data.schedule.length}</span>}
        >
          여행 로드맵
        </SectionTitle>

        {days.length === 0 && <div className="card p-8 text-center text-sm text-cocoa-soft">아직 일정이 없어요</div>}

        <div className="space-y-6">
          {days.map(({ day, items }, di) => (
            <div key={day}>
              <div className="mb-3 flex items-center gap-2">
                <span className="hand rounded-full bg-berry px-3 py-0.5 text-lg font-bold text-white">DAY {di + 1}</span>
                <span className="hand text-xl font-bold">{formatDayKo(day)}</span>
                <Snowflake className="text-sage" size={14} />
              </div>
              <ol className="relative ml-[30px] border-l-2 border-dashed border-cocoa-line pl-0">
                {items.map((s, i) => {
                  const place = s.place_id ? placeById.get(s.place_id) : undefined;
                  const details = s.details.split('\n').map((d) => d.trim()).filter(Boolean);
                  return (
                    <li key={s.id} className="relative mb-3 pl-6 last:mb-0" data-testid="schedule-item">
                      <span className={`absolute -left-[13px] top-4 grid h-6 w-6 place-items-center rounded-full border-2 text-[11px] ${s.done ? 'border-sage bg-sage text-white' : s.is_optional ? 'border-butter bg-butter-soft' : 'border-berry bg-white'}`}>
                        {s.done ? '✓' : place?.emoji ?? '•'}
                      </span>
                      <article className={`card p-3.5 transition ${s.done ? 'bg-white/70' : ''} ${s.is_optional ? 'border-dashed border-butter' : ''}`}>
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="hand text-lg font-bold leading-none text-berry">{s.time_label || s.time}</span>
                              {s.time_label && <span className="text-[11px] text-cocoa-soft">({s.time})</span>}
                              {s.is_optional && <span className="chip border-butter bg-butter-soft !py-0 text-[11px]">선택 일정</span>}
                            </div>
                            <h3 className={`mt-1 text-[17px] font-bold leading-snug ${s.done ? 'text-cocoa-soft line-through' : ''}`}>{s.title}</h3>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {s.theme && <span className="chip border-sage/50 bg-sage-soft text-sage-dark">✦ {s.theme}</span>}
                              {place && (
                                <button
                                  className="chip border-berry/40 bg-berry-soft/60 text-berry-dark"
                                  onClick={() => (hasCoords(place) ? focusPlace(place.id) : notify(`${place.name}: 아직 위치가 입력되지 않았어요`))}
                                >
                                  📍 {place.name}
                                </button>
                              )}
                            </div>
                          </div>
                          <label className="flex flex-col items-center gap-0.5 pt-0.5 text-[10px] text-cocoa-soft">
                            <input
                              type="checkbox"
                              className="check"
                              checked={s.done}
                              disabled={readOnly}
                              onChange={(e) => actions.update('schedule_items', s.id, { done: e.target.checked })}
                              aria-label={`${s.title} 완료`}
                            />
                            완료
                          </label>
                        </div>
                        {details.length > 0 && (
                          <ul className={`mt-2.5 space-y-0.5 border-t border-dashed border-cocoa-line pt-2 text-sm ${s.done ? 'text-cocoa-soft' : ''}`}>
                            {details.map((d, k) => (
                              <li key={k} className="flex gap-1.5">
                                <span className="text-berry">·</span>
                                {d}
                              </li>
                            ))}
                          </ul>
                        )}
                        {!readOnly && (
                          <div className="mt-2 flex justify-end gap-0.5 border-t border-cocoa-line/60 pt-1.5">
                            <button className="icon-btn" onClick={() => move(s.id, -1)} disabled={i === 0} aria-label="위로 이동">↑</button>
                            <button className="icon-btn" onClick={() => move(s.id, 1)} disabled={i === items.length - 1} aria-label="아래로 이동">↓</button>
                            <button className="icon-btn" onClick={() => { setIsNew(false); setEditing(s); }} aria-label="일정 수정"><EditIcon /></button>
                            <button className="icon-btn hover:!text-berry" onClick={() => remove(s)} aria-label="일정 삭제"><TrashIcon /></button>
                          </div>
                        )}
                      </article>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>

        {!readOnly && (
          <button className="btn-primary mt-5 w-full !py-3" onClick={openNew}>
            ＋ 일정 추가
          </button>
        )}
      </section>

      {editing && (
        <ScheduleEditor
          item={editing}
          isNew={isNew}
          trip={data.trip}
          places={data.places}
          onClose={() => setEditing(null)}
          onSave={(item) => {
            if (isNew) actions.insert('schedule_items', item);
            else {
              const { id, trip_id: _t, ...patch } = item;
              actions.update('schedule_items', id, patch);
            }
            notify(isNew ? '일정을 추가했어요 ✨' : '일정을 수정했어요');
            setEditing(null);
          }}
        />
      )}

      {!readOnly && (
        <PlaceManager
          open={placesOpen}
          onClose={() => { setPlacesOpen(false); setPlaceDraft(null); }}
          data={data}
          actions={actions}
          notify={notify}
          draft={placeDraft}
          setDraft={setPlaceDraft}
          onRequestPick={() => { setPlacesOpen(false); setPicking(true); mapRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
        />
      )}
    </div>
  );
}
