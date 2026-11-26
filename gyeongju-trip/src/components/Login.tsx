import { useState } from 'react';
import { supabase } from '../lib/backend';
import { Ribbon, Snowflake, Tree } from './ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 올바르지 않아요' : error.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card relative w-full max-w-sm space-y-4 p-6">
        <Ribbon className="absolute -top-0.5 left-1/2 -translate-x-1/2" />
        <Snowflake className="floaty absolute right-5 top-5 text-sage" />
        <div className="flex flex-col items-center gap-2 pt-2 text-center">
          <Tree size={44} />
          <h1 className="hand text-3xl font-bold">장금이들의 경주 여행</h1>
          <p className="text-sm text-cocoa-soft">관리자 로그인</p>
        </div>
        <label className="block">
          <span className="label">이메일</span>
          <input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block">
          <span className="label">비밀번호</span>
          <input className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="text-sm text-berry" role="alert">⚠️ {error}</p>}
        <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
        <p className="text-center text-xs text-cocoa-soft">공유 링크를 받으셨다면 로그인 없이 그 링크로 바로 볼 수 있어요.</p>
      </form>
    </div>
  );
}
