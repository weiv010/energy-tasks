import type { TripData } from './types';

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

/**
 * 기본 여행 데이터.
 * 좌표는 OpenStreetMap(Nominatim)에서 확인된 장소(대릉원·첨성대·동궁과 월지)만 입력했다.
 * 지베르니 호텔·꽃길 한복·올리브 카페는 확인 가능한 좌표가 없어 비워두었으며, 관리자가 주소 검색·좌표 입력·지도 클릭으로 지정한다.
 */
export function createSeed(tripId: string = uid()): TripData {
  const D1 = '2026-11-29';
  const D2 = '2026-11-30';
  const p = {
    hotel: uid(),
    hanbok: uid(),
    daereung: uid(),
    cheom: uid(),
    cafe: uid(),
    donggung: uid(),
  };
  const place = (id: string, sort: number, name: string, emoji: string, description: string, address: string, lat: number | null, lng: number | null) => ({
    id, trip_id: tripId, name, emoji, description, address, lat, lng, sort_order: sort,
  });
  let order = 0;
  const sch = (day: string, time: string, title: string, theme: string, details: string[], place_id: string | null, extra: { time_label?: string; is_optional?: boolean } = {}) => ({
    id: uid(), trip_id: tripId, day, time, time_label: extra.time_label ?? '', title, theme,
    details: details.join('\n'), place_id, is_optional: extra.is_optional ?? false, done: false, sort_order: order++,
  });
  let bo = 0;
  const bud = (title: string, amount: number, is_optional = false) => ({
    id: uid(), trip_id: tripId, title, amount, is_optional, spent: false, sort_order: bo++,
  });
  const cats = [
    { name: '여행 필수품', emoji: '🧳', items: ['휴대폰', '충전기', '보조배터리', '지갑 및 신분증', '자동차 키'] },
    { name: '사진 촬영', emoji: '📸', items: ['휴대폰 삼각대', '블루투스 리모컨', '보조배터리', '머리 장식 및 소품'] },
    { name: '개인 준비물', emoji: '🧣', items: ['화장품', '개인 위생용품', '편한 신발', '따뜻한 외투', '핫팩'] },
    { name: '여행 준비', emoji: '📋', items: ['한복 예약 확인', '호텔 예약 확인', '카페 트리 장식 여부 확인', '호텔 배달 가능 여부 확인'] },
  ].map((c, i) => ({ ...c, id: uid(), sort_order: i }));

  return {
    trip: {
      id: tripId,
      title: '장금이들의 경주 여행',
      start_date: D1,
      end_date: D2,
      total_budget: 300000,
    },
    places: [
      place(p.hotel, 0, '지베르니 호텔', '🏨', '숙소 및 주차 장소', '', null, null),
      place(p.hanbok, 1, '꽃길 한복', '🎀', '한복 대여 및 반납', '', null, null),
      place(p.daereung, 2, '대릉원', '🌳', '한복 입고 산책하는 신라 고분 공원', '경상북도 경주시 황남동 계림로 9', 35.8389483, 129.2119324),
      place(p.cheom, 3, '첨성대', '⭐', '한복 사진 촬영 명소', '경상북도 경주시 인왕동', 35.834704, 129.2189849),
      place(p.cafe, 4, '올리브 카페', '☕', '크리스마스 트리 포토존 · 음료와 디저트', '', null, null),
      place(p.donggung, 5, '동궁과 월지', '🌙', '선택 관광지 · 야경 명소', '경상북도 경주시 원화로 102 (인왕동)', 35.8347003, 129.2264375),
    ],
    schedule: [
      sch(D1, '09:30', '양산 출발', '자동차 이동', ['자동차 이동', '예상 이동시간 1시간'], null),
      sch(D1, '10:30', '지베르니 호텔 도착', '숙소 · 주차', ['미리 주차하기', '체크인 전 주차 가능 여부 확인 완료'], p.hotel),
      sch(D1, '11:00', '점심 식사', '황리단길', ['황리단길에서 식사', '예산 30,000원'], null),
      sch(D1, '11:40', '꽃길 한복', '한복 대여', ['한복 환복 및 준비', '장금이 한복 2인', '자유이용권 이용'], p.hanbok),
      sch(D1, '12:30', '대릉원', '한복 산책', ['한복 입고 산책', '휴대폰 사진 촬영'], p.daereung),
      sch(D1, '13:40', '첨성대', '한복 사진', ['한복 사진 촬영', '주변 산책'], p.cheom),
      sch(D1, '14:30', '올리브 카페', '크리스마스 트리', ['크리스마스 트리 앞에서 사진 촬영', '음료와 디저트'], p.cafe),
      sch(D1, '15:15', '꽃길 한복', '한복 반납', ['한복 반납 및 환복'], p.hanbok),
      sch(D1, '16:00', '지베르니 호텔', '체크인 · 휴식', ['체크인', '휴식'], p.hotel),
      sch(D1, '17:30', '저녁 식사', '호텔 배달', ['호텔에서 배달 음식 주문'], p.hotel),
      sch(D1, '19:00', '동궁과 월지', '야경 감상', ['저녁 식사 후 컨디션에 따라 방문', '야경 감상'], p.donggung, { time_label: '저녁 식사 후', is_optional: true }),
      sch(D2, '09:00', '기상 · 체크아웃 · 출발', '마무리', ['기상 및 아침 식사', '체크아웃', '양산으로 출발'], p.hotel, { time_label: '오전' }),
      sch(D2, '12:30', '양산 도착', '도착 목표', ['12:30 이전 양산 도착 목표'], null, { time_label: '12:30 이전' }),
    ],
    budget: [
      bud('지베르니 호텔', 76500),
      bud('한복 자유이용권 2인', 66000),
      bud('장금이 한복 추가 2인', 20000),
      bud('점심 식사', 30000),
      bud('올리브 카페', 18000),
      bud('네컷 사진', 10000),
      bud('저녁 배달 음식', 35000),
      bud('유류비·주차·통행료', 25000),
      bud('예비비', 19500),
      bud('댕기머리 손질 1인', 7000, true),
    ],
    categories: cats.map(({ id, name, emoji, sort_order }) => ({ id, trip_id: tripId, name, emoji, sort_order })),
    checklist: cats.flatMap((c) =>
      c.items.map((name, i) => ({ id: uid(), trip_id: tripId, category_id: c.id, name, done: false, sort_order: i })),
    ),
  };
}
