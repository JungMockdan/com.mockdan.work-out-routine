'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDuration } from '@/lib/engine';
import { STORAGE_KEYS } from '@/lib/constants';
import { formatKo, isValidISO } from '@/lib/dates';
import { getRepository } from '@/lib/repo';
import { progressOf, type ExerciseLog, type PendingDone, type StoredPlan, type StoredSession } from '@/lib/types';
import { Button, Card, ErrorBox, LinkButton, Page, PageHeader, ProgressBar, Spinner, cx } from '@/components/ui';

export default function SessionDonePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [plan, setPlan] = useState<StoredPlan | null>(null);
  const [pending, setPending] = useState<PendingDone | null>(null);
  const [state, setState] = useState<'loading' | 'form' | 'record' | 'notfound' | 'error'>('loading');
  const [rpe, setRpe] = useState<number | null>(null);
  const [painFlag, setPainFlag] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isValidISO(date)) {
      setState('notfound');
      return;
    }
    const repo = getRepository();
    Promise.all([repo.getSession(date), repo.getCurrentPlan()])
      .then(([s, p]) => {
        setSession(s);
        setPlan(p);
        if (!s) {
          setState('notfound');
          return;
        }
        if (s.status === 'done') {
          setState('record');
          return;
        }
        try {
          const raw = localStorage.getItem(STORAGE_KEYS.pendingDone(date));
          const pd = raw ? (JSON.parse(raw) as PendingDone) : null;
          setPending(pd);
          setState(pd ? 'form' : 'notfound');
        } catch {
          setState('notfound');
        }
      })
      .catch(() => setState('error'));
  }, [date]);

  const logs: ExerciseLog[] = useMemo(() => {
    if (!session || !pending) return [];
    return session.blocks.flatMap((b) =>
      b.items.map((it) => ({
        exerciseId: it.exercise.id,
        completedSets: pending.completedSets[it.exercise.id] ?? 0,
        painFlag: false,
      })),
    );
  }, [session, pending]);

  async function save() {
    if (!session || !pending) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await getRepository().completeSession(session.id, {
        elapsedSec: pending.elapsedSec,
        rpe: rpe ?? undefined,
        painFlag,
        note: note.trim() || undefined,
        logs,
      });
      try {
        localStorage.removeItem(STORAGE_KEYS.pendingDone(date));
      } catch {
        /* noop */
      }
      setPlan(updated);
      setSession(updated.sessions.find((s) => s.id === session.id) ?? session);
      setState('record');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (state === 'loading') return <Spinner />;

  if (state === 'error' || state === 'notfound' || !session)
    return (
      <>
        <PageHeader title="세션 완료" back="/plan" />
        <Page>
          {state === 'error' ? (
            <ErrorBox message="데이터를 불러오지 못했습니다." />
          ) : (
            <Card>
              <p className="font-semibold">완료할 세션이 없습니다</p>
              <p className="mt-1 text-sm text-muted">실행 화면에서 운동을 마치면 이 화면으로 이동합니다.</p>
              <LinkButton href={`/session/${date}`} variant="secondary" className="mt-3" full>
                실행 화면으로
              </LinkButton>
            </Card>
          )}
        </Page>
      </>
    );

  /* ── 완료 기록 보기 ── */
  if (state === 'record') {
    const prog = plan ? progressOf(plan) : null;
    return (
      <>
        <PageHeader title={`${formatKo(date)} 완료`} back="/plan" />
        <Page footer={<LinkButton href="/" full>홈으로</LinkButton>}>
          <div className="py-6 text-center">
            <span className="text-5xl" aria-hidden>🎉</span>
            <h2 className="mt-3 text-2xl font-extrabold">수고했습니다!</h2>
            <p className="mt-1 text-sm text-muted">
              {session.sessionIndex}회차 · 소요 {formatDuration(session.elapsedSec ?? session.totalSec)}
            </p>
          </div>
          {session.logs && session.logs.length > 0 && (
            <Card>
              <h3 className="font-bold">기록</h3>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <dt className="text-xs text-muted">RPE</dt>
                  <dd className="font-bold">{session.logs[0]?.rpe ?? '−'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">통증</dt>
                  <dd className={cx('font-bold', session.logs.some((l) => l.painFlag) && 'text-danger')}>
                    {session.logs.some((l) => l.painFlag) ? '있음' : '없음'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">완료 세트</dt>
                  <dd className="font-bold">{session.logs.reduce((n, l) => n + l.completedSets, 0)}</dd>
                </div>
              </dl>
              {session.logs.find((l) => l.note)?.note && (
                <p className="mt-2 rounded-lg bg-surface p-2 text-sm">{session.logs.find((l) => l.note)?.note}</p>
              )}
            </Card>
          )}
          {prog && (
            <Card className="mt-3">
              <ProgressBar ratio={prog.ratio} label={`진도율 · ${prog.done}/${prog.total}회`} />
              {plan?.status === 'completed' && (
                <p className="mt-2 text-sm font-semibold text-brand">계획의 모든 세션을 마쳤습니다! 🎓</p>
              )}
            </Card>
          )}
        </Page>
      </>
    );
  }

  /* ── 완료 입력 폼 ── */
  const skippedCount = pending?.skipped.length ?? 0;
  return (
    <>
      <PageHeader title={`${formatKo(date)} 완료`} />
      <Page
        footer={
          <Button full onClick={save} disabled={saving}>
            {saving ? '저장 중…' : '완료 저장'}
          </Button>
        }
      >
        <div className="py-4 text-center">
          <span className="text-5xl" aria-hidden>💪</span>
          <h2 className="mt-3 text-2xl font-extrabold">운동 끝!</h2>
          <p className="mt-1 text-sm text-muted">
            소요 시간 {formatDuration(pending?.elapsedSec ?? 0)}
            {skippedCount > 0 && ` · ${skippedCount}개 운동 건너뜀`}
          </p>
        </div>

        {error && <ErrorBox message={error} />}

        <Card>
          <h3 className="font-bold">오늘 운동이 얼마나 힘들었나요? (RPE)</h3>
          <p className="mt-1 text-xs text-muted">1 = 매우 쉬움 · 10 = 한계</p>
          <div className="mt-3 grid grid-cols-5 gap-1.5" role="group" aria-label="자각 강도">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={rpe === n}
                onClick={() => setRpe(n)}
                className={cx(
                  'min-h-11 rounded-lg border text-sm font-semibold',
                  rpe === n ? 'border-brand bg-brand text-white' : 'border-line bg-white hover:bg-slate-50',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </Card>

        <Card className="mt-3">
          <button
            type="button"
            aria-pressed={painFlag}
            onClick={() => setPainFlag((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <span>
              <span className="block font-bold">운동 중 통증이 있었나요?</span>
              <span className="block text-xs text-muted">통증이 있었다면 다음 세션 전 강도를 낮추는 것을 권장합니다.</span>
            </span>
            <span
              className={cx(
                'relative h-7 w-12 shrink-0 rounded-full transition-colors',
                painFlag ? 'bg-danger' : 'bg-slate-300',
              )}
              aria-hidden
            >
              <span
                className={cx(
                  'absolute top-0.5 size-6 rounded-full bg-white transition-transform',
                  painFlag ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </span>
          </button>
          {painFlag && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-danger">
              통증이 반복되면 운동을 중단하고 전문의와 상담하세요. 설정에서 통증 부위를 추가하면 관련 운동이 제외됩니다.
            </p>
          )}
        </Card>

        <Card className="mt-3">
          <label className="block">
            <span className="font-bold">메모 (선택)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="컨디션, 어려웠던 운동 등"
              className="mt-2 w-full rounded-xl border border-line bg-white p-3 text-sm"
            />
          </label>
        </Card>

        <button
          type="button"
          onClick={() => router.push('/plan')}
          className="mt-3 min-h-11 w-full py-3 text-center text-xs text-muted underline"
        >
          기록 없이 나가기 (완료로 저장되지 않습니다)
        </button>
      </Page>
    </>
  );
}
