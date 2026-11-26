export interface Trip {
  id: string;
  title: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  total_budget: number;
}

export interface Place {
  id: string;
  trip_id: string;
  name: string;
  emoji: string;
  description: string;
  address: string;
  lat: number | null;
  lng: number | null;
  sort_order: number;
}

export interface ScheduleItem {
  id: string;
  trip_id: string;
  day: string; // YYYY-MM-DD
  time: string; // HH:MM — 정렬 기준
  time_label: string; // 표시용 (예: "오전", "저녁 식사 후"). 비어 있으면 time 을 표시
  title: string;
  theme: string; // 장소 또는 테마
  details: string; // 줄바꿈으로 구분된 상세 설명
  place_id: string | null;
  is_optional: boolean;
  done: boolean;
  sort_order: number;
}

export interface BudgetItem {
  id: string;
  trip_id: string;
  title: string;
  amount: number;
  is_optional: boolean;
  spent: boolean; // 체크 = 실제 지출 완료
  sort_order: number;
}

export interface ChecklistCategory {
  id: string;
  trip_id: string;
  name: string;
  emoji: string;
  sort_order: number;
}

export interface ChecklistItem {
  id: string;
  trip_id: string;
  category_id: string;
  name: string;
  done: boolean;
  sort_order: number;
}

export interface TripData {
  trip: Trip;
  places: Place[];
  schedule: ScheduleItem[];
  budget: BudgetItem[];
  categories: ChecklistCategory[];
  checklist: ChecklistItem[];
}

export interface TableRows {
  places: Place;
  schedule_items: ScheduleItem;
  budget_items: BudgetItem;
  checklist_categories: ChecklistCategory;
  checklist_items: ChecklistItem;
}
export type TableName = keyof TableRows;

export const TABLE_KEY: { [K in TableName]: keyof Omit<TripData, 'trip'> } = {
  places: 'places',
  schedule_items: 'schedule',
  budget_items: 'budget',
  checklist_categories: 'categories',
  checklist_items: 'checklist',
};

export interface ShareLink {
  id: string;
  token: string;
  created_at: string;
  revoked_at: string | null;
}
