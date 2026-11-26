import { useEffect, useState, type ReactNode } from 'react';
import type { TripActions } from '../lib/useTrip';
import type { TripData } from '../lib/types';
import { formatTripRange } from '../lib/schedule';
import { Gift, Ribbon, Snowflake, Star, Tree } from './ui';
import HomeTab from '../tabs/HomeTab';
import BudgetTab from '../tabs/BudgetTab';
import ChecklistTab from '../tabs/ChecklistTab';

export type Tab = 'home' | 'budget' | 'checklist';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: '홈', icon: '🗺️' },
  { id: 'budget', label: '예산', icon: '💰' },
  { id: 'checklist', label: '준비물', icon: '🎒' },
];

const tabFromHash = (): Tab => {
  const h = window.location.hash.replace('#', '');
  return (TABS.some((t) => t.id === h) ? h : 'home') as Tab;
};

export interface ViewProps {
  data: TripData;
  actions: TripActions;
  readOnly: boolean;
  notify: (msg: string, tone?: 'info' | 'error') => void;
}

export default function TripView({
  banner,
  headerActions,
  saving,
  ...view
}: ViewProps & { banner?: ReactNode; headerActions?: ReactNode; saving?: boolean }) {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (t: Tab) => {
    history.replaceState(null, '', t === 'home' ? window.location.pathname + window.location.search : `#${t}`);
    setTab(t);
    window.scrollTo({ top: 0 });
  };
  const { trip } = view.data;

  return (
    <div className="mx-auto min-h-screen max-w-3xl pb-28">
      {banner}
      <header className="relative px-4 pb-2 pt-5 sm:px-6">
        <Snowflake className="floaty absolute left-3 top-3 text-sage" size={14} />
        <Star className="absolute right-24 top-4 text-butter" size={12} />
        <Snowflake className="floaty absolute right-1/3 top-14 text-berry/40" size={11} />
        <div className="card relative overflow-hidden px-4 py-4 sm:px-6">
          <Ribbon className="absolute -top-0.5 left-1/2 -translate-x-1/2" />
          <div className="flex items-center gap-3">
            <Tree size={38} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] tracking-[0.18em] text-sage-dark">MERRY LITTLE TRIP ✦ GYEONGJU</p>
              <h1 className="hand truncate text-[28px] font-bold leading-tight text-cocoa sm:text-4xl">{trip.title}</h1>
              <p className="mt-0.5 text-sm text-berry">{formatTripRange(trip.start_date, trip.end_date)}</p>
            </div>
            <div className="hidden sm:block">
              <Gift size={34} />
            </div>
          </div>
          {(headerActions || view.readOnly || saving) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-cocoa-line pt-3">
              {view.readOnly && <span className="chip border-sage bg-sage-soft text-sage-dark">👀 보기 전용</span>}
              {saving && <span className="chip border-butter bg-butter-soft text-cocoa">저장 중…</span>}
              <div className="ml-auto flex flex-wrap gap-2">{headerActions}</div>
            </div>
          )}
        </div>
      </header>

      <main className="px-4 sm:px-6">
        {tab === 'home' && <HomeTab {...view} />}
        {tab === 'budget' && <BudgetTab {...view} />}
        {tab === 'checklist' && <ChecklistTab {...view} />}
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-[1500] border-t border-cocoa-line bg-white/95 backdrop-blur" aria-label="메뉴">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-1 px-3 pt-1.5">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center rounded-2xl py-1.5 text-xs transition ${active ? 'bg-berry-soft font-bold text-berry-dark' : 'text-cocoa-soft hover:bg-cream'}`}
              >
                {active && <Star className="absolute right-[30%] top-1 text-butter" size={9} />}
                <span className={`text-xl leading-6 transition ${active ? 'scale-110' : 'grayscale-[40%]'}`}>{t.icon}</span>
                <span className="hand text-[15px] leading-4">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
