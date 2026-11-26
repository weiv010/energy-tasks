import type { BudgetItem } from './types';

export interface BudgetSummary {
  total: number; // 전체 예산
  spent: number; // 체크된(지출 완료) 항목 합계
  remaining: number; // 전체 예산 - 사용 금액
  planned: number; // 기본(필수) 항목 계획 합계
  optionalPlanned: number; // 선택 항목 계획 합계
  percent: number; // 0~100 (표시용)
  overSpent: boolean; // 실제 지출이 예산 초과
  overPlanned: boolean; // 계획 합계가 예산 초과
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function normalizeAmount(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

export function summarizeBudget(items: BudgetItem[], total: number): BudgetSummary {
  const spent = sum(items.filter((i) => i.spent).map((i) => normalizeAmount(i.amount)));
  const planned = sum(items.filter((i) => !i.is_optional).map((i) => normalizeAmount(i.amount)));
  const optionalPlanned = sum(items.filter((i) => i.is_optional).map((i) => normalizeAmount(i.amount)));
  const t = normalizeAmount(total);
  return {
    total: t,
    spent,
    remaining: t - spent,
    planned,
    optionalPlanned,
    percent: t > 0 ? Math.min(100, (spent / t) * 100) : spent > 0 ? 100 : 0,
    overSpent: spent > t,
    overPlanned: planned > t,
  };
}

export const won = (n: number) => `${n < 0 ? '-' : ''}${Math.abs(n).toLocaleString('ko-KR')}원`;
