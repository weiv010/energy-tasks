import { useEffect, type ReactNode } from 'react';

export function Snowflake({ className = '', size = 16 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5M3 10.2l3.4.9-.9 3.4M21 13.8l-3.4-.9.9-3.4M3.9 14.7l3.4-.9-.9-3.4M20.1 9.3l-3.4.9.9 3.4" />
    </svg>
  );
}

export function Star({ className = '', size = 14 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.5l2.6 6.2 6.7.5-5.1 4.4 1.6 6.5L12 16.6 6.2 20.1l1.6-6.5L2.7 9.2l6.7-.5z" />
    </svg>
  );
}

export function Tree({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 40 46" aria-hidden>
      <path d="M20 3l2 4h-4z" fill="#F2D88B" />
      <path d="M20 6L9 20h6L6 32h8L4 42h32L26 32h8l-9-12h6z" fill="#9BAE91" />
      <path d="M12 26c5 2 11 2 16-1M10 36c7 3 14 3 21-1" stroke="#D97870" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="18" r="1.6" fill="#F2D88B" />
      <circle cx="25" cy="29" r="1.6" fill="#FFF9F0" />
      <circle cx="14" cy="38" r="1.6" fill="#F2D88B" />
      <rect x="17" y="42" width="6" height="4" rx="1" fill="#65564B" />
    </svg>
  );
}

export function Ribbon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="34" height="22" viewBox="0 0 34 22" aria-hidden>
      <path d="M17 9C12 1 3 2 4 8s8 5 13 1zM17 9c5-8 14-7 13-1s-8 5-13 1z" fill="#D97870" />
      <path d="M15 10l-5 11 4-2 2 3 1-12zM19 10l5 11-4-2-2 3-1-12z" fill="#D97870" opacity=".85" />
      <circle cx="17" cy="9.5" r="2.6" fill="#B85E57" />
    </svg>
  );
}

export function Gift({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="9" width="18" height="12" rx="2.5" fill="#F2D88B" />
      <rect x="2" y="6.5" width="20" height="4" rx="1.5" fill="#D97870" />
      <rect x="10.5" y="6.5" width="3" height="14.5" fill="#D97870" />
      <path d="M12 6.5C9 2 5.5 3.5 7 6.5zM12 6.5c3-4.5 6.5-3 5 0z" fill="#9BAE91" />
    </svg>
  );
}

export function SectionTitle({ children, deco, right }: { children: ReactNode; deco?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2 px-1">
      <h2 className="hand flex items-center gap-1.5 text-2xl font-bold leading-none text-cocoa">
        {deco}
        {children}
      </h2>
      {right}
    </div>
  );
}

export function Progress({ value, tone = 'sage', label }: { value: number; tone?: 'sage' | 'berry' | 'butter'; label: string }) {
  const color = tone === 'berry' ? 'bg-berry' : tone === 'butter' ? 'bg-butter' : 'bg-sage';
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-3.5 w-full overflow-hidden rounded-full border border-cocoa-line bg-cream" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className={`h-full rounded-full ${color} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-cocoa/30 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} className="sheet-in flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-[28px] border border-cocoa-line bg-white sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b border-dashed border-cocoa-line px-5 py-3.5">
          <h3 className="hand text-xl font-bold">{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="pb-safe flex gap-2 border-t border-cocoa-line px-5 pt-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Toast({ message, tone = 'info', onDone }: { message: string; tone?: 'info' | 'error'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, tone === 'error' ? 4500 : 2200);
    return () => clearTimeout(t);
  }, [message, tone, onDone]);
  return (
    <div role="status" className={`pop fixed left-1/2 top-4 z-[3000] max-w-[90vw] -translate-x-1/2 rounded-full border px-4 py-2 text-sm ${tone === 'error' ? 'border-berry bg-berry-soft text-berry-dark' : 'border-cocoa-line bg-white text-cocoa'}`}>
      {message}
    </div>
  );
}

export const EditIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
  </svg>
);
export const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
);
