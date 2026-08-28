'use client';

import { useState } from 'react';
import {
  PHASE_LABEL_KO,
  formatDuration,
  prescriptionLabel,
  type Block,
  type PlannedExercise,
  type SessionPlan,
} from '@/lib/engine';
import { EQUIPMENT_LABEL, FOCUS_LABEL } from '@/lib/constants';
import { cx } from './ui';

const PHASE_COLOR: Record<Block['phase'], string> = {
  release: 'bg-sky-100 text-sky-800',
  mobility: 'bg-violet-100 text-violet-800',
  activation: 'bg-amber-100 text-amber-800',
  strength: 'bg-rose-100 text-rose-800',
  integration: 'bg-emerald-100 text-emerald-800',
};

export function PhaseBadge({ phase }: { phase: Block['phase'] }) {
  return (
    <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', PHASE_COLOR[phase])}>
      {PHASE_LABEL_KO[phase]}
    </span>
  );
}

export function SessionSummaryLine({ session }: { session: SessionPlan }) {
  return (
    <p className="text-sm text-muted">
      {session.sessionIndex}회차 · {session.week}주차 · {FOCUS_LABEL[session.focus]} · 총{' '}
      <span className="font-semibold text-ink">{formatDuration(session.totalSec)}</span>
      {session.deltaSec !== 0 && (
        <span className="ml-1 text-xs">
          (목표 대비 {session.deltaSec > 0 ? '+' : '−'}{Math.abs(session.deltaSec)}초)
        </span>
      )}
    </p>
  );
}

/** 페이즈별 시간 배분 막대 */
export function PhaseBar({ blocks, totalSec }: { blocks: Block[]; totalSec: number }) {
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full" aria-hidden>
      {blocks.map((b) => (
        <span
          key={b.phase}
          className={cx(PHASE_COLOR[b.phase].split(' ')[0])}
          style={{ width: `${(b.actualSec / Math.max(1, totalSec)) * 100}%` }}
        />
      ))}
    </div>
  );
}

export function ExerciseCard({
  item,
  index,
  showCues = true,
  status,
}: {
  item: PlannedExercise;
  index?: number;
  showCues?: boolean;
  status?: 'done' | 'skipped' | 'current';
}) {
  const ex = item.exercise;
  const gear = ex.equipment.filter((e) => e !== 'none' && e !== 'mat');
  return (
    <div
      className={cx(
        'rounded-xl border bg-white p-3',
        status === 'current' ? 'border-brand' : status === 'done' ? 'border-emerald-200 bg-emerald-50/40' : 'border-line',
        status === 'skipped' && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2">
        {index != null && (
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-muted">
            {index}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="truncate font-semibold">{ex.nameKo}</h4>
            <span className="shrink-0 text-sm text-muted">{formatDuration(item.durationSec)}</span>
          </div>
          <p className="text-xs text-muted">{ex.nameEn}</p>
          <p className="mt-1 text-sm">{prescriptionLabel(item.prescription)}</p>
          {gear.length > 0 && (
            <p className="mt-1 text-xs text-muted">장비: {gear.map((g) => EQUIPMENT_LABEL[g]).join(', ')}</p>
          )}
          {showCues && ex.cues.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-line pt-2 text-sm text-ink/90">
              {ex.cues.map((c) => (
                <li key={c} className="flex gap-1.5">
                  <span className="text-brand" aria-hidden>•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {status === 'done' && <span className="text-emerald-600" aria-label="완료">✓</span>}
        {status === 'skipped' && <span className="text-xs text-muted">건너뜀</span>}
      </div>
    </div>
  );
}

/** 페이즈별 아코디언으로 세션 전체를 보여준다. */
export function SessionBlocks({
  session,
  defaultOpen = 'first',
  showCues = true,
}: {
  session: SessionPlan;
  defaultOpen?: 'all' | 'first' | 'none';
  showCues?: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(() => {
    if (defaultOpen === 'all') return new Set(session.blocks.map((b) => b.phase));
    if (defaultOpen === 'first') return new Set(session.blocks.length ? [session.blocks[0].phase] : []);
    return new Set();
  });

  function toggle(phase: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  }

  let running = 0;
  return (
    <div className="grid gap-2">
      {session.blocks.map((b) => {
        const isOpen = open.has(b.phase);
        const startAt = running;
        running += b.actualSec;
        return (
          <section key={b.phase} className="overflow-hidden rounded-2xl border border-line bg-card">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(b.phase)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <PhaseBadge phase={b.phase} />
              <span className="flex-1 text-sm text-muted">
                {b.items.length}개 운동 · {formatDuration(b.actualSec)}
                <span className="ml-1 text-xs">({formatDuration(startAt)} 시작)</span>
              </span>
              <span className={cx('text-muted transition-transform', isOpen && 'rotate-180')} aria-hidden>
                ⌄
              </span>
            </button>
            {isOpen && (
              <div className="grid gap-2 border-t border-line bg-surface p-3">
                {b.items.length === 0 && <p className="text-sm text-muted">이 페이즈에 배정된 운동이 없습니다.</p>}
                {b.items.map((it, i) => (
                  <ExerciseCard key={it.exercise.id} item={it} index={i + 1} showCues={showCues} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
