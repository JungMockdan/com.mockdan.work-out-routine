'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PHASE_LABEL_KO, formatDuration, prescriptionLabel } from '@/lib/engine';
import { STORAGE_KEYS } from '@/lib/constants';
import { formatClock, formatKo, formatMMSS, isValidISO } from '@/lib/dates';
import { getRepository } from '@/lib/repo';
import type { PendingDone, SessionProgress, StoredSession } from '@/lib/types';
import {
  buildSteps,
  completeStep,
  initialState,
  nextExerciseStepIndex,
  pause,
  remainingEstimatedSec,
  resume,
  skipExercise,
  stepRemainingSec,
  syncToNow,
  totalElapsedSec,
  type RunnerState,
  type Step,
} from '@/lib/session-runner';
import { useWakeLock } from '@/hooks/useWakeLock';
import { Button, Card, Disclaimer, ErrorBox, LinkButton, Page, PageHeader, Spinner, cx } from '@/components/ui';
import { PhaseBadge } from '@/components/SessionView';

export default function SessionRunPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [state, setState] = useState<'loading' | 'intro' | 'running' | 'notfound' | 'error'>('loading');
  const [savedProgress, setSavedProgress] = useState<SessionProgress | null>(null);

  useEffect(() => {
    if (!isValidISO(date)) {
      setState('notfound');
      return;
    }
    getRepository()
      .getSession(date)
      .then((s) => {
        setSession(s);
        if (!s) {
          setState('notfound');
          return;
        }
        try {
          const raw = localStorage.getItem(STORAGE_KEYS.progress(date));
          setSavedProgress(raw ? (JSON.parse(raw) as SessionProgress) : null);
        } catch {
          setSavedProgress(null);
        }
        setState('intro');
      })
      .catch(() => setState('error'));
  }, [date]);

  if (state === 'loading') return <Spinner />;
  if (state === 'error' || state === 'notfound' || !session)
    return (
      <>
        <PageHeader title="루틴 실행" back="/plan" />
        <Page>
          {state === 'error' ? (
            <ErrorBox message="세션을 불러오지 못했습니다." />
          ) : (
            <Card>
              <p className="font-semibold">이 날짜에는 루틴이 없습니다</p>
              <LinkButton href="/plan" variant="secondary" className="mt-3" full>
                캘린더로
              </LinkButton>
            </Card>
          )}
        </Page>
      </>
    );

  if (session.status === 'done')
    return (
      <>
        <PageHeader title={formatKo(date)} back="/plan" />
        <Page>
          <Card>
            <p className="font-semibold">이미 완료한 세션입니다</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <LinkButton href={`/session/${date}/done`} variant="secondary">
                완료 기록
              </LinkButton>
              <LinkButton href="/plan">캘린더</LinkButton>
            </div>
          </Card>
        </Page>
      </>
    );

  if (state === 'intro')
    return <Intro session={session} saved={savedProgress} onStart={() => setState('running')} />;

  return <Runner session={session} saved={savedProgress} />;
}

/* ───────────────────────── 시작 화면 (면책 고지 필수) ───────────────────────── */

function Intro({
  session,
  saved,
  onStart,
}: {
  session: StoredSession;
  saved: SessionProgress | null;
  onStart: () => void;
}) {
  const exercises = session.blocks.reduce((n, b) => n + b.items.length, 0);
  return (
    <>
      <PageHeader title={formatKo(session.date)} back={`/plan/${session.date}`} />
      <Page
        footer={
          <Button full onClick={onStart}>
            {saved ? '이어서 하기' : '운동 시작'}
          </Button>
        }
      >
        <Card>
          <h2 className="text-lg font-bold">
            {session.sessionIndex}회차 · {session.week}주차
          </h2>
          <p className="mt-1 text-sm text-muted">
            {exercises}개 운동 · 총 {formatDuration(session.totalSec)}
          </p>
          {saved && (
            <p className="mt-2 rounded-lg bg-brand-light/60 px-3 py-2 text-sm text-brand-dark">
              중단한 지점부터 이어서 시작합니다. (저장: {new Date(saved.savedAt).toLocaleString('ko-KR')})
            </p>
          )}
        </Card>
        <ul className="mt-4 grid gap-2 text-sm text-muted">
          <li>· 화면이 꺼지지 않도록 유지됩니다.</li>
          <li>· 유지형 운동은 자동 카운트다운, 반복형 운동은 세트를 마친 뒤 버튼을 누르세요.</li>
          <li>· 언제든 일시정지·중단할 수 있고, 중단해도 진행 상황이 저장됩니다.</li>
        </ul>
        <div className="mt-6">
          <Disclaimer />
        </div>
      </Page>
    </>
  );
}

/* ───────────────────────── 실행 화면 본체 ───────────────────────── */

function Runner({ session, saved }: { session: StoredSession; saved: SessionProgress | null }) {
  const router = useRouter();
  const steps = useMemo(() => buildSteps(session), [session]);
  const wake = useWakeLock();

  const [runner, setRunner] = useState<RunnerState>(() => {
    const now = Date.now();
    if (saved && saved.sessionId === session.id && saved.stepIndex < steps.length) {
      return {
        stepIndex: saved.stepIndex,
        stepStartedAt: now - saved.stepElapsedSec * 1000,
        pausedAt: null,
        completedEstimatedSec: saved.completedEstimatedSec,
        completedSets: saved.completedSets,
        skipped: saved.skipped,
        finished: false,
      };
    }
    return initialState(now);
  });
  const [now, setNow] = useState(() => Date.now());
  const [confirmQuit, setConfirmQuit] = useState(false);
  const startedRef = useRef(false);

  // 시작 처리: wake lock + 상태 in_progress
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void wake.enable();
    void getRepository().setSessionStatus(session.id, 'in_progress');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 틱: 화면 갱신용. 경과 시간의 근거는 절대 시각(Date.now)이다.
  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      setRunner((prev) => syncToNow(steps, prev, n));
    }, 250);
    return () => clearInterval(t);
  }, [steps]);

  // 백그라운드 복귀 시 즉시 절대 시각 기준 재계산 (iOS Safari 대응)
  useEffect(() => {
    function onVisibility() {
      const n = Date.now();
      setNow(n);
      setRunner((prev) => syncToNow(steps, prev, n));
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [steps]);

  const persistProgress = useCallback(
    (st: RunnerState, at: number) => {
      try {
        const cur = steps[st.stepIndex];
        const p: SessionProgress = {
          sessionId: session.id,
          date: session.date,
          stepIndex: st.stepIndex,
          stepElapsedSec: cur ? Math.max(0, ((st.pausedAt ?? at) - st.stepStartedAt) / 1000) : 0,
          completedEstimatedSec: st.completedEstimatedSec,
          completedSets: st.completedSets,
          skipped: st.skipped,
          savedAt: new Date(at).toISOString(),
        };
        localStorage.setItem(STORAGE_KEYS.progress(session.date), JSON.stringify(p));
      } catch {
        /* 저장 실패는 치명적이지 않다 */
      }
    },
    [steps, session.id, session.date],
  );

  // 주기 저장 + 이탈 시 저장
  useEffect(() => {
    if (runner.finished) return;
    persistProgress(runner, Date.now());
  }, [runner.stepIndex, runner.pausedAt, runner.finished, persistProgress, runner]);
  useEffect(() => {
    function onHideOrUnload() {
      setRunner((prev) => {
        if (!prev.finished) persistProgress(prev, Date.now());
        return prev;
      });
    }
    window.addEventListener('pagehide', onHideOrUnload);
    return () => window.removeEventListener('pagehide', onHideOrUnload);
  }, [persistProgress]);

  // 종료 → 완료 화면으로
  useEffect(() => {
    if (!runner.finished) return;
    const elapsed = Math.round(totalElapsedSec(steps, runner, Date.now()));
    const pending: PendingDone = {
      sessionId: session.id,
      date: session.date,
      elapsedSec: elapsed,
      completedSets: runner.completedSets,
      skipped: runner.skipped,
    };
    try {
      localStorage.setItem(STORAGE_KEYS.pendingDone(session.date), JSON.stringify(pending));
      localStorage.removeItem(STORAGE_KEYS.progress(session.date));
    } catch {
      /* noop */
    }
    wake.disable();
    router.replace(`/session/${session.date}/done`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner.finished]);

  const step: Step | undefined = steps[runner.stepIndex];
  if (runner.finished || !step) return <Spinner label="세션을 마무리하는 중" />;

  const block = session.blocks[step.blockIndex];
  const item = block.items[step.itemIndex];
  const ex = item.exercise;
  const paused = runner.pausedAt != null;
  const remaining = stepRemainingSec(steps, runner, now);
  const totalRatio = Math.min(1, totalElapsedSec(steps, runner, now) / Math.max(1, session.totalSec));
  const eta = new Date(now + remainingEstimatedSec(steps, runner, now) * 1000);
  const nextIdx = nextExerciseStepIndex(steps, runner);
  const nextStep = nextIdx != null ? steps[nextIdx] : null;
  const nextItem = nextStep ? session.blocks[nextStep.blockIndex].items[nextStep.itemIndex] : null;

  function act(fn: (steps: Step[], st: RunnerState, now: number) => RunnerState) {
    const n = Date.now();
    setNow(n);
    setRunner((prev) => fn(steps, prev, n));
  }

  function quit() {
    const n = Date.now();
    setRunner((prev) => {
      const st = prev.pausedAt == null ? pause(prev, n) : prev;
      persistProgress(st, n);
      return st;
    });
    wake.disable();
    router.push(`/plan/${session.date}`);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* 상단: 진행 바 + 예상 종료 */}
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 px-4 pb-2 pt-3 backdrop-blur">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            {Math.round(totalRatio * 100)}% · {formatMMSS(totalElapsedSec(steps, runner, now))} /{' '}
            {formatDuration(session.totalSec)}
          </span>
          <span>예상 종료 {formatClock(eta)}</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(totalRatio * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${totalRatio * 100}%` }} />
        </div>
      </header>

      <main className="flex flex-1 flex-col px-4 py-4">
        <div className="flex items-center justify-between">
          <PhaseBadge phase={block.phase} />
          <span className="text-xs text-muted">{PHASE_LABEL_KO[block.phase]} · {step.itemIndex + 1}/{block.items.length}</span>
        </div>

        {/* 현재 스텝 */}
        <div className="mt-4 flex flex-1 flex-col items-center justify-center text-center">
          {step.kind === 'transition' && (
            <>
              <p className="text-sm font-semibold text-muted">다음 운동 준비</p>
              <h2 className="mt-2 text-2xl font-extrabold">{ex.nameKo}</h2>
              <p className="text-sm text-muted">{ex.nameEn}</p>
              <p className="mt-1 text-sm">{prescriptionLabel(item.prescription)}</p>
              <CountDown sec={remaining ?? 0} tone="prep" />
            </>
          )}

          {step.kind === 'work' && (
            <>
              <h2 className="text-2xl font-extrabold">{ex.nameKo}</h2>
              <p className="mt-1 text-sm font-semibold text-brand">
                {step.setIndex + 1} / {item.prescription.sets} 세트
                {step.perSide && ' · 좌우 각각'}
              </p>
              {step.durationSec != null ? (
                <CountDown sec={remaining ?? 0} tone="work" />
              ) : (
                <div className="my-6">
                  <p className="text-6xl font-extrabold tabular-nums">{step.reps}회</p>
                  <p className="mt-2 text-sm text-muted">본인 속도로 수행한 뒤 버튼을 누르세요</p>
                </div>
              )}
            </>
          )}

          {step.kind === 'rest' && (
            <>
              <p className="text-sm font-semibold text-muted">휴식</p>
              <CountDown sec={remaining ?? 0} tone="rest" />
              <p className="text-sm text-muted">
                다음: {step.setIndex + 2}세트 / {item.prescription.sets}세트
              </p>
            </>
          )}

          {/* 수행 큐 */}
          {step.kind !== 'rest' && ex.cues.length > 0 && (
            <ul className="mt-6 w-full max-w-sm space-y-1.5 rounded-2xl border border-line bg-white p-4 text-left text-sm">
              {ex.cues.map((c) => (
                <li key={c} className="flex gap-2">
                  <span className="text-brand" aria-hidden>•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 다음 운동 프리뷰 */}
        {nextItem && (
          <Card className="mt-4 flex items-center gap-3 py-3">
            <span className="text-xs font-semibold text-muted">다음</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{nextItem.exercise.nameKo}</p>
              <p className="text-xs text-muted">{prescriptionLabel(nextItem.prescription)}</p>
            </div>
            <PhaseBadge phase={session.blocks[nextStep!.blockIndex].phase} />
          </Card>
        )}
      </main>

      {/* 하단 컨트롤 */}
      <footer className="sticky bottom-0 border-t border-line bg-surface/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        {confirmQuit ? (
          <div className="grid gap-2">
            <p className="text-center text-sm">중단할까요? 진행 상황은 저장됩니다.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setConfirmQuit(false)}>
                계속하기
              </Button>
              <Button variant="danger" onClick={quit}>
                중단하기
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            {step.kind === 'work' && step.durationSec == null ? (
              <Button onClick={() => act(completeStep)} disabled={paused}>
                세트 완료
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => act(completeStep)} disabled={paused}>
                {step.kind === 'work' ? '이 세트 끝냄' : '건너뛰고 바로 시작'}
              </Button>
            )}
            <Button variant="secondary" aria-label={paused ? '재개' : '일시정지'} onClick={() => act((s, st, n) => (paused ? resume(st, n) : pause(st, n)))}>
              {paused ? '▶ 재개' : '⏸'}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmQuit(true)} aria-label="중단">
              중단
            </Button>
          </div>
        )}
        {!confirmQuit && (
          <button
            type="button"
            onClick={() => act(skipExercise)}
            disabled={paused}
            className="mt-2 w-full text-center text-xs text-muted underline disabled:opacity-50"
          >
            이 운동 건너뛰기 (통증이 있으면 건너뛰세요)
          </button>
        )}
        {paused && <p className="mt-2 text-center text-xs font-semibold text-warn">일시정지됨</p>}
        {wake.method === 'none' && (
          <p className="mt-1 text-center text-[11px] text-muted">화면 자동 꺼짐 방지를 사용할 수 없는 브라우저입니다.</p>
        )}
      </footer>
    </div>
  );
}

function CountDown({ sec, tone }: { sec: number; tone: 'work' | 'rest' | 'prep' }) {
  return (
    <p
      className={cx(
        'my-6 text-7xl font-extrabold tabular-nums',
        tone === 'work' ? 'text-ink' : tone === 'rest' ? 'text-brand' : 'text-muted',
      )}
      role="timer"
      aria-live="off"
    >
      {formatMMSS(sec)}
    </p>
  );
}
