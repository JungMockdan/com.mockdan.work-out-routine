/**
 * 앱 저장 모델. 엔진 출력(SessionPlan.blocks)을 스냅샷으로 그대로 보존한다.
 * 운동 DB가 바뀌어도 이미 생성된 루틴은 변하지 않는다.
 */
import type { PlanInput, SessionPlan } from './engine';

export type PlanStatus = 'active' | 'completed' | 'abandoned';
export type SessionStatus = 'planned' | 'in_progress' | 'done' | 'skipped';

export interface ExerciseLog {
  exerciseId: string;
  completedSets: number;
  /** 자각 강도 1~10 (세션 단위 입력을 각 로그에 복사) */
  rpe?: number;
  painFlag: boolean;
  note?: string;
}

export interface StoredSession extends SessionPlan {
  id: string;
  planId: string;
  status: SessionStatus;
  /** ISO datetime */
  completedAt?: string;
  /** 실제 소요 시간(초) */
  elapsedSec?: number;
  logs?: ExerciseLog[];
}

export interface StoredPlan {
  id: string;
  input: PlanInput;
  targetSec: number;
  status: PlanStatus;
  /** ISO datetime */
  createdAt: string;
  sessions: StoredSession[];
  restDates: string[];
  warnings: string[];
}

/** 세션 완료 시 클라이언트가 보내는 페이로드 */
export interface CompletePayload {
  elapsedSec: number;
  rpe?: number;
  painFlag: boolean;
  note?: string;
  logs: ExerciseLog[];
}

/** 실행 화면의 중단/복원용 진행 상태 (localStorage) */
export interface SessionProgress {
  sessionId: string;
  date: string;
  blockIndex: number;
  itemIndex: number;
  setIndex: number;
  /** 세션 시작 후 누적 경과(초) — 일시정지 구간 제외 */
  elapsedSec: number;
  completedSets: Record<string, number>;
  skipped: string[];
  savedAt: string;
}

export function progressOf(plan: StoredPlan): { done: number; total: number; ratio: number } {
  const total = plan.sessions.length;
  const done = plan.sessions.filter((s) => s.status === 'done').length;
  return { done, total, ratio: total === 0 ? 0 : done / total };
}
