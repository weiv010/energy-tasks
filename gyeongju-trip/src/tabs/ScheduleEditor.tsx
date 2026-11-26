import { useState } from 'react';
import type { Place, ScheduleItem, Trip } from '../lib/types';
import { daysBetween, formatDayKo } from '../lib/schedule';
import { Sheet } from '../components/ui';

export default function ScheduleEditor({
  item,
  isNew,
  trip,
  places,
  onClose,
  onSave,
}: {
  item: ScheduleItem;
  isNew: boolean;
  trip: Trip;
  places: Place[];
  onClose: () => void;
  onSave: (item: ScheduleItem) => void;
}) {
  const [d, setD] = useState(item);
  const [err, setErr] = useState('');
  const set = <K extends keyof ScheduleItem>(k: K, v: ScheduleItem[K]) => setD((x) => ({ ...x, [k]: v }));
  const days = Array.from(new Set([...daysBetween(trip.start_date, trip.end_date), d.day])).sort();

  const submit = () => {
    if (!d.title.trim()) return setErr('일정 제목을 입력해주세요');
    if (!/^\d{2}:\d{2}$/.test(d.time)) return setErr('시간을 입력해주세요');
    onSave({ ...d, title: d.title.trim(), theme: d.theme.trim(), time_label: d.time_label.trim(), details: d.details.trim() });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? '🎁 일정 추가' : '✏️ 일정 수정'}
      footer={
        <>
          <button className="btn-ghost flex-1" onClick={onClose}>취소</button>
          <button className="btn-primary flex-[2]" onClick={submit}>저장</button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-2.5">
          <label>
            <span className="label">날짜</span>
            <select className="field" value={d.day} onChange={(e) => set('day', e.target.value)}>
              {days.map((x) => <option key={x} value={x}>{formatDayKo(x)}</option>)}
            </select>
          </label>
          <label>
            <span className="label">시간 (정렬 기준)</span>
            <input type="time" className="field" value={d.time} onChange={(e) => set('time', e.target.value)} required />
          </label>
        </div>
        <label className="block">
          <span className="label">시간 표시 문구 (선택) — 예: 오전, 저녁 식사 후</span>
          <input className="field" value={d.time_label} onChange={(e) => set('time_label', e.target.value)} placeholder="비워두면 시간이 표시돼요" />
        </label>
        <label className="block">
          <span className="label">일정 제목 *</span>
          <input className="field" value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="예: 첨성대" autoFocus={isNew} />
        </label>
        <label className="block">
          <span className="label">장소 또는 테마</span>
          <input className="field" value={d.theme} onChange={(e) => set('theme', e.target.value)} placeholder="예: 한복 사진" />
        </label>
        <label className="block">
          <span className="label">관련 위치 (지도 장소)</span>
          <select className="field" value={d.place_id ?? ''} onChange={(e) => set('place_id', e.target.value || null)}>
            <option value="">없음</option>
            {places.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">상세 설명 (한 줄에 하나씩)</span>
          <textarea className="field min-h-[96px]" value={d.details} onChange={(e) => set('details', e.target.value)} placeholder={'한복 입고 산책\n휴대폰 사진 촬영'} />
        </label>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="check berry" checked={d.is_optional} onChange={(e) => set('is_optional', e.target.checked)} />
            선택 일정
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="check" checked={d.done} onChange={(e) => set('done', e.target.checked)} />
            완료
          </label>
        </div>
        {err && <p className="text-sm text-berry">⚠️ {err}</p>}
      </div>
    </Sheet>
  );
}
