import { useCallback, useEffect, useRef, useState } from 'react';
import type { Backend } from './backend';
import { TABLE_KEY, type TableName, type TableRows, type Trip, type TripData } from './types';

export interface TripActions {
  updateTrip(patch: Partial<Trip>): void;
  insert<T extends TableName>(table: T, row: TableRows[T]): void;
  update<T extends TableName>(table: T, id: string, patch: Partial<TableRows[T]>): void;
  remove(table: TableName, id: string): void;
}

/**
 * 화면은 즉시 갱신(낙관적 업데이트)하고, 서버 저장에 실패하면 서버 데이터를 다시 불러와 되돌린다.
 */
export function useTrip(backend: Backend | null, onError: (msg: string) => void) {
  const [data, setData] = useState<TripData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(0);
  const errRef = useRef(onError);
  errRef.current = onError;

  const reload = useCallback(async () => {
    if (!backend) return;
    try {
      setData(await backend.load());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [backend]);

  useEffect(() => {
    setData(null);
    void reload();
  }, [reload]);

  const run = useCallback(
    (op: () => Promise<void>) => {
      setSaving((n) => n + 1);
      op()
        .catch((e: Error) => {
          errRef.current(`저장하지 못했어요: ${e.message}`);
          void reload();
        })
        .finally(() => setSaving((n) => n - 1));
    },
    [reload],
  );

  const actions: TripActions = {
    updateTrip(patch) {
      if (!backend || !data) return;
      setData((d) => (d ? { ...d, trip: { ...d.trip, ...patch } } : d));
      run(() => backend.updateTrip(data.trip.id, patch));
    },
    insert(table, row) {
      if (!backend) return;
      const key = TABLE_KEY[table];
      setData((d) => (d ? { ...d, [key]: [...(d[key] as unknown[]), row] } : d));
      run(() => backend.insert(table, row));
    },
    update(table, id, patch) {
      if (!backend) return;
      const key = TABLE_KEY[table];
      setData((d) =>
        d ? { ...d, [key]: (d[key] as { id: string }[]).map((r) => (r.id === id ? { ...r, ...patch } : r)) } : d,
      );
      run(() => backend.update(table, id, patch));
    },
    remove(table, id) {
      if (!backend) return;
      const key = TABLE_KEY[table];
      setData((d) => {
        if (!d) return d;
        const next = { ...d, [key]: (d[key] as { id: string }[]).filter((r) => r.id !== id) } as TripData;
        if (table === 'checklist_categories') next.checklist = next.checklist.filter((c) => c.category_id !== id);
        if (table === 'places') next.schedule = next.schedule.map((s) => (s.place_id === id ? { ...s, place_id: null } : s));
        return next;
      });
      run(() => backend.remove(table, id));
    },
  };

  return { data, error, saving: saving > 0, reload, actions };
}
