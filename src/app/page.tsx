'use client';

import Link from 'next/link';
import { usePlan } from '@/hooks/usePlan';
import { CONCERN_LABEL_KO, formatDuration } from '@/lib/engine';
import { FOCUS_LABEL } from '@/lib/constants';
import { compareISO, formatKo, todayISO } from '@/lib/dates';
import { progressOf } from '@/lib/types';
import { Card, LinkButton, Page, ProgressBar, Spinner, ErrorBox } from '@/components/ui';

export default function HomePage() {
  const { plan, loading, error, reload } = usePlan();

  if (loading) return <Spinner />;
  if (error) return <Page><ErrorBox message={error} onRetry={reload} /></Page>;

  if (!plan) {
    return (
      <Page>
        <div className="flex min-h-[70dvh] flex-col justify-center gap-8 py-8">
          <div>
            <p className="text-sm font-semibold text-brand">모꾸 교정운동</p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight">
              내 체형에 맞는
              <br />
              40분 교정운동 루틴
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted">
              굽은 어깨 · 거북목 · 불안한 고관절 · 골반 불균형 · 대근육 강화 중 개선하고 싶은 것을 고르면
              2주 사이클 루틴을 자동으로 만들어 드립니다.
            </p>
          </div>
          <ul className="grid gap-2 text-sm text-ink">
            {[
              '이완 → 가동성 → 활성화 → 강화 → 정리, 5단계 40분',
              '보유 장비와 통증 부위를 고려한 운동 선택',
              '타이머를 따라가면 끝나는 실행 화면',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-0.5 text-brand" aria-hidden>✓</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <LinkButton href="/onboarding/concerns" full>
            시작하기
          </LinkButton>
        </div>
      </Page>
    );
  }

  const today = todayISO();
  const todaySession = plan.sessions.find((s) => s.date === today);
  const nextSession = plan.sessions.find((s) => compareISO(s.date, today) > 0 && s.status === 'planned');
  const prog = progressOf(plan);

  return (
    <Page>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{formatKo(today)}</p>
          <h1 className="text-2xl font-extrabold">오늘의 루틴</h1>
        </div>
        <Link href="/settings" aria-label="설정" className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </Link>
      </div>

      <Card className="mt-4">
        {todaySession ? (
          <>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-brand-light px-2.5 py-1 text-xs font-semibold text-brand-dark">
                {todaySession.sessionIndex}회차 · {todaySession.week}주차 · {FOCUS_LABEL[todaySession.focus]}
              </span>
              <span className="text-sm text-muted">{formatDuration(todaySession.totalSec)}</span>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {todaySession.blocks.map((b) => (
                <li key={b.phase} className="flex justify-between">
                  <span className="text-muted">{b.items.length}개 운동</span>
                  <span>{formatDuration(b.actualSec)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <LinkButton href={`/plan/${todaySession.date}`} variant="secondary">
                루틴 보기
              </LinkButton>
              {todaySession.status === 'done' ? (
                <LinkButton href={`/session/${todaySession.date}/done`} variant="ghost">
                  완료 기록 보기
                </LinkButton>
              ) : (
                <LinkButton href={`/session/${todaySession.date}`}>
                  {todaySession.status === 'in_progress' ? '이어서 하기' : '시작하기'}
                </LinkButton>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-base font-semibold">오늘은 휴식일입니다</p>
            <p className="mt-1 text-sm text-muted">
              {nextSession
                ? `다음 운동: ${formatKo(nextSession.date)} · ${FOCUS_LABEL[nextSession.focus]}`
                : '남은 운동일이 없습니다.'}
            </p>
            {nextSession && (
              <LinkButton href={`/plan/${nextSession.date}`} variant="secondary" className="mt-4" full>
                다음 루틴 미리보기
              </LinkButton>
            )}
          </>
        )}
      </Card>

      <Card className="mt-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">진도율</h2>
          <span className="text-sm text-muted">
            {prog.done} / {prog.total}회
          </span>
        </div>
        <ProgressBar ratio={prog.ratio} className="mt-2" />
        <p className="mt-2 text-xs text-muted">
          {formatKo(plan.input.startDate, false)} ~ {formatKo(plan.input.endDate, false)} · 주 {plan.input.daysPerWeek}회
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {plan.input.concerns.map((c, i) => (
            <span key={c} className="rounded-full border border-line bg-white px-2 py-0.5 text-xs">
              {i + 1}. {CONCERN_LABEL_KO[c]}
            </span>
          ))}
        </div>
        <LinkButton href="/plan" variant="ghost" className="mt-3" full>
          캘린더 열기
        </LinkButton>
      </Card>
    </Page>
  );
}
