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
