'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ALL_CONCERNS, CONCERN_LABEL_KO, type Concern } from '@/lib/engine';
import { CONCERN_DESC } from '@/lib/constants';
import { useOnboarding } from '@/store/onboarding';
import { Button, Card, Page, PageHeader, SectionTitle, cx } from '@/components/ui';

export default function ConcernsPage() {
  const router = useRouter();
  const concerns = useOnboarding((s) => s.concerns);
  const toggle = useOnboarding((s) => s.toggleConcern);
  const reorder = useOnboarding((s) => s.reorderConcerns);

  return (
    <>
      <PageHeader title="목표 선택" back="/" step={{ current: 1, total: 4 }} />
      <Page
        footer={
          <Button full disabled={concerns.length === 0} onClick={() => router.push('/onboarding/profile')}>
            {concerns.length === 0 ? '목표를 1개 이상 선택하세요' : `다음 (${concerns.length}개 선택)`}
          </Button>
        }
      >
        <SectionTitle sub="복수 선택할 수 있습니다. 먼저 고른 것이 우선순위가 높습니다.">
          어떤 점을 개선하고 싶나요?
        </SectionTitle>

        <ul className="grid gap-2">
          {ALL_CONCERNS.map((c) => {
            const idx = concerns.indexOf(c);
            const selected = idx >= 0;
            return (
              <li key={c}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(c)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors',
                    selected ? 'border-brand bg-brand-light/50' : 'border-line bg-white hover:bg-slate-50',
                  )}
                >
                  <span
                    className={cx(
                      'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      selected ? 'bg-brand text-white' : 'border border-line bg-white text-muted',
                    )}
                    aria-hidden
                  >
                    {selected ? idx + 1 : ''}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{CONCERN_LABEL_KO[c]}</span>
                    <span className="block text-sm text-muted">{CONCERN_DESC[c]}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {concerns.length > 1 && (
          <Card className="mt-6">
            <h3 className="font-bold">우선순위</h3>
            <p className="mt-1 text-sm text-muted">
              길게 눌러 끌어서 순서를 바꾸세요. 1순위 목표에 시간이 가장 많이 배분됩니다.
            </p>
            <PriorityList items={concerns} onReorder={reorder} />
          </Card>
        )}
      </Page>
    </>
  );
}

/** 포인터 드래그 + 화살표 버튼으로 우선순위를 재정렬한다. */
function PriorityList({ items, onReorder }: { items: Concern[]; onReorder: (from: number, to: number) => void }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<{ from: number; over: number; y: number } | null>(null);

  function indexAtY(clientY: number): number {
    const list = listRef.current;
    if (!list) return 0;
    const rows = Array.from(list.children) as HTMLElement[];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return rows.length - 1;
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>, from: number) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ from, over: from, y: e.clientY });
  }
  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    setDrag({ ...drag, over: indexAtY(e.clientY), y: e.clientY });
  }
  function onPointerUp() {
    if (drag && drag.from !== drag.over) onReorder(drag.from, drag.over);
    setDrag(null);
  }

  return (
    <ul ref={listRef} className="mt-3 grid gap-2 select-none" aria-label="우선순위 목록">
      {items.map((c, i) => {
        const isDragging = drag?.from === i;
        const isOver = drag != null && drag.over === i && drag.from !== i;
        return (
          <li
            key={c}
            className={cx(
              'flex items-center gap-2 rounded-xl border bg-white px-2 py-2 transition-colors',
              isDragging ? 'border-brand opacity-60' : isOver ? 'border-brand bg-brand-light/40' : 'border-line',
            )}
          >
            <button
              type="button"
              aria-label={`${CONCERN_LABEL_KO[c]} 순서 끌기`}
              className="flex size-10 cursor-grab touch-none items-center justify-center rounded-lg text-muted active:cursor-grabbing"
              onPointerDown={(e) => onPointerDown(e, i)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
                <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
                <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
              </svg>
            </button>
            <span className="w-6 text-center text-sm font-bold text-brand">{i + 1}</span>
            <span className="flex-1 text-sm font-medium">{CONCERN_LABEL_KO[c]}</span>
            <button
              type="button"
              aria-label={`${CONCERN_LABEL_KO[c]} 위로`}
              disabled={i === 0}
              onClick={() => onReorder(i, i - 1)}
              className="flex size-9 items-center justify-center rounded-lg text-ink disabled:text-slate-300 hover:bg-slate-100"
            >
              ▲
            </button>
            <button
              type="button"
              aria-label={`${CONCERN_LABEL_KO[c]} 아래로`}
              disabled={i === items.length - 1}
              onClick={() => onReorder(i, i + 1)}
              className="flex size-9 items-center justify-center rounded-lg text-ink disabled:text-slate-300 hover:bg-slate-100"
            >
              ▼
            </button>
          </li>
        );
      })}
    </ul>
  );
}
