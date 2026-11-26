import { useRef, useState } from 'react';
import type { LocalBackend } from '../lib/backend';
import { Sheet } from './ui';

export default function BackupSheet({ open, onClose, backend }: { open: boolean; onClose: () => void; backend: LocalBackend }) {
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const download = () => {
    const blob = new Blob([JSON.stringify(backend.exportData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `경주여행-백업-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const upload = async (f: File) => {
    setError('');
    try {
      const data = JSON.parse(await f.text());
      if (!confirm('지금 데이터를 백업 파일 내용으로 바꿀까요?')) return;
      backend.importData(data);
      window.location.reload();
    } catch (e) {
      setError(e instanceof SyntaxError ? '파일을 읽을 수 없어요' : (e as Error).message);
    }
  };

  const reset = () => {
    if (!confirm('모든 수정 내용을 지우고 처음 기본 일정으로 되돌릴까요?\n(되돌릴 수 없어요. 먼저 백업을 권장해요)')) return;
    backend.reset();
    window.location.reload();
  };

  return (
    <Sheet open={open} onClose={onClose} title="💾 백업">
      <div className="space-y-4 text-sm">
        <p className="rounded-2xl bg-butter-soft p-3 leading-relaxed">
          여행 데이터는 <b>지금 사용 중인 이 브라우저</b>에 자동 저장돼요. 브라우저 기록(사이트 데이터)을 지우면 사라질 수 있으니 가끔 백업해두세요.
          다른 기기에서 이어 쓰려면 백업 파일을 그 기기에서 불러오면 돼요.
        </p>
        <button className="btn-primary w-full !py-3" onClick={download}>⬇️ 백업 파일 저장</button>
        <button className="btn-ghost w-full !py-3" onClick={() => file.current?.click()}>⬆️ 백업 파일 불러오기</button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="백업 파일 선택"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = '';
          }}
        />
        {error && <p className="text-berry" role="alert">⚠️ {error}</p>}
        <button className="w-full pt-2 text-xs text-cocoa-soft underline" onClick={reset}>처음 기본 일정으로 초기화</button>
      </div>
    </Sheet>
  );
}
