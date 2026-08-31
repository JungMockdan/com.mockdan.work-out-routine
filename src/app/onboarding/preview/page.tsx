'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CONCERN_LABEL_KO, eachDate, formatDuration } from '@/lib/engine';
import { FOCUS_LABEL, LEVEL_OPTIONS } from '@/lib/constants';
import { formatKo, shiftISO, WEEKDAY_KO, weekdayOf } from '@/lib/dates';
import { getRepository } from '@/lib/repo';
import type { StoredPlan } from '@/lib/types';
import { useOnboarding } from '@/store/onboarding';
import { Button, Card, Disclaimer, ErrorBox, Page, PageHeader, SectionTitle, Spinner, cx } from '@/components/ui';
import { PhaseBar, SessionBlocks, SessionSummaryLine } from '@/components/SessionView';

export default function PreviewPage() {
  const router = useRouter();
  const toPlanInput = useOnboarding((s) => s.toPlanInput);
  const [plan, setPlan] = useState<StoredPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const requested = useRef(false);

  const generate = useCallback(async () => {
    setError(null);
    setPlan(null);
    try {
      // 미리보기: 서버에서 엔진 실행, 저장은 하지 않음
      const p = await getRepository().createPlan(toPlanInput(), { persist: false });
      setPlan(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : '루틴 생성에 실패했습니다.');
    }
  }, [toPlanInput]);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void generate();
  }, [generate]);

  async function start() {
    if (!plan) return;
    setStarting(true);
    setError(null);
    try {
      // 같은 시드로 다시 생성·저장 → 미리보기와 동일한 루틴이 저장된다(재현성)
      await getRepository().createPlan(plan.input, { persist: true });
      router.replace('/plan');
    } catch (e) {
      setError(e instanceof Error ? e.message : '계획 저장에 실패했습니다.');
      setStarting(false);
    }
  }

  const first = plan?.sessions[0];

  return (
    <>
      <PageHeader title="생성 결과" back="/onboarding/schedule" step={{ current: 4, total: 4 }} />
      <Page
        footer={
          plan && first ? (
            <Button onClick={start} disabled={starting} full>
              {starting ? '저장 중…' : '이 계획 시작하기'}
            </Button>
          ) : undefined
        }
      >
        {error && <ErrorBox message={error} onRetry={generate} />}
        {!plan && !error && <Spinner label="40분 루틴을 조합하고 있습니다" />}

        {plan && (
          <>
            <SectionTitle
              sub={`${formatKo(plan.input.startDate, false)} ~ ${formatKo(plan.input.endDate, false)} · 주 ${plan.input.daysPerWeek}회 · 총 ${plan.sessions.length}회`}
            >
              루틴이 준비됐습니다
            </SectionTitle>

            <div className="flex flex-wrap gap-1">
              {plan.input.concerns.map((c, i) => (
                <span key={c} className="rounded-full bg-brand-light px-2.5 py-1 text-xs font-semibold text-brand-dark">
                  {i + 1}. {CONCERN_LABEL_KO[c]}
                </span>
              ))}
              <span className="rounded-full border border-line bg-white px-2.5 py-1 text-xs">
                {LEVEL_OPTIONS.find((l) => l.id === plan.input.level)?.label}
              </span>
            </div>

            {plan.warnings.length > 0 && (
              <ul className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {plan.warnings.map((w) => (
                  <li key={w}>· {w}</li>
                ))}
              </ul>
            )}

            {first ? (
              <>
                <Card className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-bold">첫 세션 · {formatKo(first.date)}</h3>
                    <span className="text-sm text-muted">목표 {formatDuration(plan.targetSec)}</span>
                  </div>
                  <SessionSummaryLine session={first} />
                  <div className="mt-3">
                    <PhaseBar blocks={first.blocks} totalSec={first.totalSec} />
                  </div>
                </Card>
                <div className="mt-3">
                  <SessionBlocks session={first} defaultOpen="all" showCues={false} />
                </div>
              </>
            ) : (
              <Card className="mt-4">
                <p className="text-sm text-danger">선택한 기간에 생성된 세션이 없습니다. 기간이나 주당 횟수를 바꿔 주세요.</p>
              </Card>
            )}

            <SectionTitle>
              <span className="mt-8 block">2주 사이클 미리보기</span>
            </SectionTitle>
            <CycleCalendar plan={plan} />

            <div className="mt-8">
              <Disclaimer />
            </div>
          </>
        )}
      </Page>
    </>
  );
}

/** 시작일부터 14일을 요일 그리드로 보여준다. */
function CycleCalendar({ plan }: { plan: StoredPlan }) {
  const start = plan.input.startDate;
  const last = shiftISO(start, 13);
  const end = plan.input.endDate < last ? plan.input.endDate : last;
  const dates = eachDate(start, end);
  const byDate = new Map(plan.sessions.map((s) => [s.date, s]));
  const leading = weekdayOf(start);

  return (
    <Card>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {WEEKDAY_KO.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: leading }, (_, i) => <span key={`pad-${i}`} />)}
        {dates.map((d) => {
          const s = byDate.get(d);
          return (
            <div
              key={d}
              className={cx(
                'flex aspect-square flex-col items-center justify-center rounded-lg text-xs',
                s ? 'bg-brand text-white' : 'bg-slate-100 text-muted',
              )}
              title={s ? `${s.sessionIndex}회차 ${FOCUS_LABEL[s.focus]}` : '휴식'}
            >
              <span className="font-semibold">{Number(d.slice(8))}</span>
              {s && <span className="text-[10px] leading-none opacity-90">{s.focus === 'upper' ? '상체' : s.focus === 'lower' ? '하체' : '전신'}</span>}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">
        1주차 → 2주차에 반복·유지 +12%, 휴식 −10%. 3주차부터는 새 조합으로 반복됩니다.
      </p>
    </Card>
  );
}
