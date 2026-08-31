# 구현 진행 보고 (docs/HANDOFF_PROMPT.md A안)

작업 시작: 2026-08-28 22:00 (무인 실행). 단일 진실 소스: `docs/SPEC.md`.
각 단계마다 **만든 것 / 남은 것 / 확인 방법**을 기록한다.

---

## 1단계 — Next.js 스캐폴딩 + 기존 엔진 이식 ✅

### 만든 것
- 저장소 루트에 Next.js 15.5 (App Router) + React 19 + TypeScript + Tailwind CSS 4 통합.
  `package.json` 확장(dev/build/start/verify/typecheck/test:e2e), `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`(기존 `allowImportingTsExtensions`·`@/*` alias 유지).
- `src/lib/engine.ts`, `src/data/exercises.ts`, `scripts/verify.ts` **무수정** 이식.
- 저장 모델 `src/lib/types.ts` — `StoredPlan` / `StoredSession`(엔진 `SessionPlan` + id·status·logs). `blocks`를 그대로 스냅샷 보존.
- 계획 서비스 `src/lib/plan-service.ts` — 입력 검증(`parsePlanInput`), 생성(`createPlan`: 시드 고정), 재생성(`regeneratePlan`: done/skipped/in_progress 세션 보존, sessionId 유지).
- 저장소 추상화 `src/lib/repo/` — `Repository` 인터페이스, `LocalRepository`(localStorage), `SupabaseRepository`(6단계에서 구현; 현재는 Local 상속), env 키 유무로 자동 선택.
- API `POST /api/plans`(엔진은 서버에서만 실행), `POST /api/plans/regenerate`(로컬 모드용).
- 온보딩 상태 `src/store/onboarding.ts`(Zustand persist; `concerns` 배열 순서 = 우선순위, `reorderConcerns`).
- UI 프리미티브 `src/components/ui.tsx`(Button/Card/PageHeader/Page/Disclaimer/ProgressBar/Chip …), `AppShell`(max-width 480px 중앙 정렬 + SW 등록).
- 홈 `/`(진행 중 계획 있으면 오늘 루틴 카드, 없으면 시작 CTA), PWA `manifest.ts`, `public/sw.js`, `/offline`, 플레이스홀더 아이콘(`scripts/make-icons.mjs`).
- `.env.example`, `.gitignore` 보강(`.env*` 이미 제외됨).

### 확인 방법
- `npx tsc --noEmit` 통과, `npx next build` 통과(8 routes), `node scripts/verify.ts` 전 항목 PASS(엔진 무수정 확인).

### 남은 것
- 온보딩 4화면(2단계), 미리보기(3단계) 이하.

---

## 2단계 — 온보딩 4화면 ✅ / 3단계 — 미리보기에서 buildPlan() 렌더링 ✅

### 만든 것
- `/onboarding/concerns` — 5개 목표 카드 복수 선택. 선택 순서 번호 표시. 2개 이상 선택 시 **우선순위 목록**(포인터 드래그 + ▲▼ 버튼) 노출. 배열 순서 = 우선순위.
- `/onboarding/profile` — 레벨 3택1(radio), 장비 칩 다중 선택, 통증 부위(금기 태그 7종, exercises.ts의 contraindications와 1:1).
- `/onboarding/schedule` — 시작/종료 date picker + 2/4/8/12주 프리셋, 주당 횟수 2~5(요일 표시), 세션 시간 20~90분 스테퍼(기본 40). 기간/세션 수/사이클 수 요약, 오류·경고 표시.
- `/onboarding/preview` — `POST /api/plans`(persist=false)로 서버 엔진 실행 → 첫 세션 전체(페이즈 아코디언·처방·시간), 페이즈 시간 배분 막대, 2주 캘린더 요약, 경고, **면책 고지(SPEC 5.2)** + 동의 체크 → "이 계획 시작하기"는 같은 시드로 재생성·저장(재현성 활용) → `/plan`.
- 공용 컴포넌트 `src/components/SessionView.tsx`(PhaseBadge/PhaseBar/ExerciseCard/SessionBlocks) — 4·5단계에서 재사용.
- Playwright 설정(`playwright.config.ts`, iPhone 13 뷰포트/Chromium) + `e2e/onboarding.spec.ts`.

### 확인 방법
- `npx playwright test e2e/onboarding.spec.ts` PASS. 검증 내용: 우선순위 재정렬 반영, 16회 세션 생성, 저장된 plan의 `concerns` 순서 = 화면 순서, `avoidTags=['knee_pain']`이면 전 세션에 `knee_pain` 금기 운동 0건, 전 세션 40분 ±2분, `blocks` 스냅샷 저장.
- 스크린샷: `docs/screenshots/01-home-empty.png` ~ `05-preview.png` (3단계 "스크린샷과 함께 보고" 요건).

### 남은 것
- 캘린더/루틴 상세(4단계), 실행 화면(5단계).

---

## 4단계 — 캘린더 + 루틴 상세 ✅ / 5단계 — 실행 화면 ✅ / 7단계 일부 — 완료·기록·진도율 ✅

### 만든 것
- `/plan` — 월간 그리드(운동일/휴식일/완료/진행 중/건너뜀 색상, 오늘 링), 월 이동, 진도율 바, 다가오는 세션 3건, 범례.
- `/plan/[date]` — 페이즈 아코디언 + 운동 카드(이름·처방·시간·큐), 페이즈 시간 배분 막대, 2주차 과부하 안내, 시작/이어서 하기/완료 기록 CTA.
- `src/lib/session-runner.ts` — 실행 상태 머신(순수 모듈): 세션 → [전환20초 → 세트(work) → 휴식] 스텝 시퀀스(스텝 합 == totalSec), **절대 시각(epoch ms) 기준** 경과 계산, `syncToNow`(백그라운드 복귀 시 연쇄 진행), pause/resume 보정, 운동 건너뛰기, 진행률/예상 종료 계산.
- `/session/[date]` — 시작 화면(**면책 고지 필수**) → 실행: hold 카운트다운 / reps 수동 완료 버튼, 세트 간 휴식 자동 카운트다운 후 자동 진입, 상단 진행 바+예상 종료 시각, 하단 다음 운동 프리뷰, 일시정지/중단(진행 상태 localStorage 저장·재진입 복원), 운동별 큐 표시, `visibilitychange` 즉시 재계산, setInterval은 화면 갱신용만.
- `src/hooks/useWakeLock.ts` — `navigator.wakeLock` + 해제 시 재획득, 미지원 시 무음 오디오 루프 폴백, 둘 다 안 되면 안내 문구.
- `/session/[date]/done` — 소요 시간, RPE 1~10, 통증 신고 토글(경고 안내), 메모 → `completeSession`(logs 일괄 기록) → 완료 기록 화면 + 진도율 갱신, 전 세션 완료 시 계획 completed.
- `/settings` — 프로필(레벨/장비/통증) 수정, **미수행 세션만 재생성**(완료 보존), 데이터 초기화(2단계 확인).
- `scripts/verify-runner.ts` — 상태 머신 검증 스크립트.
- `e2e/session.spec.ts` — 실행 흐름 2개 시나리오.

### 확인 방법
- `node scripts/verify-runner.ts` 전 항목 PASS: ① 전 세션에서 스텝 예상 합 == totalSec(전환 20초 포함 검증) ② 90초·300초 백그라운드 점프 후 경과 시간 손실 0 ③ reps 스텝은 1시간 방치해도 자동 진행 없음, 수동 완료 시 세트 기록 ④ 일시정지 495초가 경과에 미포함 ⑤ 건너뛰기 시 해당 운동 스텝 전부 통과·진행률 유지.
- `npx playwright test` 3/3 PASS: 백그라운드 시계 90초 점프(visibilitychange) 후 전환 스텝 자동 통과, 일시정지/재개, 중단 시 progress 저장·재진입 "이어서 하기", 전 운동 건너뛰기→done 폼→RPE 7·통증·메모 저장→status done·logs 검증→캘린더 완료 표시.
- 스크린샷 `06`~`15` (docs/screenshots/).

### 남은 것
- Supabase 연동(6단계), PWA 마무리·배포(7단계 잔여), 리뷰 워크플로우 결과 반영.
