/**
 * 실행 화면의 상태 머신 (순수 모듈, DOM 의존성 0).
 *
 * 세션을 스텝 시퀀스로 펼친다:
 *   운동마다 [transition 20초] → set마다 [work] → (마지막 세트 제외) [rest]
 * durationOf()와 동일한 시간 구조라서 스텝 예상 시간의 합 = session.totalSec.
 *
 * 시간은 전부 "절대 시각(밀리초 epoch)" 기준으로 계산한다.
 * setInterval은 화면 갱신용일 뿐, 경과 시간의 근거가 아니다 (iOS Safari 백그라운드 대응).
 */
import { DEFAULT_TEMPO_SEC, TRANSITION_SEC, type Prescription, type SessionPlan } from './engine.ts';

export type StepKind = 'transition' | 'work' | 'rest';

export interface Step {
  kind: StepKind;
  blockIndex: number;
  itemIndex: number;
  /** 0부터. transition은 -1 */
  setIndex: number;
  exerciseId: string;
  /** hold형/휴식/전환: 카운트다운 초. reps형 work: null(수동 완료) */
  durationSec: number | null;
  /** 진행률·예상 종료 계산용 예상 소요 초 (reps형 포함) */
  estimatedSec: number;
  /** reps형 work의 목표 횟수 */
  reps?: number;
  perSide: boolean;
}

/** 1세트의 수행 시간(초) — durationOf()의 세트 항과 동일한 식 */
export function oneSetSec(p: Prescription): number {
  const tempo = p.tempoSec ?? DEFAULT_TEMPO_SEC;
  const oneSet = p.holdSec ?? (p.reps ?? 10) * tempo;
  return p.perSide ? oneSet * 2 : oneSet;
}

/** 세션 전체를 스텝 목록으로 펼친다. */
export function buildSteps(session: SessionPlan): Step[] {
  const steps: Step[] = [];
  session.blocks.forEach((block, blockIndex) => {
    block.items.forEach((item, itemIndex) => {
      const p = item.prescription;
      const ex = item.exercise;
      steps.push({
        kind: 'transition',
        blockIndex,
        itemIndex,
        setIndex: -1,
        exerciseId: ex.id,
        durationSec: TRANSITION_SEC,
        estimatedSec: TRANSITION_SEC,
        perSide: Boolean(p.perSide),
      });
      const setSec = oneSetSec(p);
      const isHold = p.holdSec != null;
      for (let s = 0; s < p.sets; s++) {
        steps.push({
          kind: 'work',
          blockIndex,
          itemIndex,
          setIndex: s,
          exerciseId: ex.id,
          durationSec: isHold ? setSec : null,
          estimatedSec: setSec,
          reps: isHold ? undefined : (p.reps ?? 10),
          perSide: Boolean(p.perSide),
        });
        if (s < p.sets - 1 && p.restSec > 0) {
          steps.push({
            kind: 'rest',
            blockIndex,
            itemIndex,
            setIndex: s,
            exerciseId: ex.id,
            durationSec: p.restSec,
            estimatedSec: p.restSec,
            perSide: false,
          });
        }
      }
    });
  });
  return steps;
}

export interface RunnerState {
  stepIndex: number;
  /** 현재 스텝 시작 시각(epoch ms). 일시정지 보정 반영됨 */
  stepStartedAt: number;
  /** null이면 진행 중, 값이 있으면 그 시각부터 일시정지 */
  pausedAt: number | null;
  /** 지나간 스텝들의 예상 소요 합(초) — 진행률 계산용 */
  completedEstimatedSec: number;
  /** 지나간 스텝들의 실제 소요 합(초) — 완료 기록(elapsedSec)용. 일시정지 시간 제외 */
  actualElapsedSec: number;
  /** 운동별 완료 세트 수 */
  completedSets: Record<string, number>;
  /** 건너뛴 운동 id */
  skipped: string[];
  finished: boolean;
}

export function initialState(now: number, stepIndex = 0): RunnerState {
  return {
    stepIndex,
    stepStartedAt: now,
    pausedAt: null,
    completedEstimatedSec: 0,
    actualElapsedSec: 0,
    completedSets: {},
    skipped: [],
    finished: false,
  };
}

/** 현재 스텝에서 흐른 시간(초). 일시정지 중이면 정지 시점 기준. */
export function stepElapsedSec(st: RunnerState, now: number): number {
  const end = st.pausedAt ?? now;
  return Math.max(0, (end - st.stepStartedAt) / 1000);
}

/** 카운트다운 스텝의 남은 초 (reps 스텝은 null) */
export function stepRemainingSec(steps: Step[], st: RunnerState, now: number): number | null {
  const step = steps[st.stepIndex];
  if (!step || step.durationSec == null) return null;
  return Math.max(0, step.durationSec - stepElapsedSec(st, now));
}

function creditSet(st: RunnerState, step: Step): void {
  if (step.kind === 'work') {
    st.completedSets = {
      ...st.completedSets,
      [step.exerciseId]: (st.completedSets[step.exerciseId] ?? 0) + 1,
    };
  }
}

/** 다음 스텝으로. 마지막이면 finished. (불변 아님 — 호출측에서 복사본에 사용) */
function advanceInPlace(steps: Step[], st: RunnerState, now: number, credit: boolean): void {
  const step = steps[st.stepIndex];
  if (!step) return;
  if (credit) creditSet(st, step);
  st.completedEstimatedSec += step.estimatedSec;
  st.actualElapsedSec += Math.max(0, (now - st.stepStartedAt) / 1000);
  if (st.stepIndex + 1 >= steps.length) {
    st.finished = true;
    st.stepIndex = steps.length;
  } else {
    st.stepIndex += 1;
  }
  st.stepStartedAt = now;
}

/**
 * 절대 시각 기준 동기화: 백그라운드에 오래 있었어도 카운트다운 스텝들을
 * 실제 흐른 시간만큼 연쇄적으로 넘긴다. reps 스텝에서 멈춘다.
 */
export function syncToNow(steps: Step[], prev: RunnerState, now: number): RunnerState {
  if (prev.finished || prev.pausedAt != null) return prev;
  const st: RunnerState = { ...prev };
  let advanced = false;
  let guard = steps.length + 4;
  while (!st.finished && guard-- > 0) {
    const step = steps[st.stepIndex];
    if (!step || step.durationSec == null) break; // reps형: 수동 완료 대기
    const endAt = st.stepStartedAt + step.durationSec * 1000;
    if (now < endAt) break;
    // 이 스텝은 endAt에 끝났다 — 다음 스텝은 endAt부터 시작한 것으로 계산
    creditSet(st, step);
    st.completedEstimatedSec += step.estimatedSec;
    st.actualElapsedSec += step.durationSec;
    advanced = true;
    if (st.stepIndex + 1 >= steps.length) {
      st.finished = true;
      st.stepIndex = steps.length;
      st.stepStartedAt = endAt;
    } else {
      st.stepIndex += 1;
      st.stepStartedAt = endAt;
    }
  }
  // 아무 스텝도 넘기지 않았으면 참조를 유지해 불필요한 리렌더/저장을 막는다
  return advanced ? st : prev;
}

/** reps형 work의 수동 완료 (또는 카운트다운 스텝 조기 완료) */
export function completeStep(steps: Step[], prev: RunnerState, now: number): RunnerState {
  if (prev.finished) return prev;
  const st = { ...prev };
  advanceInPlace(steps, st, now, true);
  return st;
}

/** 현재 운동 전체 건너뛰기: 이 운동의 남은 스텝을 모두 지나간다. */
export function skipExercise(steps: Step[], prev: RunnerState, now: number): RunnerState {
  if (prev.finished) return prev;
  const st = { ...prev };
  const target = steps[st.stepIndex];
  if (!target) return prev;
  if (!st.skipped.includes(target.exerciseId)) st.skipped = [...st.skipped, target.exerciseId];
  let guard = steps.length + 4;
  while (!st.finished && guard-- > 0) {
    const cur = steps[st.stepIndex];
    if (!cur || cur.blockIndex !== target.blockIndex || cur.itemIndex !== target.itemIndex) break;
    advanceInPlace(steps, st, now, false);
  }
  return st;
}

export function pause(prev: RunnerState, now: number): RunnerState {
  if (prev.pausedAt != null || prev.finished) return prev;
  return { ...prev, pausedAt: now };
}

export function resume(prev: RunnerState, now: number): RunnerState {
  if (prev.pausedAt == null) return prev;
  // 정지해 있던 시간만큼 스텝 시작 시각을 뒤로 민다
  return { ...prev, pausedAt: null, stepStartedAt: prev.stepStartedAt + (now - prev.pausedAt) };
}

/** 세션 전체 경과(초) 추정: 지나간 스텝 예상 합 + 현재 스텝 경과 */
export function totalElapsedSec(steps: Step[], st: RunnerState, now: number): number {
  const cur = steps[st.stepIndex];
  const curElapsed = st.finished || !cur ? 0 : Math.min(stepElapsedSec(st, now), cur.estimatedSec * 3);
  return st.completedEstimatedSec + curElapsed;
}

/** 남은 예상 시간(초) → 예상 종료 시각 계산에 사용 */
export function remainingEstimatedSec(steps: Step[], st: RunnerState, now: number): number {
  if (st.finished) return 0;
  let rest = 0;
  for (let i = st.stepIndex + 1; i < steps.length; i++) rest += steps[i].estimatedSec;
  const cur = steps[st.stepIndex];
  if (cur) {
    if (cur.durationSec != null) rest += Math.max(0, cur.durationSec - stepElapsedSec(st, now));
    else rest += Math.max(0, cur.estimatedSec - stepElapsedSec(st, now));
  }
  return rest;
}

/** 다음 '운동'(work가 있는 다음 아이템)의 첫 work 스텝 인덱스 */
export function nextExerciseStepIndex(steps: Step[], st: RunnerState): number | null {
  const cur = steps[st.stepIndex];
  if (!cur) return null;
  for (let i = st.stepIndex + 1; i < steps.length; i++) {
    const s = steps[i];
    if ((s.blockIndex !== cur.blockIndex || s.itemIndex !== cur.itemIndex) && s.kind === 'work') return i;
  }
  return null;
}
