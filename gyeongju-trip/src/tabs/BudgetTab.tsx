import { useMemo, useState } from 'react';
import type { ViewProps } from '../components/TripView';
import type { BudgetItem } from '../lib/types';
import { normalizeAmount, summarizeBudget, won } from '../lib/budget';
import { uid } from '../lib/seed';
import { EditIcon, Gift, Progress, SectionTitle, Sheet, Star, TrashIcon } from '../components/ui';

export default function BudgetTab({ data, actions, readOnly, notify }: ViewProps) {
  const [editing, setEditing] = useState<{ item: BudgetItem; isNew: boolean } | null>(null);
  const [totalOpen, setTotalOpen] = useState(false);
  const s = useMemo(() => summarizeBudget(data.budget, data.trip.total_budget), [data.budget, data.trip.total_budget]);
  const sorted = [...data.budget].sort((a, b) => a.sort_order - b.sort_order);
  const base = sorted.filter((b) => !b.is_optional);
  const optional = sorted.filter((b) => b.is_optional);

  const newItem = (is_optional: boolean): BudgetItem => ({
    id: uid(),
    trip_id: data.trip.id,
    title: '',
    amount: 0,
    is_optional,
    spent: false,
    sort_order: Math.max(0, ...data.budget.map((b) => b.sort_order)) + 1,
  });

  const remove = (b: BudgetItem) => {
    if (!confirm(`'${b.title}' 항목을 삭제할까요?`)) return;
    actions.remove('budget_items', b.id);
    notify('예산 항목을 삭제했어요');
  };

  const row = (b: BudgetItem) => (
    <li key={b.id} className={`flex items-center gap-3 px-3.5 py-3 ${b.spent ? 'bg-sage-soft/40' : ''}`} data-testid="budget-item">
      <input
        type="checkbox"
        className="check"
        checked={b.spent}
        disabled={readOnly}
        onChange={(e) => actions.update('budget_items', b.id, { spent: e.target.checked })}
        aria-label={`${b.title} 지출 완료`}
      />
      <div className="min-w-0 flex-1">
        <div className={`truncate ${b.spent ? 'text-cocoa-soft line-through decoration-sage' : ''}`}>{b.title}</div>
        {b.spent && <div className="text-[11px] text-sage-dark">지출 완료</div>}
      </div>
      <div className={`whitespace-nowrap font-bold tabular-nums ${b.spent ? 'text-sage-dark' : ''}`}>{won(b.amount)}</div>
      {!readOnly && (
        <div className="-mr-1.5 flex">
          <button className="icon-btn" onClick={() => setEditing({ item: b, isNew: false })} aria-label={`${b.title} 수정`}><EditIcon /></button>
          <button className="icon-btn hover:!text-berry" onClick={() => remove(b)} aria-label={`${b.title} 삭제`}><TrashIcon /></button>
        </div>
      )}
    </li>
  );

  const tone = s.overSpent ? 'berry' : s.percent >= 80 ? 'butter' : 'sage';

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle deco={<span className="text-xl">💰</span>}>여행 경비</SectionTitle>
        <div className="card relative overflow-hidden p-5">
          <div className="absolute -right-2 -top-2 rotate-12 opacity-90"><Gift size={46} /></div>
          <div className="flex items-center gap-2 text-sm text-cocoa-soft">
            전체 예산
            {!readOnly && (
              <button className="icon-btn !h-6 !w-6" onClick={() => setTotalOpen(true)} aria-label="전체 예산 수정"><EditIcon /></button>
            )}
          </div>
          <div className="hand text-4xl font-bold leading-tight" data-testid="budget-total">{won(s.total)}</div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-berry-soft/70 p-3">
              <div className="text-xs text-berry-dark">사용 금액</div>
              <div className="hand text-2xl font-bold text-berry-dark" data-testid="budget-spent">{won(s.spent)}</div>
            </div>
            <div className={`rounded-2xl p-3 ${s.remaining < 0 ? 'bg-berry text-white' : 'bg-sage-soft'}`}>
              <div className={`text-xs ${s.remaining < 0 ? 'text-white' : 'text-sage-dark'}`}>남은 예산</div>
              <div className={`hand text-2xl font-bold ${s.remaining < 0 ? 'text-white' : 'text-sage-dark'}`} data-testid="budget-remaining">{won(s.remaining)}</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-cocoa-soft">
              <span>예산 사용률</span>
              <span className="tabular-nums">{s.total > 0 ? Math.round((s.spent / s.total) * 100) : 0}%</span>
            </div>
            <Progress value={s.percent} tone={tone} label="예산 사용률" />
          </div>
          {s.overSpent && (
            <p className="mt-3 rounded-2xl border border-berry bg-berry-soft px-3 py-2 text-sm text-berry-dark" role="alert">
              ⚠️ 예산을 {won(s.spent - s.total)} 초과했어요!
            </p>
          )}
          {!s.overSpent && s.overPlanned && (
            <p className="mt-3 rounded-2xl border border-butter bg-butter-soft px-3 py-2 text-sm" role="alert">
              ⚠️ 계획한 항목 합계({won(s.planned)})가 전체 예산보다 {won(s.planned - s.total)} 많아요
            </p>
          )}
        </div>
      </section>

      <section>
        <SectionTitle deco={<Star className="text-butter" size={18} />} right={<span className="text-xs text-cocoa-soft">✓ 체크 = 실제 지출 완료</span>}>
          예산 항목
        </SectionTitle>
        <div className="card overflow-hidden">
          <ul className="divide-y divide-dashed divide-cocoa-line">{base.map(row)}</ul>
          {base.length === 0 && <p className="p-6 text-center text-sm text-cocoa-soft">항목이 없어요</p>}
          <div className="flex items-center justify-between border-t-2 border-cocoa-line bg-cream/70 px-3.5 py-3">
            <span className="hand text-lg font-bold">합계 (계획)</span>
            <span className="font-bold tabular-nums" data-testid="budget-planned">{won(s.planned)}</span>
          </div>
        </div>
        {!readOnly && (
          <button className="btn-primary mt-3 w-full" onClick={() => setEditing({ item: newItem(false), isNew: true })}>＋ 예산 항목 추가</button>
        )}
      </section>

      <section>
        <SectionTitle deco={<span className="text-lg">🎀</span>}>선택 항목</SectionTitle>
        <div className="card overflow-hidden border-dashed border-butter">
          <ul className="divide-y divide-dashed divide-cocoa-line">{optional.map(row)}</ul>
          {optional.length === 0 && <p className="p-5 text-center text-sm text-cocoa-soft">선택 항목이 없어요</p>}
          {optional.length > 0 && (
            <div className="border-t border-cocoa-line bg-butter-soft/50 px-3.5 py-2.5 text-xs text-cocoa-soft">
              선택 항목 포함 시 계획 합계 <b className="text-cocoa">{won(s.planned + s.optionalPlanned)}</b> · 체크하면 사용 금액에 더해져요
            </div>
          )}
        </div>
        {!readOnly && (
          <button className="btn-ghost mt-3 w-full" onClick={() => setEditing({ item: newItem(true), isNew: true })}>＋ 선택 항목 추가</button>
        )}
      </section>

      {editing && (
        <BudgetEditor
          {...editing}
          onClose={() => setEditing(null)}
          onSave={(b) => {
            if (editing.isNew) actions.insert('budget_items', b);
            else actions.update('budget_items', b.id, { title: b.title, amount: b.amount, is_optional: b.is_optional, spent: b.spent });
            notify(editing.isNew ? '항목을 추가했어요' : '항목을 수정했어요');
            setEditing(null);
          }}
        />
      )}
      {totalOpen && (
        <AmountSheet
          title="💰 전체 예산 수정"
          initial={data.trip.total_budget}
          onClose={() => setTotalOpen(false)}
          onSave={(v) => {
            actions.updateTrip({ total_budget: v });
            setTotalOpen(false);
            notify('전체 예산을 변경했어요');
          }}
        />
      )}
    </div>
  );
}

function AmountInput({ value, onChange, id }: { value: number; onChange: (n: number) => void; id?: string }) {
  return (
    <div className="relative">
      <input
        id={id}
        className="field pr-9 text-right tabular-nums"
        inputMode="numeric"
        value={value ? value.toLocaleString('ko-KR') : ''}
        placeholder="0"
        onChange={(e) => onChange(normalizeAmount(e.target.value.replace(/,/g, '')))}
      />
      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-cocoa-soft">원</span>
    </div>
  );
}

function AmountSheet({ title, initial, onClose, onSave }: { title: string; initial: number; onClose: () => void; onSave: (v: number) => void }) {
  const [v, setV] = useState(initial);
  return (
    <Sheet open onClose={onClose} title={title} footer={<><button className="btn-ghost flex-1" onClick={onClose}>취소</button><button className="btn-primary flex-[2]" onClick={() => onSave(v)}>저장</button></>}>
      <label className="block">
        <span className="label">금액</span>
        <AmountInput value={v} onChange={setV} />
      </label>
    </Sheet>
  );
}

function BudgetEditor({ item, isNew, onClose, onSave }: { item: BudgetItem; isNew: boolean; onClose: () => void; onSave: (b: BudgetItem) => void }) {
  const [d, setD] = useState(item);
  const [err, setErr] = useState('');
  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? '🎁 예산 항목 추가' : '✏️ 예산 항목 수정'}
      footer={
        <>
          <button className="btn-ghost flex-1" onClick={onClose}>취소</button>
          <button className="btn-primary flex-[2]" onClick={() => (d.title.trim() ? onSave({ ...d, title: d.title.trim() }) : setErr('항목 이름을 입력해주세요'))}>저장</button>
        </>
      }
    >
      <div className="space-y-3.5">
        <label className="block">
          <span className="label">항목 이름 *</span>
          <input className="field" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="예: 네컷 사진" autoFocus={isNew} />
        </label>
        <label className="block">
          <span className="label">금액</span>
          <AmountInput value={d.amount} onChange={(amount) => setD({ ...d, amount })} />
        </label>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="check berry" checked={d.is_optional} onChange={(e) => setD({ ...d, is_optional: e.target.checked })} />
            선택 항목 (계획 합계 제외)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="check" checked={d.spent} onChange={(e) => setD({ ...d, spent: e.target.checked })} />
            지출 완료
          </label>
        </div>
        {err && <p className="text-sm text-berry">⚠️ {err}</p>}
      </div>
    </Sheet>
  );
}
