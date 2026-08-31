'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CONCERN_LABEL_KO, type Equipment, type Level } from '@/lib/engine';
import { AVOID_TAG_OPTIONS, EQUIPMENT_OPTIONS, LEVEL_OPTIONS } from '@/lib/constants';
import { formatKo } from '@/lib/dates';
import { getRepository } from '@/lib/repo';
import { usePlan } from '@/hooks/usePlan';
import { useOnboarding } from '@/store/onboarding';
import { Button, Card, Chip, ErrorBox, LinkButton, Page, PageHeader, Spinner, cx } from '@/components/ui';

export default function SettingsPage() {
  const router = useRouter();
  const { plan, setPlan, loading, error, reload } = usePlan();
  const resetOnboarding = useOnboarding((s) => s.resetAll);
  const [busy, setBusy] = useState<'regen' | 'reset' | 'save' | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function withBusy(kind: 'regen' | 'reset' | 'save', fn: () => Promise<void>) {
    setBusy(kind);
    setErr(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '작업에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="설정" back="/" />
      <Page>
        {error && <ErrorBox message={error} onRetry={reload} />}
        {err && <ErrorBox message={err} />}
        {msg && (
          <p role="status" className="mb-3 rounded-xl bg-brand-light/60 px-4 py-3 text-sm text-brand-dark">
            {msg}
          </p>
        )}

        {plan ? (
          <>
            <Card>
              <h2 className="font-bold">현재 계획</h2>
              <p className="mt-1 text-sm text-muted">
                {formatKo(plan.input.startDate, false)} ~ {formatKo(plan.input.endDate, false)} · 주{' '}
                {plan.input.daysPerWeek}회 · {plan.input.sessionMinutes}분
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {plan.input.concerns.map((c, i) => (
                  <span key={c} className="rounded-full border border-line bg-white px-2 py-0.5 text-xs">
                    {i + 1}. {CONCERN_LABEL_KO[c]}
                  </span>
                ))}
              </div>
            </Card>

            <ProfileEditor
              level={plan.input.level}
              equipment={plan.input.equipment}
              avoidTags={plan.input.avoidTags ?? []}
              busy={busy === 'save'}
              onSave={(patch) =>
                withBusy('save', async () => {
                  const updated = await getRepository().updateProfile(patch);
                  if (updated) setPlan(updated);
                  setMsg('프로필을 저장했습니다. 다음 재생성부터 반영됩니다.');
                })
              }
            />

            <Card className="mt-3">
              <h2 className="font-bold">미수행 세션 재생성</h2>
              <p className="mt-1 text-xs text-muted">
                시드를 바꿔 남은 세션의 운동 조합을 새로 만듭니다. 완료·건너뛴 세션은 그대로 보존됩니다.
              </p>
              <Button
                variant="secondary"
                className="mt-3"
                full
                disabled={busy != null}
                onClick={() =>
                  withBusy('regen', async () => {
                    const updated = await getRepository().regenerate(plan.id);
                    setPlan(updated);
                    setMsg('미수행 세션을 새 조합으로 재생성했습니다.');
                  })
                }
              >
                {busy === 'regen' ? '재생성 중…' : '재생성하기'}
              </Button>
            </Card>
          </>
        ) : (
          <Card>
            <p className="font-semibold">진행 중인 계획이 없습니다</p>
            <LinkButton href="/onboarding/concerns" className="mt-3" full>
              계획 만들기
            </LinkButton>
          </Card>
        )}

        <Card className="mt-3 border-red-200">
          <h2 className="font-bold text-danger">데이터 초기화</h2>
          <p className="mt-1 text-xs text-muted">계획·기록·온보딩 입력을 모두 삭제합니다. 되돌릴 수 없습니다.</p>
          {confirmReset ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setConfirmReset(false)}>
                취소
              </Button>
              <Button
                variant="danger"
                disabled={busy != null}
                onClick={() =>
                  withBusy('reset', async () => {
                    await getRepository().reset();
                    resetOnboarding();
                    setConfirmReset(false);
                    router.replace('/');
                  })
                }
              >
                {busy === 'reset' ? '삭제 중…' : '전부 삭제'}
              </Button>
            </div>
          ) : (
            <Button variant="danger" className="mt-3" full onClick={() => setConfirmReset(true)}>
              초기화…
            </Button>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-muted">모꾸 교정운동 v0.1 · 데이터는 이 기기에 저장됩니다</p>
      </Page>
    </>
  );
}

function ProfileEditor({
  level: initLevel,
  equipment: initEquipment,
  avoidTags: initAvoid,
  busy,
  onSave,
}: {
  level: Level;
  equipment: Equipment[];
  avoidTags: string[];
  busy: boolean;
  onSave: (patch: { level: Level; equipment: Equipment[]; avoidTags: string[] }) => void;
}) {
  const [level, setLevel] = useState<Level>(initLevel);
  const [equipment, setEquipment] = useState<Equipment[]>(initEquipment);
  const [avoidTags, setAvoidTags] = useState<string[]>(initAvoid);
  const dirty =
    level !== initLevel ||
    equipment.slice().sort().join() !== initEquipment.slice().sort().join() ||
    avoidTags.slice().sort().join() !== initAvoid.slice().sort().join();

  function toggle<T>(list: T[], v: T): T[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  return (
    <Card className="mt-3">
      <h2 className="font-bold">프로필</h2>

      <p className="mt-3 text-xs font-semibold text-muted">레벨</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5" role="group" aria-label="레벨">
        {LEVEL_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={level === o.id}
            onClick={() => setLevel(o.id)}
            className={cx(
              'min-h-10 rounded-lg border text-sm font-semibold',
              level === o.id ? 'border-brand bg-brand text-white' : 'border-line bg-white',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs font-semibold text-muted">장비</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {EQUIPMENT_OPTIONS.map((o) => (
          <Chip key={o.id} selected={equipment.includes(o.id)} onClick={() => setEquipment((l) => toggle(l, o.id))} className="min-h-9 text-xs">
            {o.label}
          </Chip>
        ))}
      </div>

      <p className="mt-4 text-xs font-semibold text-muted">통증 부위 (해당 운동 제외)</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {AVOID_TAG_OPTIONS.map((o) => (
          <Chip
            key={o.id}
            selected={avoidTags.includes(o.id)}
            onClick={() => setAvoidTags((l) => toggle(l, o.id))}
            className={cx('min-h-9 text-xs', avoidTags.includes(o.id) && '!border-danger !bg-danger')}
          >
            {o.label}
          </Chip>
        ))}
      </div>

      <Button className="mt-4" full disabled={!dirty || busy} onClick={() => onSave({ level, equipment, avoidTags })}>
        {busy ? '저장 중…' : dirty ? '프로필 저장' : '변경 사항 없음'}
      </Button>
      <p className="mt-2 text-[11px] text-muted">
        저장된 프로필은 &ldquo;미수행 세션 재생성&rdquo;을 눌렀을 때 새 조합에 반영됩니다. 이미 만들어진 루틴은 바뀌지 않습니다.
      </p>
    </Card>
  );
}
