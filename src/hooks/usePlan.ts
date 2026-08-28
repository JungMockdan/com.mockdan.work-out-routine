'use client';

import { useCallback, useEffect, useState } from 'react';
import { getRepository } from '@/lib/repo';
import type { StoredPlan } from '@/lib/types';

/** 현재 진행 중 계획을 저장소에서 읽어온다. 클라이언트 전용. */
export function usePlan() {
  const [plan, setPlan] = useState<StoredPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await getRepository().getCurrentPlan();
      setPlan(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : '계획을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { plan, setPlan, loading, error, reload };
}
