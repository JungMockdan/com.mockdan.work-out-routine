'use client';

import { useEffect } from 'react';
import { useOnboarding } from '@/store/onboarding';

/** 모바일 우선 셸: max-width 480px 중앙 정렬 + service worker 등록 + 스토어 복원 */
export function AppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // skipHydration 스토어의 저장값 복원 (하이드레이션 미스매치 방지)
    void useOnboarding.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 오프라인 캐시는 선택 기능 — 실패해도 앱은 동작한다 */
    });
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-surface shadow-[0_0_0_1px_var(--color-line)]">
      {children}
    </div>
  );
}
