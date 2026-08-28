# moccu_work_out

헬스장 회원용 **커스텀 교정운동 조합 시스템**의 코어 엔진 스켈레톤.

사용자가 체형 문제(굽은어깨 · 거북목 · 불안한 고관절 · 골반 불균형 · 대근육 강화)를 선택하면
**40분 루틴**을 자동 조합하고, **시작일~종료일** 사이에 **2주 사이클**로 배치한다.

---

## 지금 있는 것

```
src/lib/engine.ts        코어 엔진 (타입 + 타임박싱 + 조합 알고리즘 + 스케줄) — 런타임 의존성 0
src/data/exercises.ts    운동 시드 DB 56종 (전문가 검수 전)
scripts/verify.ts        엔진 검증 스크립트
docs/SPEC.md             제품/알고리즘/DB/화면/API/완료기준 전체 사양  ← 단일 진실 소스
docs/HANDOFF_PROMPT.md   다른 AI에게 붙여넣을 지시문 (전체 위임 / 화면 단위 / DB 확장)
```

UI, 저장소, 운동 콘텐츠(영상·이미지)는 아직 없다.

---

## 실행

Node 22.6 이상이 필요하다 (TypeScript 파일을 그대로 실행).

```bash
node scripts/verify.ts
```

검증 항목: 40분 ±2분 정확도 · 2주 사이클 다양성 · 무장비 사용자 대응 · 재현성 · 금기 필터링 · 단일 목표별 시간.

현재 전 항목 통과. 실제 세션 시간은 39.2~40.9분 범위에 들어온다.

---

## 엔진 사용법

```ts
import { buildPlan } from './src/lib/engine';
import { EXERCISES } from './src/data/exercises';

const plan = buildPlan(
  {
    startDate: '2026-09-01',
    endDate: '2026-09-14',
    daysPerWeek: 4,                                   // 2 | 3 | 4 | 5
    sessionMinutes: 40,
    concerns: ['rounded_shoulder', 'forward_head'],   // 배열 순서 = 우선순위
    level: 2,                                         // 1 입문 · 2 중급 · 3 상급
    equipment: ['band', 'foam_roller', 'dumbbell'],
    avoidTags: ['knee_pain'],
    seed: 42,                                         // 같은 시드 → 같은 루틴
  },
  EXERCISES,
);

plan.sessions;   // 일자별 세션 (페이즈 블록 + 운동 + 처방 + 소요시간)
plan.restDates;  // 휴식일
plan.warnings;   // 시간 오차, 기간 부족 등 경고
```

---

## 다음 단계

`docs/SPEC.md` 8장의 구현 순서를 따른다.

1. Next.js 앱 스캐폴딩 (기존 `src/lib`, `src/data` 이식)
2. 온보딩 4화면
3. **미리보기 화면** — 여기서 엔진 결과를 눈으로 검증
4. 캘린더 + 루틴 상세
5. 실행 화면 (공수 최대)
6. Supabase 연동
7. 완료/기록/진도율 → PWA → 배포

---

## ⚠️ 오픈 전 반드시

- **운동 DB 전문가 검수** — `targets` 가중치, `intensity`, 처방, `contraindications` 전부.
  경추·고관절 관련 운동은 검수 없이 오픈 금지.
- **시연 영상/이미지 확보** — `mediaRef`가 현재 전부 null.
- **의학적 면책 고지** — 온보딩 마지막과 세션 시작 화면 (`docs/SPEC.md` 5.2절).
