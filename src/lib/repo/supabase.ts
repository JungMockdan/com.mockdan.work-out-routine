import type { PlanInput } from '../engine';
import { ensureAuth } from '../supabase/client';
import type { CompletePayload, StoredPlan, StoredSession } from '../types';
import { postJSON } from './local';
import type { Repository } from './types';

async function getJSON<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (res.status === 404) return null;
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error((data as { error?: string }).error ?? '요청 실패 (' + res.status + ')');
  return data;
}

/**
 * Supabase 저장소 — SPEC 6의 서버 라우트를 호출한다.
 * 인증은 익명 로그인(쿠키 세션). 데이터 접근은 전부 서버에서 RLS로 보호된다.
 */
export class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const;

  private plan: StoredPlan | null = null;

  async getCurrentPlan(): Promise<StoredPlan | null> {
    await ensureAuth();
    const data = await getJSON<{ plan: StoredPlan | null }>('/api/plans/current');
    this.plan = data?.plan ?? null;
    return this.plan;
  }

  async createPlan(input: PlanInput, opts?: { persist?: boolean }): Promise<StoredPlan> {
    await ensureAuth();
    const plan = await postJSON<StoredPlan>('/api/plans', { input, persist: opts?.persist !== false });
    if (opts?.persist !== false) this.plan = plan;
    return plan;
  }

  async getSession(date: string): Promise<StoredSession | null> {
    await ensureAuth();
    const data = await getJSON<{ session: StoredSession | null }>(`/api/sessions/${date}`);
    return data?.session ?? null;
  }

  async setSessionStatus(sessionId: string, status: StoredSession['status']): Promise<void> {
    await ensureAuth();
    await postJSON(`/api/sessions/${sessionId}/status`, { status });
  }

  async completeSession(sessionId: string, payload: CompletePayload): Promise<StoredPlan> {
    await ensureAuth();
    const plan = await postJSON<StoredPlan>(`/api/sessions/${sessionId}/complete`, payload);
    this.plan = plan;
    return plan;
  }

  async regenerate(planId: string): Promise<StoredPlan> {
    await ensureAuth();
    const plan = await postJSON<StoredPlan>(`/api/plans/${planId}/regenerate`, {});
    this.plan = plan;
    return plan;
  }

  async updateProfile(patch: Pick<PlanInput, 'level' | 'equipment' | 'avoidTags'>): Promise<StoredPlan | null> {
    await ensureAuth();
    const data = await postJSON<{ plan: StoredPlan | null }>('/api/profile', patch);
    this.plan = data.plan ?? this.plan;
    return data.plan;
  }

  async reset(): Promise<void> {
    await ensureAuth();
    await postJSON('/api/reset', {});
    this.plan = null;
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('moccu.')) localStorage.removeItem(k);
      }
    } catch {
      /* noop */
    }
  }
}
