'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { parseDate } from '@/lib/engine';
import { FOCUS_LABEL } from '@/lib/constants';
import { compareISO, formatMonthKo, todayISO, WEEKDAY_KO } from '@/lib/dates';
import { progressOf, type StoredSession } from '@/lib/types';
import { usePlan } from '@/hooks/usePlan';
import { Card, ErrorBox, LinkButton, Page, PageHeader, ProgressBar, Spinner, cx } from '@/components/ui';

export default function PlanCalendarPage() {
  const { plan, loading, error, reload } = usePlan();
  const today = todayISO();
  const [month, setMonth] = useState<{ y: number; m: number } | null>(null);

  const view = useMemo(() => {
    if (!plan) return null;
    const base = month ?? initialMonth(plan.input.startDate, plan.input.endDate, today);
    return buildMonthGrid(base.y, base.m);
  }, [plan, month, today]);

  if (loading) return <Spinner />;
  if (error)
    return (
      <>
        <PageHeader title="캘린더" back="/" />
        <Page><ErrorBox message={error} onRetry={reload} /></Page>
      </>
    );

  if (!plan || !view) {
    return (
      <>
        <PageHeader title="캘린더" back="/" />
        <Page>
          <Card>
            <p className="font-semibold">진행 중인 계획이 없습니다</p>
            <LinkButton href="/onboarding/concerns" className="mt-3" full>
              계획 만들기
            </LinkButton>
          </Card>
        </Page>
      </>
    );
  }

  const byDate = new Map(plan.sessions.map((s) => [s.date, s]));
  const restSet = new Set(plan.restDates);
  const prog = progressOf(plan);
  const { y, m } = month ?? initialMonth(plan.input.startDate, plan.input.endDate, today);

  function shiftMonth(d: number) {
    const nm = m + d;
    setMonth({ y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 });
  }

  return (
    <>
      <PageHeader title="캘린더" back="/" />
      <Page>
        <Card>
          <ProgressBar ratio={prog.ratio} label={`진도율 · ${prog.done}/${prog.total}회 완료`} />
        </Card>

        <div className="mt-4 flex items-center justify-between">
          <button type="button" aria-label="이전 달" onClick={() => shiftMonth(-1)} className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100">
            ◀
          </button>
          <h2 className="text-lg font-bold">{formatMonthKo(y, m)}</h2>
          <button type="button" aria-label="다음 달" onClick={() => shiftMonth(1)} className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100">
            ▶
          </button>
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-muted">
          {WEEKDAY_KO.map((w, i) => (
            <span key={w} className={cx(i === 0 && 'text-danger')}>{w}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {view.cells.map((iso, i) => {
            if (!iso) return <span key={`pad-${i}`} />;
            const s = byDate.get(iso);
            const isRest = restSet.has(iso);
            const isToday = iso === today;
            const inRange = iso >= plan.input.startDate && iso <= plan.input.endDate;
            const day = Number(iso.slice(8));

            const cell = (
              <div
                className={cx(
                  'relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm',
                  s ? statusStyle(s) : isRest ? 'bg-slate-100 text-slate-400' : inRange ? 'text-muted' : 'text-slate-300',
                  isToday && 'ring-2 ring-brand ring-offset-1',
                )}
              >
                <span className="font-semibold">{day}</span>
                {s && (
                  <span className="text-[10px] leading-tight opacity-90">
                    {s.status === 'done' ? '완료' : s.status === 'skipped' ? '건너뜀' : s.focus === 'upper' ? '상체' : s.focus === 'lower' ? '하체' : '전신'}
                  </span>
                )}
              </div>
            );

            return s ? (
              <Link key={iso} href={`/plan/${iso}`} aria-label={`${day}일 ${FOCUS_LABEL[s.focus]} 루틴${s.status === 'done' ? ' (완료)' : ''}`}>
                {cell}
              </Link>
            ) : (
              <span key={iso}>{cell}</span>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <LegendDot className="bg-brand" label="예정" />
          <LegendDot className="bg-emerald-500" label="완료" />
          <LegendDot className="bg-amber-400" label="진행 중" />
          <LegendDot className="bg-slate-300" label="휴식일" />
        </div>

        <UpcomingList sessions={plan.sessions} today={today} />
      </Page>
    </>
  );
}

function statusStyle(s: StoredSession): string {
  switch (s.status) {
    case 'done':
      return 'bg-emerald-500 text-white';
    case 'in_progress':
      return 'bg-amber-400 text-white';
    case 'skipped':
      return 'bg-slate-300 text-white line-through';
    default:
      return 'bg-brand text-white';
  }
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cx('size-2.5 rounded-full', className)} aria-hidden />
      {label}
    </span>
  );
}

function initialMonth(startDate: string, endDate: string, today: string): { y: number; m: number } {
  const anchor = today < startDate ? startDate : today > endDate ? endDate : today;
  return { y: Number(anchor.slice(0, 4)), m: Number(anchor.slice(5, 7)) - 1 };
}

function buildMonthGrid(y: number, m: number): { cells: Array<string | null> } {
  const first = new Date(Date.UTC(y, m, 1));
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const cells: Array<string | null> = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return { cells };
}

function UpcomingList({ sessions, today }: { sessions: StoredSession[]; today: string }) {
  const upcoming = sessions.filter((s) => compareISO(s.date, today) >= 0 && s.status !== 'done').slice(0, 3);
  if (upcoming.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="mb-2 font-bold">다가오는 세션</h3>
      <div className="grid gap-2">
        {upcoming.map((s) => (
          <Link key={s.id} href={`/plan/${s.date}`}>
            <Card className="flex items-center justify-between py-3">
              <div>
                <p className="font-semibold">
                  {Number(s.date.slice(5, 7))}월 {Number(s.date.slice(8))}일 ({WEEKDAY_KO[parseDate(s.date).getUTCDay()]})
                </p>
                <p className="text-xs text-muted">
                  {s.sessionIndex}회차 · {s.week}주차 · {FOCUS_LABEL[s.focus]}
                </p>
              </div>
              <span className="text-muted" aria-hidden>›</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
