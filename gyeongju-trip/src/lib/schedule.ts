import type { ScheduleItem } from './types';

export function compareSchedule(a: ScheduleItem, b: ScheduleItem) {
  return a.day.localeCompare(b.day) || a.time.localeCompare(b.time) || a.sort_order - b.sort_order;
}

export function sortSchedule(items: ScheduleItem[]) {
  return [...items].sort(compareSchedule);
}

export function groupByDay(items: ScheduleItem[]) {
  const map = new Map<string, ScheduleItem[]>();
  for (const it of sortSchedule(items)) {
    if (!map.has(it.day)) map.set(it.day, []);
    map.get(it.day)!.push(it);
  }
  return [...map.entries()].map(([day, list]) => ({ day, items: list }));
}

/**
 * 같은 날 안에서 일정을 위/아래로 이동한다.
 * 일정은 항상 시간순으로 자동 정렬되므로, 시간이 다른 일정과 자리를 바꾸면 두 일정의 시간도 서로 바꾼다.
 * 반환값: 적용할 패치 목록 (이동 불가하면 빈 배열)
 */
export function moveSchedule(
  items: ScheduleItem[],
  id: string,
  dir: -1 | 1,
): { id: string; patch: Partial<ScheduleItem> }[] {
  const target = items.find((i) => i.id === id);
  if (!target) return [];
  const sameDay = sortSchedule(items.filter((i) => i.day === target.day));
  const idx = sameDay.findIndex((i) => i.id === id);
  const other = sameDay[idx + dir];
  if (!other) return [];
  const a = target;
  const b = other;
  // 동일 시간일 때 sort_order 가 같으면 교환이 효과가 없으므로 인덱스 기반으로 재부여
  let aOrder = b.sort_order;
  let bOrder = a.sort_order;
  if (aOrder === bOrder) {
    aOrder = dir === -1 ? a.sort_order - 1 : a.sort_order + 1;
    bOrder = a.sort_order;
  }
  if (a.time === b.time) {
    return [
      { id: a.id, patch: { sort_order: aOrder } },
      { id: b.id, patch: { sort_order: bOrder } },
    ];
  }
  return [
    { id: a.id, patch: { time: b.time, sort_order: aOrder } },
    { id: b.id, patch: { time: a.time, sort_order: bOrder } },
  ];
}

export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return [start];
  for (let d = s; d <= e && out.length < 31; d = new Date(d.getTime() + 86400000)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const WEEK = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const WEEK_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function formatDayKo(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${WEEK[d.getUTCDay()]}`;
}

export function formatTripRange(start: string, end: string) {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${s.getUTCFullYear()}.${p(s.getUTCMonth() + 1)}.${p(s.getUTCDate())} ${WEEK_EN[s.getUTCDay()]} - ${p(
    e.getUTCMonth() + 1,
  )}.${p(e.getUTCDate())} ${WEEK_EN[e.getUTCDay()]}`;
}
