'use client';

import { use, useEffect, useState } from 'react';
import { formatDuration } from '@/lib/engine';
import { FOCUS_LABEL, STORAGE_KEYS } from '@/lib/constants';
import { formatKo, isValidISO, todayISO } from '@/lib/dates';
import { getRepository } from '@/lib/repo';
import type { StoredSession } from '@/lib/types';
import { Card, ErrorBox, LinkButton, Page, PageHeader, Spinner, cx } from '@/components/ui';
import { PhaseBar, SessionBlocks, SessionSummaryLine } from '@/components/SessionView';

export default function SessionDetailPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [hasProgress, setHasProgress] = useState(false);

  useEffect(() => {
    if (!isValidISO(date)) {
      setState('notfound');
      return;
    }
    getRepository()
      .getSession(date)
      .then((s) => {
        setSession(s);
        setState(s ? 'ready' : 'notfound');
        try {
          setHasProgress(s != null && localStorage.getItem(STORAGE_KEYS.progress(date)) != null);
        } catch {
          /* noop */
        }
      })
      .catch(() => setState('error'));
  }, [date]);

  const title = isValidISO(date) ? formatKo(date) : '루틴 상세';

  if (state === 'loading')
    return (
      <>
        <PageHeader title={title} back="/plan" />
        <Spinner />
      </>
    );

  if (state === 'error' || state === 'notfound' || !session)
    return (
      <>
        <PageHeader title={title} back="/plan" />
        <Page>
          {state === 'error' ? (
            <ErrorBox message="세션을 불러오지 못했습니다." />
          ) : (
            <Card>
              <p className="font-semibold">이 날짜에는 루틴이 없습니다</p>
              <p className="mt-1 text-sm text-muted">휴식일이거나 계획 범위 밖의 날짜입니다.</p>
              <LinkButton href="/plan" variant="secondary" className="mt-3" full>
                캘린더로
              </LinkButton>
            </Card>
          )}
        </Page>
      </>
    );

  const today = todayISO();
  const isDone = session.status === 'done';
  const isFuture = session.date > today;

  return (
    <>
      <PageHeader title={title} back="/plan" />
      <Page
        footer={
          isDone ? (
            <LinkButton href={`/session/${date}/done`} variant="secondary" full>
              완료 기록 보기
            </LinkButton>
          ) : (
            <div className="grid gap-1">
              {isFuture && <p className="text-center text-xs text-muted">예정된 세션입니다. 미리 시작할 수도 있습니다.</p>}
              <LinkButton href={`/session/${date}`} full>
                {session.status === 'in_progress' || hasProgress ? '이어서 하기' : '이 루틴 시작하기'}
              </LinkButton>
            </div>
          )
        }
      >
        <Card>
          <div className="flex items-center justify-between">
            <span
              className={cx(
                'rounded-full px-2.5 py-1 text-xs font-semibold',
                isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-brand-light text-brand-dark',
              )}
            >
              {isDone ? '완료됨' : session.status === 'in_progress' ? '진행 중' : '예정'}
            </span>
            <span className="text-sm text-muted">총 {formatDuration(session.totalSec)}</span>
          </div>
          <h2 className="mt-2 text-lg font-bold">
            {session.sessionIndex}회차 · {session.week}주차 · {FOCUS_LABEL[session.focus]}
          </h2>
          <SessionSummaryLine session={session} />
          <div className="mt-3">
            <PhaseBar blocks={session.blocks} totalSec={session.totalSec} />
          </div>
          {session.week === 2 && (
            <p className="mt-2 text-xs text-muted">2주차: 반복·유지 +12%, 휴식 −10%가 적용된 처방입니다.</p>
          )}
        </Card>

        <div className="mt-3">
          <SessionBlocks session={session} defaultOpen="all" showCues />
        </div>
      </Page>
    </>
  );
}
