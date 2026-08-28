import type { PlanInput } from '../engine';
import type { CompletePayload, StoredPlan, StoredSession } from '../types';

/**
 * 저장소 인터페이스. 클라이언트 컴포넌트는 이것만 사용한다.
 * - LocalRepository: localStorage (Supabase 키가 없을 때)
 * - SupabaseRepository: API 라우트 경유 (키가 있을 때)
 */
export interface Repository {
  readonly kind: 'local' | 'supabase';
  getCurrentPlan(): Promise<StoredPlan | null>;
  /** 서버에서 엔진을 실행해 계획을 만든다. 미리보기용이면 persist=false */
  createPlan(input: PlanInput, opts?: { persist?: boolean }): Promise<StoredPlan>;
  getSession(date: string): Promise<StoredSession | null>;
  setSessionStatus(sessionId: string, status: StoredSession['status']): Promise<void>;
  completeSession(sessionId: string, payload: CompletePayload): Promise<StoredPlan>;
  regenerate(planId: string): Promise<StoredPlan>;
  updateProfile(patch: Pick<PlanInput, 'level' | 'equipment' | 'avoidTags'>): Promise<StoredPlan | null>;
  reset(): Promise<void>;
}
