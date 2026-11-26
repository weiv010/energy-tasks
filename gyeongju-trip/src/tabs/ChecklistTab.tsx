import { useState } from 'react';
import type { ViewProps } from '../components/TripView';
import type { ChecklistCategory, ChecklistItem } from '../lib/types';
import { uid } from '../lib/seed';
import { EditIcon, Progress, SectionTitle, Sheet, Snowflake, TrashIcon } from '../components/ui';

const CAT_EMOJIS = ['🧳', '📸', '🧣', '📋', '🎁', '💄', '🍪', '🧤', '🎄', '💊'];

export default function ChecklistTab({ data, actions, readOnly, notify }: ViewProps) {
  const [catEdit, setCatEdit] = useState<{ cat: ChecklistCategory; isNew: boolean } | null>(null);
  const cats = [...data.categories].sort((a, b) => a.sort_order - b.sort_order);
  const total = data.checklist.length;
  const done = data.checklist.filter((c) => c.done).length;
  const pct = total ? (done / total) * 100 : 0;

  const removeCat = (c: ChecklistCategory) => {
    const n = data.checklist.filter((i) => i.category_id === c.id).length;
    if (!confirm(`'${c.name}' 카테고리를 삭제할까요?${n ? `\n안의 준비물 ${n}개도 함께 삭제돼요.` : ''}`)) return;
    actions.remove('checklist_categories', c.id);
    notify('카테고리를 삭제했어요');
  };

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle deco={<span className="text-xl">🎒</span>}>준비물 체크</SectionTitle>
        <div className="card p-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-sm text-cocoa-soft">준비 완료</div>
              <div className="hand text-4xl font-bold" data-testid="checklist-count">
                {done} <span className="text-2xl text-cocoa-soft">/ {total}</span>
              </div>
            </div>
            <div className="hand text-3xl font-bold text-sage-dark">{Math.round(pct)}%</div>
          </div>
          <div className="mt-3"><Progress value={pct} label="준비 진행률" /></div>
          {total > 0 && done === total && <p className="mt-3 text-center text-sm text-sage-dark">🎄 준비 끝! 즐거운 여행 되세요 🎁</p>}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {cats.map((c) => (
          <CategoryCard
            key={c.id}
            cat={c}
            items={data.checklist.filter((i) => i.category_id === c.id).sort((a, b) => a.sort_order - b.sort_order)}
            {...{ actions, readOnly, notify }}
            tripId={data.trip.id}
            onEdit={() => setCatEdit({ cat: c, isNew: false })}
            onRemove={() => removeCat(c)}
          />
        ))}
      </div>
      {cats.length === 0 && <div className="card p-8 text-center text-sm text-cocoa-soft">카테고리가 없어요</div>}

      {!readOnly && (
        <button
          className="btn-ghost w-full !py-3"
          onClick={() =>
            setCatEdit({
              isNew: true,
              cat: { id: uid(), trip_id: data.trip.id, name: '', emoji: '🎁', sort_order: Math.max(0, ...data.categories.map((c) => c.sort_order)) + 1 },
            })
          }
        >
          ＋ 카테고리 추가
        </button>
      )}

      {catEdit && (
        <CategorySheet
          {...catEdit}
          onClose={() => setCatEdit(null)}
          onSave={(c) => {
            if (catEdit.isNew) actions.insert('checklist_categories', c);
            else actions.update('checklist_categories', c.id, { name: c.name, emoji: c.emoji });
            setCatEdit(null);
            notify(catEdit.isNew ? '카테고리를 추가했어요' : '카테고리를 수정했어요');
          }}
        />
      )}
    </div>
  );
}

function CategoryCard({
  cat,
  items,
  actions,
  readOnly,
  notify,
  tripId,
  onEdit,
  onRemove,
}: Pick<ViewProps, 'actions' | 'readOnly' | 'notify'> & {
  cat: ChecklistCategory;
  items: ChecklistItem[];
  tripId: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const done = items.filter((i) => i.done).length;

  const add = () => {
    const name = text.trim();
    if (!name) return;
    actions.insert('checklist_items', {
      id: uid(),
      trip_id: tripId,
      category_id: cat.id,
      name,
      done: false,
      sort_order: Math.max(-1, ...items.map((i) => i.sort_order)) + 1,
    });
    setText('');
  };

  const commitEdit = () => {
    if (editingId && editText.trim()) actions.update('checklist_items', editingId, { name: editText.trim() });
    setEditingId(null);
  };

  return (
    <section className="card overflow-hidden" data-testid="checklist-category">
      <header className="flex items-center gap-2 border-b border-dashed border-cocoa-line bg-cream/60 px-4 py-2.5">
        <span className="text-xl">{cat.emoji}</span>
        <h3 className="hand flex-1 text-xl font-bold">{cat.name}</h3>
        <span className="text-xs tabular-nums text-cocoa-soft">{done}/{items.length}</span>
        {!readOnly && (
          <>
            <button className="icon-btn !h-7 !w-7" onClick={onEdit} aria-label={`${cat.name} 카테고리 수정`}><EditIcon /></button>
            <button className="icon-btn !h-7 !w-7 hover:!text-berry" onClick={onRemove} aria-label={`${cat.name} 카테고리 삭제`}><TrashIcon /></button>
          </>
        )}
      </header>
      <ul className="divide-y divide-cocoa-line/60">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 px-4 py-2.5" data-testid="checklist-item">
            <input
              type="checkbox"
              className="check"
              checked={i.done}
              disabled={readOnly}
              onChange={(e) => actions.update('checklist_items', i.id, { done: e.target.checked })}
              aria-label={`${i.name} 준비 완료`}
            />
            {editingId === i.id ? (
              <input
                className="field !py-1.5"
                value={editText}
                autoFocus
                onChange={(e) => setEditText(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                aria-label="준비물 이름"
              />
            ) : (
              <span className={`flex-1 ${i.done ? 'text-cocoa-soft/70 line-through' : ''}`}>{i.name}</span>
            )}
            {!readOnly && editingId !== i.id && (
              <div className="-mr-2 flex">
                <button className="icon-btn !h-7 !w-7" onClick={() => { setEditingId(i.id); setEditText(i.name); }} aria-label={`${i.name} 이름 수정`}><EditIcon /></button>
                <button
                  className="icon-btn !h-7 !w-7 hover:!text-berry"
                  onClick={() => { actions.remove('checklist_items', i.id); notify(`'${i.name}' 삭제됨`); }}
                  aria-label={`${i.name} 삭제`}
                >
                  <TrashIcon />
                </button>
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="flex items-center gap-1.5 px-4 py-4 text-sm text-cocoa-soft"><Snowflake size={13} /> 비어 있어요</li>
        )}
      </ul>
      {!readOnly && (
        <form className="flex gap-2 border-t border-dashed border-cocoa-line p-2.5" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input className="field !py-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="준비물 추가" aria-label={`${cat.name}에 준비물 추가`} />
          <button className="btn-sage shrink-0 !px-3.5" type="submit" disabled={!text.trim()}>추가</button>
        </form>
      )}
    </section>
  );
}

function CategorySheet({ cat, isNew, onClose, onSave }: { cat: ChecklistCategory; isNew: boolean; onClose: () => void; onSave: (c: ChecklistCategory) => void }) {
  const [d, setD] = useState(cat);
  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? '🎁 카테고리 추가' : '✏️ 카테고리 수정'}
      footer={
        <>
          <button className="btn-ghost flex-1" onClick={onClose}>취소</button>
          <button className="btn-primary flex-[2]" disabled={!d.name.trim()} onClick={() => onSave({ ...d, name: d.name.trim() })}>저장</button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div>
          <span className="label">아이콘</span>
          <div className="flex flex-wrap gap-1.5">
            {CAT_EMOJIS.map((e) => (
              <button key={e} onClick={() => setD({ ...d, emoji: e })} className={`h-9 w-9 rounded-xl border text-lg ${d.emoji === e ? 'border-berry bg-berry-soft' : 'border-cocoa-line'}`}>{e}</button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="label">카테고리 이름</span>
          <input className="field" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} autoFocus placeholder="예: 간식" />
        </label>
      </div>
    </Sheet>
  );
}
