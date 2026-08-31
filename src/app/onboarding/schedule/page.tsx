'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { eachDate, weekdayPattern } from '@/lib/engine';
import { DAYS_PER_WEEK_OPTIONS } from '@/lib/constants';
import { isValidISO, shiftISO, todayISO, weekdayOf } from '@/lib/dates';
import { useOnboarding } from '@/store/onboarding';
import { Button, Card, Page, PageHeader, SectionTitle, cx } from '@/components/ui';

const DURATION_PRESETS = [
  { weeks: 2, label: '2주' },
  { weeks: 4, label: '4주' },
  { weeks: 8, label: '8주' },
  { weeks: 12, label: '12주' },
];

export default function SchedulePage() {
  const router = useRouter();
  const startDate = useOnboarding((s) => s.startDate);
  const endDate = useOnboarding((s) => s.endDate);
  const daysPerWeek = useOnboarding((s) => s.daysPerWeek);
  const sessionMinutes = useOnboarding((s) => s.sessionMinutes);
  const setSchedule = useOnboarding((s) => s.setSchedule);

  // 저장돼 있던 시작일이 과거면 오늘로 당긴다 (persist 복원 직후 포함)
  useEffect(() => {
    const today = todayISO();
    if (isValidISO(startDate) && startDate < today) {
      const patch: { startDate: string; endDate?: string } = { startDate: today };
      if (!isValidISO(endDate) || endDate < today) patch.endDate = shiftISO(today, 27);
      setSchedule(patch);
    }
  }, [startDate, endDate, setSchedule]);

  const valid = isValidISO(startDate) && isValidISO(endDate) && endDate >= startDate;
  const summary = useMemo(() => {
    if (!valid) return null;
    const dates = eachDate(startDate, endDate);
    const pattern = new Set(weekdayPattern(daysPerWeek));
    const sessions = dates.filter((d) => pattern.has(weekdayOf(d))).length;
    return { days: dates.length, sessions, cycles: Math.ceil(dates.length / 14) };
  }, [valid, startDate, endDate, daysPerWeek]);

  const errorMsg = !isValidISO(startDate) || !isValidISO(endDate)
    ? '날짜를 입력하세요.'
    : endDate < startDate
      ? '종료일이 시작일보다 빠릅니다.'
      : summary && summary.sessions === 0
        ? '선택한 기간에 운동 요일이 없습니다.'
        : summary && summary.days < 14
          ? '기간이 2주보다 짧아 사이클이 중간에 끝납니다.'
          : null;
  const blocking = !valid || (summary?.sessions ?? 0) === 0;

  return (
    <>
      <PageHeader title="기간 설정" back="/onboarding/profile" step={{ current: 3, total: 4 }} />
      <Page footer={<Button full disabled={blocking} onClick={() => router.push('/onboarding/preview')}>루틴 생성하기</Button>}>
        <SectionTitle sub="2주를 한 사이클로 반복합니다. 4주 이상을 권장합니다.">언제부터 언제까지 하나요?</SectionTitle>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">시작일</span>
            <input
              type="date"
              value={startDate}
              min={todayISO()}
              onChange={(e) => setSchedule({ startDate: e.target.value })}
              className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">종료일</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setSchedule({ endDate: e.target.value })}
              className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base"
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {DURATION_PRESETS.map((p) => (
            <button
              key={p.weeks}
              type="button"
              onClick={() => isValidISO(startDate) && setSchedule({ endDate: shiftISO(startDate, p.weeks * 7 - 1) })}
              className="min-h-9 rounded-full border border-line bg-white px-3 text-sm hover:bg-slate-50"
            >
              {p.label}
            </button>
          ))}
        </div>

        <SectionTitle sub="요일은 횟수에 따라 자동으로 정해집니다.">
          <span className="mt-8 block">주당 운동 횟수</span>
        </SectionTitle>
        <div role="group" aria-label="주당 횟수" className="grid grid-cols-2 gap-2">
          {DAYS_PER_WEEK_OPTIONS.map((o) => {
            const on = daysPerWeek === o.id;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                onClick={() => setSchedule({ daysPerWeek: o.id })}
                className={cx(
                  'rounded-2xl border p-3 text-left transition-colors',
                  on ? 'border-brand bg-brand-light/50' : 'border-line bg-white hover:bg-slate-50',
                )}
              >
                <span className="block font-semibold">{o.label}</span>
                <span className="block text-xs text-muted">{o.days}</span>
              </button>
            );
          })}
        </div>

        <SectionTitle sub="기본 40분. 이 시간 안에 5단계 루틴이 맞춰집니다.">
          <span className="mt-8 block">1회 세션 시간</span>
        </SectionTitle>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="5분 줄이기"
            disabled={sessionMinutes <= 20}
            onClick={() => setSchedule({ sessionMinutes: sessionMinutes - 5 })}
            className="flex size-12 items-center justify-center rounded-xl border border-line bg-white text-xl disabled:text-slate-300"
          >
            −
          </button>
          <div className="flex-1 text-center" role="status" aria-live="polite">
            <span className="text-3xl font-extrabold">{sessionMinutes}</span>
            <span className="ml-1 text-muted">분</span>
          </div>
          <button
            type="button"
            aria-label="5분 늘리기"
            disabled={sessionMinutes >= 90}
            onClick={() => setSchedule({ sessionMinutes: sessionMinutes + 5 })}
            className="flex size-12 items-center justify-center rounded-xl border border-line bg-white text-xl disabled:text-slate-300"
          >
            +
          </button>
        </div>
        {sessionMinutes !== 40 && (
          <button type="button" onClick={() => setSchedule({ sessionMinutes: 40 })} className="mt-2 text-sm text-brand underline">
            기본값(40분)으로
          </button>
        )}

        <Card className="mt-8">
          {summary && !blocking ? (
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-xs text-muted">기간</dt>
                <dd className="text-lg font-bold">{summary.days}일</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">총 세션</dt>
                <dd className="text-lg font-bold">{summary.sessions}회</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">사이클</dt>
                <dd className="text-lg font-bold">{summary.cycles}회</dd>
              </div>
            </dl>
          ) : null}
          {errorMsg && (
            <p role={blocking ? 'alert' : 'status'} className={cx('text-sm', blocking ? 'text-danger' : 'mt-2 text-warn')}>
              {errorMsg}
            </p>
          )}
        </Card>
      </Page>
    </>
  );
}
