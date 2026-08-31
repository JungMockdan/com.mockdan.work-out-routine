import type { PlanInput } from '../engine';
import { STORAGE_KEYS } from '../constants';
import type { CompletePayload, StoredPlan, StoredSession } from '../types';
import type { Repository } from './types';

function read(): StoredPlan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.plan);
    return raw ? (JSON.parse(raw) as StoredPlan) : null;
  } catch {
    return null;
  }
}

function write(plan: StoredPlan | null): void {
  if (plan == null) localStorage.removeItem(STORAGE_KEYS.plan);
  else localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(plan));
}

export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(data.error ?? '요청 실패 (' + res.status + ')');
  return data;
}

/**
 * localStorage 저장소. 엔진은 여전히 서버(/api/plans)에서 실행하고
 * 반환된 스냅샷을 로컬에 저장한다.
 */
export class LocalRepository implements Repository {
  readonly kind = 'local' as const;

  async getCurrentPlan(): Promise<StoredPlan | null> {
    // completed 계획도 읽기용으로 반환한다 — 캘린더의 완료 표시·진도율이 계속 보여야 한다 (SPEC 5)
    const p = read();
    return p && p.status !== 'abandoned' ? p : null;
  }

  async createPlan(input: PlanInput, opts?: { persist?: boolean }): Promise<StoredPlan> {
    const plan = await postJSON<StoredPlan>('/api/plans', { input, persist: false });
    if (opts?.persist !== false) write(plan);
    return plan;
  }

  async getSession(date: string): Promise<StoredSession | null> {
    const p = read();
    return p?.sessions.find((s) => s.date === date) ?? null;
  }

  async setSessionStatus(sessionId: string, status: StoredSession['status']): Promise<void> {
    const p = read();
    if (!p) return;
    const s = p.sessions.find((x) => x.id === sessionId);
    if (!s) return;
    s.status = status;
    write(p);
  }

  async completeSession(sessionId: string, payload: CompletePayload): Promise<StoredPlan> {
    const p = read();
    if (!p) throw new Error('진행 중인 계획이 없습니다.');
    const s = p.sessions.find((x) => x.id === sessionId);
    if (!s) throw new Error('세션을 찾을 수 없습니다.');
    s.status = 'done';
    s.completedAt = new Date().toISOString();
    s.elapsedSec = payload.elapsedSec;
    s.logs = payload.logs.map((l) => ({ ...l, rpe: payload.rpe, painFlag: l.painFlag || payload.painFlag }));
    if (p.sessions.every((x) => x.status === 'done' || x.status === 'skipped')) p.status = 'completed';
    write(p);
    return p;
  }

  async regenerate(planId: string): Promise<StoredPlan> {
    const p = read();
    if (!p || p.id !== planId) throw new Error('계획을 찾을 수 없습니다.');
    const next = await postJSON<StoredPlan>('/api/plans/regenerate', { plan: p });
    // 요청 중 다른 탭/화면에서 바뀐 상태를 덮어쓰지 않도록 병합 후 저장한다
    const latest = read();
    if (latest && latest.id === planId) {
      const byDate = new Map(latest.sessions.map((s) => [s.date, s]));
      next.sessions = next.sessions.map((s) => {
        const cur = byDate.get(s.date);
        return cur && (cur.status === 'done' || cur.status === 'skipped' || cur.status === 'in_progress') ? cur : s;
      });
    }
    write(next);
    return next;
  }

  async updateProfile(patch: Pick<PlanInput, 'level' | 'equipment' | 'avoidTags'>): Promise<StoredPlan | null> {
    const p = read();
    if (!p) return null;
    p.input = { ...p.input, ...patch };
    write(p);
    return p;
  }

  async reset(): Promise<void> {
    write(null);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('moccu.')) localStorage.removeItem(k);
    }
  }
}
