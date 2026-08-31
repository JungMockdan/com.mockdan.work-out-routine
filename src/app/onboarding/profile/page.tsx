'use client';

import { useRouter } from 'next/navigation';
import { AVOID_TAG_OPTIONS, EQUIPMENT_OPTIONS, LEVEL_OPTIONS } from '@/lib/constants';
import { useOnboarding } from '@/store/onboarding';
import { Button, Chip, Page, PageHeader, SectionTitle, cx } from '@/components/ui';

export default function ProfilePage() {
  const router = useRouter();
  const level = useOnboarding((s) => s.level);
  const setLevel = useOnboarding((s) => s.setLevel);
  const equipment = useOnboarding((s) => s.equipment);
  const toggleEquipment = useOnboarding((s) => s.toggleEquipment);
  const avoidTags = useOnboarding((s) => s.avoidTags);
  const toggleAvoidTag = useOnboarding((s) => s.toggleAvoidTag);

  return (
    <>
      <PageHeader title="레벨 · 장비" back="/onboarding/concerns" step={{ current: 2, total: 4 }} />
      <Page footer={<Button full onClick={() => router.push('/onboarding/schedule')}>다음</Button>}>
        <SectionTitle sub="세트 수와 휴식 시간이 레벨에 맞게 조정됩니다.">운동 경험은 어느 정도인가요?</SectionTitle>
        <div role="group" aria-label="레벨" className="grid gap-2">
          {LEVEL_OPTIONS.map((o) => {
            const on = level === o.id;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                onClick={() => setLevel(o.id)}
                className={cx(
                  'flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
                  on ? 'border-brand bg-brand-light/50' : 'border-line bg-white hover:bg-slate-50',
                )}
              >
                <span
                  className={cx(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                    on ? 'border-brand' : 'border-slate-300',
                  )}
                  aria-hidden
                >
                  {on && <span className="size-2.5 rounded-full bg-brand" />}
                </span>
                <span>
                  <span className="block font-semibold">{o.label}</span>
                  <span className="block text-sm text-muted">{o.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        <SectionTitle sub="맨몸·매트 운동은 항상 포함됩니다. 없으면 선택하지 않아도 됩니다.">
          <span className="mt-8 block">사용할 수 있는 장비</span>
        </SectionTitle>
        <div className="flex flex-wrap gap-2" role="group" aria-label="장비">
          {EQUIPMENT_OPTIONS.map((o) => (
            <Chip key={o.id} selected={equipment.includes(o.id)} onClick={() => toggleEquipment(o.id)}>
              {o.label}
            </Chip>
          ))}
        </div>

        <SectionTitle sub="선택한 부위에 부담이 되는 운동은 루틴에서 제외됩니다.">
          <span className="mt-8 block">현재 통증이 있는 부위</span>
        </SectionTitle>
        <ul className="grid gap-2" role="group" aria-label="통증 부위">
          {AVOID_TAG_OPTIONS.map((o) => {
            const on = avoidTags.includes(o.id);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleAvoidTag(o.id)}
                  className={cx(
                    'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors',
                    on ? 'border-danger bg-red-50' : 'border-line bg-white hover:bg-slate-50',
                  )}
                >
                  <span>
                    <span className="block text-sm font-semibold">{o.label}</span>
                    <span className="block text-xs text-muted">{o.hint}</span>
                  </span>
                  <span
                    className={cx(
                      'flex size-6 items-center justify-center rounded-md border text-xs',
                      on ? 'border-danger bg-danger text-white' : 'border-slate-300 bg-white',
                    )}
                    aria-hidden
                  >
                    {on ? '✓' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Page>
    </>
  );
}
