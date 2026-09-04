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

---

## 리뷰 라운드 1 — 1~3단계 다각도 리뷰 + 반박 검증 (Workflow, 에이전트 44개) ✅

4개 렌즈(SPEC 대조/정확성/모바일 UX·접근성/PWA·빌드)로 40건 발견 → 독립 에이전트 반박 검증 → **30건 확정, 10건 기각**. 확정 30건 전부 반영:

- **[high] /api/plans/regenerate 무검증 입력**: parsePlanInput 재사용(400), 세션 스냅샷 형태 검사 + 400개 상한. 계획 기간도 최대 366일, avoidTags 20개 상한(plan-service).
- **[high] maximumScale:1 핀치줌 차단(WCAG 1.4.4)**: 제거.
- **[high] role=radio 키보드 시맨틱 불일치**: 전 화면(프로필/일정/설정/RPE) aria-pressed + role=group으로 교체, e2e 셀렉터 갱신.
- **[high] 고정 푸터가 본문 가림**: 본문 하단 패딩 11rem+safe-area로 확대.
- **[high] SW가 404/500 응답을 캐시**: res.ok 가드(페이지·정적 둘 다), 오프라인 폴백 프리캐시 실패 시 install 실패로 재시도, PAGE_CACHE 30개 제한, manifest cache-first 편입 (sw v2).
- **[med] zustand persist 하이드레이션 미스매치**: skipHydration + AppShell에서 rehydrate.
- **[med] 과거 시작일 통과**: 일정 화면에서 오늘로 클램프.
- **[med] 경고색 대비 미달**: #d97706→#b45309. 진행바 aria-label, 단계 표시 role=img, 스테퍼 role=status, 재정렬 aria-live 안내, 드래그 안내 문구 수정.
- **[med] engines/Node 22.6 불일치**: >=22.18.0. Playwright webServer가 build 후 start. tsconfig include에 next.config.ts/playwright.config.ts 추가. deprecated `next lint` 스크립트 제거. e2e 날짜 입력을 getByLabel로. LocalRepository.regenerate 병합 저장(멀티탭 레이스).
- **[spec-gap] 사양에 없는 기능 제거**: 미리보기의 동의 체크박스·'다시 조합' 버튼 삭제 (고지는 SPEC 5.2대로 표시 유지).

**사인오프 필요한 잔여 편차 2건** (기능 삭제 대신 기록 선택):
1. 일정 화면의 2/4/8/12주 프리셋 칩 — 데이트피커 입력 편의로 유지. SPEC 5에 추가 기재 권장.
2. Zustand를 온보딩 상태에 사용 (SPEC 7은 "실행 화면 타이머 상태만"으로 한정; 실행 화면은 현재 useState 기반 순수 상태 머신) — SPEC 7 문구 갱신 권장.

확인: `tsc --noEmit` / `next build` / e2e 3/3 PASS / `verify.ts`·`verify-runner.ts` PASS.

---

## 6단계 — Supabase 연동 ✅ (키 미제공 → localStorage 모드로 동작, 키만 넣으면 전환)

`.env.local`이 없어(작업 시점 확인) 실계정 연동 테스트는 불가. 대신 **전환 가능한 완전한 코드 경로**를 작성했다:

### 만든 것
- `supabase/migrations/0001_init.sql` — SPEC 4.3 스키마 그대로(exercises/profiles/plans/sessions/session_logs) + 인덱스 + **RLS 전체**(본인 데이터만 select/insert/update, exercises는 읽기 전용).
- `scripts/seed-exercises.ts` — 운동 56종 적재(`node --env-file=.env.local scripts/seed-exercises.ts`), progression FK 2-pass.
- `src/lib/supabase/` — browser client(익명 로그인 `ensureAuth`; 로그인 UI는 SPEC 화면에 없으므로 Anonymous Sign-in 채택 — 프로젝트에서 켜야 함), server client(@supabase/ssr), row↔model 매핑, 서버 서비스(persistPlan: 기존 active abandon 후 스냅샷 저장 / completeSession: logs 일괄 + 전량 완료 시 plan completed / persistRegenerated: 세션 id 유지 upsert).
- `src/middleware.ts` — 토큰 갱신(키 없으면 no-op).
- SPEC 6 라우트 전부: `POST /api/plans`(persist 지원), `GET /api/plans/current`, `GET /api/sessions/[date]`, `POST /api/sessions/[id]/complete`, `POST /api/plans/[id]/regenerate`. 추가로 /settings 화면(SPEC 5)에 필요한 `POST /api/sessions/[id]/status`, `POST /api/profile`, `POST /api/reset` (SPEC 6 표에는 없음 — 기록).
- `SupabaseRepository` — 위 라우트만 호출(엔진·DB 접근 전부 서버). env 키 존재 시 `getRepository()`가 자동 선택.

### 확인 방법
- 키가 없어 라이브 검증 불가 → `tsc --noEmit`·`next build` 통과, e2e 3/3(localStorage 모드) 회귀 통과로 확인. **키 투입 후 해야 할 것**: ① `supabase db push`(또는 SQL 실행) ② seed 스크립트 ③ Authentication→Anonymous sign-ins 활성화 ④ e2e를 Supabase 모드로 1회 수동 검증.

---

## 리뷰 라운드 2 — 4~6단계 다각도 리뷰 + 반박 검증 (Workflow, 에이전트 31개) ✅

4개 렌즈(SPEC 5.1 대조/타이머 정확성/데이터·Supabase/신규 화면 UX·접근성)로 27건 → **21건 확정, 6건 기각**. 전부 반영:

- **[high] plans DELETE RLS 정책 부재** → /api/reset이 Supabase 모드에서 조용히 무동작. `plans_delete` 정책 추가(cascade로 sessions/logs 삭제).
- **[high] 기록되는 소요 시간이 항상 예상치 합(=totalSec)** → RunnerState에 `actualElapsedSec`(벽시계 기준, 일시정지 제외) 추가, advance/sync에서 실측 누적, 진행 상태 저장·복원에 포함, 완료 기록은 실측 사용. verify-runner에 검증 추가.
- **[high] Supabase 재생성이 설정 화면의 프로필 변경을 무시**(Local과 불일치) → 재생성 라우트가 profiles 행을 먼저 병합.
- **[high] 캘린더 진행중/건너뜀 셀 명도 대비 미달** → amber-100/900 + ring, slate-200/600으로 교체, aria-label에 상태 포함.
- **[med] Supabase에서 elapsed/logs 유실** → sessions.elapsed_sec 컬럼 추가(SPEC 4.3에 없는 스키마 추가 — 기록), 완료 시 기록, done 세션의 session_logs를 읽어 매핑 → 완료 화면 기록 카드가 Supabase 모드에서도 동작.
- **[med] 계획 완료 순간 모든 조회가 404** → fetchCurrentPlan이 active 없으면 최근 completed 반환, LocalRepository도 abandoned만 제외(캘린더 완료 표시·진도율 유지, SPEC 5).
- **[med] persistPlan 비원자성** → 새 계획을 비활성으로 생성→세션 성공 후 상태 전환(실패 시 기존 계획 무손상, best-effort 정리).
- **[med] completeSession 비멱등** → 이미 done이면 로그 중복 없이 반환.
- **[med] persistRegenerated가 시드만 저장** → level/equipment/avoid_tags 함께 저장.
- **[med] pagehide/중단 저장이 setState 업데이터 내부** → runnerRef로 직접 저장. syncToNow가 변화 없으면 참조 유지 → localStorage 4회/초 기록 제거.
- **[med] verify-runner의 reps 검증이 시드에 따라 조용히 생략** → reps 스텝을 반드시 찾아 도달·검증(없으면 FAIL). e2e 아닌 스크립트 레벨에서 확정 검증.
- **[low]** wakeLock enable을 시작 버튼 제스처 안으로 이동(iOS 오디오 폴백), 카운트다운 만료 직후 오클릭 방지(stepIndex 가드), 건너뛰기·나가기 터치 영역 44px, 중단 확인에 alertdialog+포커스, 세션 진행바 aria-label, footer 없는 페이지 하단 패딩 축소.

확인: `verify.ts`(엔진) · `verify-runner.ts`(14 PASS) · `tsc` · `next build` · e2e 3/3 전부 통과.

---

## 최종 — SPEC 9장 완료 기준 점검

| 기준 | 상태 | 확인 방법 |
|---|---|---|
| 5개 목표 임의 조합에도 전 세션 40분 ±2분 | ✅ | `node scripts/verify.ts` — 단일 목표 5종·전체 조합 등 전 시나리오 최대 오차 115초. e2e에서도 화면 표시값 파싱 검증 |
| 장비 미선택에도 빈 페이즈 블록 없음 | ✅ | `verify.ts` "빈 블록 없음 — 0개" (무장비 입력 시나리오 포함) |
| 2주 사이클 내 한 운동이 전 세션 반복되지 않음 | ✅ | `verify.ts` — 8세션 중 최대 5회, 고유 51종 사용 |
| 통증 부위 선택 시 금기 운동 0건 | ✅ | `verify.ts`(knee_pain) + e2e: 저장된 계획 전 세션 blocks 스캔으로 0건 확인 |
| 같은 입력+시드 → 같은 루틴 (재현성) | ✅ | `verify.ts` 동일 시드 일치·다른 시드 상이. 미리보기→시작 흐름이 같은 시드 재생성으로 이 성질을 사용 |
| 실행 타이머가 백그라운드 복귀 후 밀리지 않음 | ✅ | `verify-runner.ts` 300초 점프 무손실 + e2e에서 Date.now 90초 점프 후 visibilitychange 재계산 확인. 경과는 절대 시각 기준, setInterval은 표시용 |
| iPhone Safari / Android Chrome 실기기 전 과정 | ⬜ **사람 필요** | 코드는 대응 완료(wakeLock+오디오 폴백, visibilitychange, 절대시각). 자동화는 Chromium+iPhone 뷰포트까지 — 실기기 검증은 기기가 필요 |
| 운동 56종 전문가 검수(reviewed_by/at) | ⬜ **사람 필요** | 스키마에 컬럼 준비됨. HANDOFF D-1 그대로: 오픈 전 물리치료사/교정운동 전문가 검수 필수 |
| 면책 고지가 온보딩·세션 시작 화면 노출 | ✅ | e2e 2곳 모두 문구 어서션(`의학적 진단·치료가 아닙니다`) — 온보딩 미리보기 + 세션 인트로 |

## 최종 요약

- **완료**: 1~7단계 전부(스캐폴딩 → 온보딩 → 미리보기 → 캘린더/상세 → 실행 화면 → Supabase 코드 경로 → 완료/기록/진도율 → PWA). 리뷰 워크플로우 2회(에이전트 75개, 발견 67건 → 반박 검증 후 확정 51건 전부 수정).
- **동작 모드**: localStorage 모드로 완전 동작(e2e 3/3). Supabase는 키 투입 시 자동 전환 — 남은 수동 절차: 스키마 적용 → 시드 적재 → Anonymous sign-ins 활성화 → 1회 수동 검증.
- **배포**: Vercel 미로그인으로 생략(결정사항). `next build` 통과 상태 — `vercel login` 후 `vercel` 한 번이면 됨.
- **사람이 해야 할 일**: ① 실기기 검증 ② 운동 DB 전문가 검수 ③ Supabase/Vercel 계정 절차 ④ 사양 편차 사인오프(기간 프리셋 칩, 온보딩 상태의 Zustand 사용, sessions.elapsed_sec 컬럼, /api/profile·reset·status 라우트).

---

## 2026-09-04 — e2e 날짜 의존성 제거 · 사양 편차 SPEC 반영 · Supabase 연동 착수

### 고친 것 ① e2e가 날짜에 따라 깨지던 문제 (시한폭탄)

재검증에서 `onboarding.spec.ts`가 실패했다. 앱 버그가 아니라 **테스트가 고정 날짜를 쓴 탓**이다.

- 테스트는 시작일에 `2026-09-01`을 넣고 4주 프리셋 → 종료일 `2026-09-28`을 기대했다.
  그런데 리뷰 라운드 1에서 넣은 "과거 시작일은 오늘로 클램프"가 정상 동작하면서
  시작일이 오늘(9/4)로 당겨졌고 종료일이 `2026-10-01`이 됐다. 8/31에는 통과했고 9/1부터 깨졌다.
- `session.spec.ts`도 같은 부류였다. `2026-08-31 ~ 2026-09-27`을 하드코딩해서
  그 기간이 지나면 조용히 깨질 상태였다.

수정 — 고정 날짜를 전부 걷어내고 **오늘 기준 상대 날짜**로 바꿨다.

- `e2e/dates.ts` 신규. 요일 패턴은 엔진의 `weekdayPattern()`을, 날짜 포맷은 `src/lib/dates.ts`의
  `shiftISO`/`formatKo`를 **그대로 재사용**한다(테스트에 중복 정의를 두지 않는다).
  `firstSessionISO(startISO, daysPerWeek)`만 새로 추가.
- `onboarding.spec.ts` — 시작일 input의 `min` 속성(=앱이 계산한 오늘)을 읽어 기준으로 삼는다.
  종료일은 `shiftISO(오늘, 27)`, 첫 세션 라벨은 `firstSessionISO(오늘, 4)`로 기대값을 계산한다.
  저장된 계획의 `sessions[0].date`·`input.startDate`도 같은 값인지 교차 검증하도록 단정을 추가했다.
- `session.spec.ts` — 시드 계획의 기간을 브라우저의 로컬 오늘 ~ +27일로 계산한다.
  (`todayISO()`와 같은 방식. Node와 브라우저의 타임존이 다를 수 있어 브라우저 안에서 계산한다.)

### 고친 것 ② `.env.local`이 생기자 e2e 3건이 전부 깨진 문제

작업 중 `.env.local`이 추가되면서 빌드가 Supabase 모드로 바뀌었고,
localStorage를 직접 읽고 쓰는 전제인 e2e가 3/3 실패했다.

- `playwright.config.ts`의 `webServer.env`에서 `NEXT_PUBLIC_SUPABASE_*`를 빈 값으로 덮어
  **스위트를 로컬 모드로 고정**했다. (`NEXT_PUBLIC_*`은 빌드 타임 인라인이라 빌드 환경에서 눌러야 한다.)
- Supabase 모드 확인이 필요하면 `E2E_SUPABASE=1`로 켠다. 다만 이 스위트는 localStorage를
  직접 단정하므로 그대로는 통과하지 않는다 — 수동 확인용 스위치다.
- 주의: `reuseExistingServer: true`라 3100 포트에 서버가 이미 떠 있으면 그걸 재사용하고
  이 덮어쓰기가 무시된다. 모드를 바꿔 돌릴 때는 기존 서버를 내리고 시작할 것.

### 고친 것 ③ 사양 편차 4건을 SPEC.md에 기재 (⚠️ 사인오프 대기)

리뷰 라운드에서 "기능 삭제 대신 기록"으로 남겼던 항목을 단일 진실 소스에 반영했다.
전부 `⚠️ 사인오프 대기`로 표시했다. **문구 초안이며, 유지할지 되돌릴지는 사람이 정한다.**

| 절 | 편차 |
|---|---|
| 4.3 | `sessions.elapsed_sec` 컬럼 — 실측 소요 시간 기록용 |
| 5 | 일정 화면의 기간 프리셋 칩(2/4/8/12주) |
| 6 | `/api/profile`, `/api/reset`, `/api/sessions/[id]/status` 3개 라우트 + 추가 이유 |
| 7 | Zustand 사용처가 "실행 화면 타이머"가 아니라 "온보딩 입력 상태"로 뒤바뀐 경위 |

코드 변경은 없다. SPEC.md diff는 위 4개 절만 건드린다.

### 확인 방법

`tsc --noEmit` 통과 · `node scripts/verify.ts` 전 항목 PASS · `node scripts/verify-runner.ts` 14 PASS ·
`npx playwright test` **3/3 PASS**(`.env.local`이 있는 상태에서 config가 로컬 모드로 고정하는 것까지 확인).
Node v26.2.0에서 실행.

### 6단계 Supabase — 막힌 지점

`.env.local`에 URL·anon key·service role key가 들어왔다. 프로젝트 ref는 `smqgdstjbpqrntbjbkjv`.
그런데 **스키마가 아직 적용돼 있지 않다**. 서비스 롤 키로 `plans`를 조회하면
`PGRST205 Could not find the table 'public.plans'`가 돌아온다.

스키마 적용(DDL)은 이 환경에서 자동화할 수단이 없다.

- `psql` 없음, `supabase` CLI 없음(`node_modules`에도 없음).
- PostgREST(서비스 롤 키로 접근 가능한 유일한 경로)는 DDL을 실행하지 못한다.
- `supabase link`/`db push`는 액세스 토큰과 DB 비밀번호가 필요한데 둘 다 없다.
  (`.env.local`의 주석에 CLI 명령이 적혀 있으나 로그인은 브라우저 인증이라 무인 실행 불가.)

**사람이 해야 할 2가지** — 둘 다 Supabase 대시보드에서:

1. SQL Editor에 `supabase/migrations/0001_init.sql` 전문을 붙여넣고 실행.
   (`create table`에 `if not exists`가 없으므로 두 번 실행하면 에러가 난다. 최초 1회만.)
2. Authentication → Sign In / Providers → **Anonymous sign-ins 활성화**.
   로그인 UI가 SPEC 화면에 없어 익명 로그인을 채택했기 때문에 이게 꺼져 있으면 전부 401이다.

이 둘이 끝나면 남은 건 자동화 가능하다:
`node --env-file=.env.local scripts/seed-exercises.ts` (운동 56종 적재) → Supabase 모드 수동 검증.

### 6단계 후속 (같은 날) — 스키마 적용 확인, 남은 블로커 2건

사용자가 SQL Editor로 마이그레이션을 적용했다. **확인됨**:
`exercises`/`profiles`/`plans`/`sessions`/`session_logs` 5개 테이블 전부 응답(200),
`exercises`는 anon 키로도 읽힌다(RLS `exercises_read` 정상).

Supabase 모드로 빌드·기동해 라우트를 직접 찔러본 결과도 정상이다:

| 호출 | 결과 |
|---|---|
| `GET /api/plans/current` (세션 없음) | `401 {"error":"로그인이 필요합니다."}` |
| `GET /api/sessions/[date]` (세션 없음) | `401` 동일 |
| `POST /api/profile` (세션 없음) | `401` 동일 |
| `POST /api/plans` `persist:false` | `200` — 엔진 실행 결과 정상 반환(인증 불필요 경로) |

**남은 블로커 2건 — 둘 다 사람이 해야 한다:**

1. **`.env.local`의 `SUPABASE_SERVICE_ROLE_KEY`가 anon 키와 같은 값이다.**
   JWT payload를 디코드해 확인했다 — 두 키 모두 `role=anon`이고 문자열도 완전히 동일하다.
   그래서 시드 적재가 `new row violates row-level security policy for table "exercises"`로 실패한다.
   `exercises`에는 읽기 정책만 있고 쓰기 정책이 없어서, service_role로만 적재할 수 있다(의도된 설계).
   → 대시보드 Project Settings → API → `service_role` 키를 복사해 `.env.local`의 해당 줄만 교체.
   이 키는 시드 스크립트에서만 쓴다(런타임 코드 경로에는 없다). 앱 동작에는 영향 없음.

2. **Anonymous sign-ins이 아직 꺼져 있다.**
   `POST /auth/v1/signup`이 `422 anonymous_provider_disabled`를 반환한다.
   → Authentication → Sign In / Providers → Anonymous sign-ins 활성화.
   꺼져 있으면 앱은 "로그인에 실패했습니다: Anonymous sign-ins are disabled"를 보여준다
   (`ensureAuth`가 던지고 `ErrorBox`가 받는다 — 에러 표면 자체는 정상 동작).

**참고 — 시드가 왜 필요한가**: 런타임 엔진은 번들된 `src/data/exercises.ts`를 쓰고
`exercises` 테이블을 읽지 않는다. 하지만 `session_logs.exercise_id`가 `exercises(id)`를
참조하므로, 테이블이 비어 있으면 **세션 완료 기록 저장이 FK 위반으로 실패한다.**

위 2건이 해결되면 남은 절차: 시드 적재 → Supabase 모드 전 과정 검증.

### 6단계 후속 2 — 시드 적재 완료 + RLS/FK 라이브 검증 17건 통과

**service_role 키 교체 확인**: JWT `role=service_role`, 프로젝트 ref 일치, anon 키와 다른 값.

**시드 적재 성공** — `node --env-file=.env.local scripts/seed-exercises.ts`

```
✅ 56종 적재 완료 (progression 7건 연결)
```

anon 키로 다시 읽어 번들 데이터와 대조했다. 전부 일치한다.

| 항목 | DB | 번들 `src/data/exercises.ts` |
|---|---|---|
| 총 운동 수 | 56 | 56 |
| progression 연결 | 7 | 7 |
| 깨진 progression 참조 | 0 | — |

페이즈별 분포: release 10 · mobility 10 · activation 14 · strength 16 · integration 6.

**RLS·FK 라이브 검증 17건 전부 PASS.** 익명 로그인이 아직 꺼져 있어,
admin API로 임시 email 사용자 2명(A·B)을 만들어 실제 사용자 JWT로 검증하고 끝나고 지웠다.
(일회성 진단 스크립트이므로 저장소에 남기지 않았다.)

- `profiles` — 본인 행 insert/select 성공. **B는 A의 프로필을 조회하면 0행.**
- `plans`/`sessions` — 소유 계획을 경유한 insert 성공.
- `sessions.elapsed_sec` — `2377`로 update되고 그대로 읽힌다(SPEC 편차 항목 실동작 확인).
- `session_logs` — 시드된 `exercises`를 참조하는 insert 성공.
  없는 `exercise_id`는 **409로 거부**된다(FK 작동 확인).
- 격리 — B가 A의 `plans`/`sessions`/`session_logs`를 조회하면 전부 0행.
- `plans_delete`(라운드2에서 추가한 정책) — **B는 A의 계획을 못 지운다(0행 삭제)**,
  A는 본인 계획 삭제 성공, cascade로 `sessions`·`session_logs`까지 함께 삭제됨.

즉 스키마·RLS·FK·cascade는 실제 프로젝트에서 의도대로 동작한다.

**남은 블로커 1건 — Anonymous sign-ins이 여전히 꺼져 있다.**

REST(`POST /auth/v1/signup`)와 앱이 실제로 쓰는 `supabase-js`의 `signInAnonymously()`
양쪽 모두 `anonymous_provider_disabled`를 반환한다. 10초 간격 6회 재시도해도 동일했으므로
설정 반영 지연이 아니다.

→ 대시보드 **Authentication → Sign In / Providers → User Signups → Allow anonymous sign-ins**
토글을 켜고 **Save**까지 눌러야 한다. (Email 관련 토글과 헷갈리기 쉽다.)

이것만 켜지면 앱 전 과정 검증이 가능하다. 그 전까지 앱은 Supabase 모드에서
"로그인에 실패했습니다: Anonymous sign-ins are disabled"를 보여준다.

### 6단계 후속 3 — 서버 서비스 계층 라이브 검증 33건 통과

익명 로그인 토글이 계속 막혀 있어, **그것에 의존하지 않는 부분을 먼저 끝냈다.**
앱 코드(`plan-service.ts`, `supabase/service.ts`)를 **수정 없이 그대로 import**해서
실제 사용자 JWT(RLS 적용)로 라이브 프로젝트에 대해 돌렸다.
익명 로그인 대신 admin API로 임시 email 사용자를 만들어 쓰고 끝나면 지웠다.
(일회성 진단이라 저장소에 남기지 않았다. Node가 `@/` 별칭과 확장자 없는 상대 경로를
해석하지 못해 ESM resolve 훅을 임시로 끼웠다.)

검증한 것 — **PASS 33 / FAIL 0**:

- `createPlan` — 16세션, 전 세션 40분 ±2분, 5페이즈 스냅샷.
- `persistPlan` — plans+sessions+profiles 저장, 상태가 `active`로 확정된다
  (라운드2에서 넣은 **원자성 보강 경로**가 실제로 통과한다).
  **전 세션 `blocks` 스냅샷이 jsonb 왕복 후에도 내용 동일**,
  저장된 전 세션에 `knee_pain` 금기 운동 0건.
- 두 번째 계획을 저장하면 **이전 active가 abandoned로 내려간다.**
- `completeSession` — `elapsed_sec` 2377 저장/복원, `session_logs` 17건 일괄 기록, RPE·통증 기록.
- **멱등성**(라운드2 항목) — 재호출해도 로그가 늘지 않고 기존 기록을 덮어쓰지 않는다.
- `regeneratePlan` + `persistRegenerated`(라운드2 항목) — 완료 세션은 status·로그까지 보존,
  세션 id 유지로 개수 16 유지, `level`·`avoid_tags`가 함께 저장되고,
  **미수행 세션만 새 금기(`lumbar_disc`)를 반영해 재생성**된다.
- 전 세션 완료 → 계획 `completed`, 그래도 `fetchCurrentPlan`이 돌려준다(라운드2 항목, 캘린더 유지).
- `updateProfile` / `resetUserData` — 초기화 후 계획 없음, cascade로 sessions까지 삭제.

검증 중 스크립트 쪽 실수 2건을 잡았는데 **둘 다 앱이 아니라 테스트의 문제**였다.
`jsonb`는 객체 키 순서를 보존하지 않으므로 문자열 비교 대신 키 정렬 후 비교해야 하고,
`regeneratePlan(current, newSeed?)`의 2번째 인자는 프로필 패치가 아니라 시드다.
또 재생성은 **반드시 DB에서 다시 읽은 계획**으로 해야 한다(라우트는 그렇게 하고 있다).
메모리에 들고 있던 오래된 계획으로 재생성하면 완료 상태가 planned로 덮인다.

**남은 블로커: Anonymous sign-ins (변화 없음).**

`GET /auth/v1/settings`가 인증 서버의 실제 적용값으로 `external.anonymous_users: false`를 계속 반환한다.
`disable_signup`은 `false`라 가입 자체는 열려 있다.
대시보드에서는 토글이 켜지고 Save가 비활성(저장할 변경 없음)인데도 서버 값이 바뀌지 않는다.
껐다 켜며 재저장해도 동일하다.

흔히 지목되는 원인 3가지는 여기에 해당하지 않는다.

| 흔한 원인 | 해당 여부 |
|---|---|
| 로컬 CLI(`supabase start`)의 `config.toml` 미수정 | ✗ 로컬 Supabase를 쓰지 않는다. 원격 프로젝트 URL로 직접 조회했다 |
| 프론트엔드 `.env`/개발서버 캐시 | ✗ Next를 거치지 않았다. curl과 Node에서 `persistSession:false`로 호출했다 |
| `signUp()` 오용 | ✗ `signInAnonymously()`와 원시 `POST /auth/v1/signup {}` 양쪽 모두 같은 응답이다 |

`/auth/v1/settings`는 클라이언트 캐시가 아니라 **인증 서버가 자기 설정을 보고하는 값**이므로,
남는 설명은 (a) 대시보드에서 보는 프로젝트가 `smqgdstjbpqrntbjbkjv`가 아니거나
(b) Supabase 쪽 설정 반영 실패다. (b)라면 프로젝트 재시작 또는 지원 문의가 필요하다.

---

## 6단계 완료 — Supabase 실연동 검증 통과 ✅

### 익명 로그인 블로커 해소 — 원인은 설정 반영 실패였다

대시보드 토글은 켜지고 저장됐는데 인증 서버는 계속 `external.anonymous_users: false`를 보고했다.
흔히 지목되는 3가지(로컬 CLI `config.toml` / 프론트 `.env`·캐시 / `signUp()` 오용)는
앞 절에 적은 대로 전부 해당하지 않았고, 최신 문서 확인 결과 호스팅 프로젝트는
**대시보드 토글만으로 즉시 적용**되며 publishable/secret 키 체계와도 무관했다.

프로젝트 동일성을 가리려고 admin API로 표식 계정을 하나 만들어 대시보드에서 보이는지 확인했는데,
**대시보드에는 보이지 않았다.** 프로젝트 ref는 `smqgdstjbpqrntbjbkjv`로 동일한데도 그랬다.
→ **Settings → General → Restart project** 후 즉시 해결됐다.

```
external.anonymous_users = true
signInAnonymously() → OK (is_anonymous=true)
```

대시보드가 표식 계정을 못 보여준 것도 같은 원인(설정·데이터 반영이 멈춘 상태)으로 보인다.
재시작 후에는 표식 계정이 정상 조회됐다. **교훈: 대시보드 표시를 믿지 말고
`GET /auth/v1/settings`로 인증 서버의 적용값을 확인할 것. 어긋나면 프로젝트 재시작.**

### 만든 것 — `e2e/supabase.spec.ts` (Supabase 모드 전 과정 자동 검증)

SPEC 6의 "키 투입 후 1회 수동 검증" 절차를 자동화했다. 브라우저는 익명 로그인으로 사용자를 만들고,
검증은 service_role로 DB를 직접 읽어 **화면에서 한 일이 실제로 Supabase에 저장됐는지** 확인한다.
끝나면 만든 익명 사용자를 지운다(계획·세션·로그는 FK cascade로 함께 삭제).

두 스위트는 **배타적으로** 돈다.

| 실행 | 도는 스위트 |
|---|---|
| `npx playwright test` | localStorage 모드 3건 (Supabase 스펙은 skip) |
| `E2E_SUPABASE=1 npx playwright test` | Supabase 모드 1건 (localStorage 스펙 3건 skip) |

검증 내용: 온보딩 4화면 → 미리보기(면책 고지) → 계획 시작 → `/plan`.
그다음 DB를 직접 읽어 확인한다.

- 익명 사용자가 정확히 1명 생성되고 `is_anonymous=true`.
- **계획이 localStorage에 저장되지 않는다**(Supabase 모드임을 반증).
- `plans` 1행, `status=active`, **`concerns` 배열 순서가 화면에서 올린 우선순위와 일치**,
  `level`·`avoid_tags` 일치.
- `sessions` 16행, 첫 세션 날짜 일치, **전 세션 40분 ±2분**, `blocks` 5페이즈 스냅샷,
  **전 세션에 `knee_pain` 금기 운동 0건**.
- `profiles` 1행 저장.
- 실행 화면(면책 고지) → 전 운동 건너뛰기 → 완료 폼(RPE 7·통증·메모) → 저장.
- `sessions.status=done`, `completed_at`·**`elapsed_sec` 기록**,
  `session_logs`에 RPE 7·통증 플래그·메모 저장.
- 캘린더가 Supabase에서 다시 읽어 완료 표시.

스크린샷 `16-supabase-plan` · `17-supabase-done` · `18-supabase-calendar`.

### 확인 방법

| 검증 | 결과 |
|---|---|
| `E2E_SUPABASE=1 npx playwright test` | **1 passed** (localStorage 스펙 3건 skip) |
| `npx playwright test` (회귀) | **3 passed** (Supabase 스펙 skip) |
| `npx tsc --noEmit` | 통과 |
| 서비스 계층 라이브 검증(앞 절) | PASS 33 / FAIL 0 |
| RLS·FK 라이브 검증(앞 절) | PASS 17 / FAIL 0 |

**테스트 후 DB 정리 상태**: `plans`/`sessions`/`session_logs`/`profiles` 전부 0행,
사용자 0명, `exercises` 56종 유지. 테스트가 데이터를 남기지 않는다.

### 6단계 남은 것

없다. 스키마·시드·RLS·익명 로그인·전 과정 검증 완료.
`.env.local`의 레거시 anon/service_role 키는 2026년 말 폐기 예정이므로
언젠가 publishable/secret 키로 교체하는 편이 좋다(지금 동작에는 문제 없음).

---

## 2026-09-04 — 헬스장 기구 운동 보강 (운동 56 → 74종) ✅

발단: 온보딩 기구 선택에 **바벨·케이블이 있는데 해당 운동이 0개**였다.
헬스장 사용자가 기구를 전부 체크해도 추가로 얻는 운동이 하나도 없었다.
헬스장 기구 운동 전체가 덤벨 5 + 벤치 4뿐이었다.

### 설계 결정 — 제네릭 기구 축 + 벤더 매핑 레이어

DRAX(디랙스) 제품군을 참조 카탈로그로 쓰되, **제품명을 엔진에 넣지 않는다.**
`engine.ts`는 "런타임 의존성 0 · 운동 DB는 DI로 주입"이 설계 원칙이라
특정 제조사에 묶이면 그 원칙이 깨진다. 그래서 두 층으로 나눴다.

| 층 | 파일 | 역할 |
|---|---|---|
| 제네릭 기구 축 | `src/lib/engine.ts` | `lat_pulldown`·`leg_press` 등 벤더 중립 값. 엔진 필터·점수의 유일한 근거 |
| 벤더 매핑 | `src/data/gym-vendors.ts` | 제네릭 값 → DRAX 제품명(표시 전용). 브랜드를 바꿔도 플랜 결과는 불변 |

결과적으로 다른 브랜드 헬스장 사용자도 같은 운동을 그대로 받고,
DRAX 헬스장 사용자는 실행 화면에서 실제 기구명(예: '웰리브 랫 풀다운')을 볼 수 있다.

### 만든 것

- `engine.ts` — `Equipment`에 머신 10종 + `squat_rack` 추가(제네릭). `GYM_EQUIPMENT` 상수 신설.
  `MuscleGroup`에 `delt` 추가(삼각근이 없어 체스트/숄더 프레스를 표현할 수 없었다).
- `src/data/gym-vendors.ts` (신규) — DRAX 15종 매핑, `vendorMachineName()`. 출처 draxfit.com/ko/strength.
- `src/data/exercises.ts` — **18종 추가 (56 → 74)**.
  머신 10(랫 풀다운·시티드 로우·리버스 펙덱·체스트 프레스·숄더 프레스·레그 프레스·레그
  익스텐션·레그컬·아웃터 사이·백 익스텐션), 바벨 5(백 스쿼트·RDL·벤트오버 로우·벤치
  프레스·힙 쓰러스트), 케이블 3(페이스 풀·팔로프 프레스·힙 어브덕션).
- `src/lib/constants.ts` — `EQUIPMENT_OPTIONS`에 `group: 'home' | 'gym'` 추가(8 → 20종),
  `EQUIPMENT_LABEL` 전 값 보강, `GYM_PRESET` 신설.
- `src/store/onboarding.ts` — `setEquipmentBulk(list, on)` 추가(프리셋 일괄 토글).
- `/onboarding/profile` — 장비 칩을 집/헬스장 섹션으로 분리 + "헬스장 다닌다 · 전체 선택" 프리셋 버튼.
  칩이 20개로 늘어 플랫 목록이 쓰기 어려워졌기 때문이다.
- `scripts/verify-gym.ts` (신규) + `npm run verify:gym`.

### 교정운동 앱으로서 지킨 것

- **흉근 프레스의 targets에 `rounded_shoulder`를 넣지 않았다.** 굽은 어깨 사용자에게
  체스트 프레스·벤치 프레스가 핵심 운동으로 올라오면 증상을 악화시킨다.
  대신 리버스 펙덱·케이블 페이스 풀을 `rounded_shoulder: 1.0`으로 배치했다.
- 아웃터 사이(중둔근)를 `hip_instability: 0.9`로 두어 고관절 불안정의 머신 대안을 만들었다.
- 바벨 종목에 `lumbar_disc`·`knee_pain` 금기를 빠짐없이 달았다.

### 확인 방법

| 검증 | 결과 |
|---|---|
| `npm run verify:gym` | **PASS 8 / FAIL 0** |
| `npm run verify:seed` (Supabase 시드 대조) | **PASS 9 / FAIL 0** |
| `npm run verify` (회귀) | 전 항목 PASS |
| `npx playwright test` | **3 passed** (Supabase 스펙 skip) |
| `E2E_SUPABASE=1 npx playwright test` | **1 passed** (localStorage 스펙 3건 skip) |
| `npx tsc --noEmit` · `npx next build` | 통과 |

`verify-gym.ts`가 확인하는 것: 헬스장 프리셋에 머신 운동 배정(11종),
**홈 사용자에게 헬스장 운동 누출 0건**, 기구 AND 조건(랙 없으면 백 스쿼트 제외),
시간 오차 유지, 흉근 프레스 targets 편향 없음, 금기 태그 적용, DRAX 매핑 커버리지.

### Supabase 재시드 완료 ✅

`node --env-file=.env.local scripts/seed-exercises.ts` 실행 → **74종 적재 (progression 7건 연결)**.
`equipment`가 `text[]`이고 CHECK 제약이 없어 마이그레이션은 필요하지 않았다.

검증용으로 `scripts/verify-seed.ts` + `npm run verify:seed`를 신설했다. DB를 직접 읽어
로컬 시드와 대조한다 — 행 수, 양방향 누락(로컬→DB 누락 / DB 유령 행), 신규 18종 적재,
**전 74종의 `equipment` 배열 값 일치**(`text[]`라서 오타가 조용히 통과할 수 있다),
신규 근육군 `delt` 저장, 흉근 프레스의 `rounded_shoulder` 부재, 금기 태그, `is_active`.
결과 **PASS 9 / FAIL 0**. e2e 양쪽 모드를 돌린 뒤 재실행해도 74종 유지(테스트가 운동 마스터를 건드리지 않는다).

DB 기준 phase 분포: release 10 · mobility 10 · activation 15 · strength 33 · integration 6.

> ⚠️ `scripts/verify-seed.ts`를 처음 만들 때 env 가드를 빼먹어 `next build`가 깨졌다.
> `scripts/*.ts`도 빌드 타입 체크 대상이므로 `seed-exercises.ts`처럼
> `if (!url || !key) process.exit(1)` 가드를 반드시 넣어야 한다.

### 남은 것

1. **전문가 검수 대상 확대** — 신규 18종의 처방·금기도 검수 범위에 들어간다.
   특히 바벨 종목(intensity 4~5)은 `level: 1` 사용자에게 가는 것이 적절한지 확인이 필요하다.
2. **`mediaRef` 여전히 전 74종 null.**
3. **머신 운동에 phase 편중** — 추가분 18종 중 17종이 strength다.
   `integration`은 아직 6종이라 어느 모드에서든 마무리 블록이 매 세션 거의 동일하다.
   DRAX 스트레칭 라인을 참조해 integration을 늘리는 것이 다음 후보다.
4. **`progressionId` 미연결** — 이 필드는 엔진에서 아직 쓰이지 않는다(선언만 존재).
   맨몸 → 바벨 진행을 걸면 기구 미보유 사용자에게 상위 운동이 새므로,
   구현 시 기구 보유 여부를 함께 검사해야 한다. 그래서 신규 18종에는 의도적으로 걸지 않았다.
5. **모드 개념(2·3단계)은 아직 없다** — 지금은 기구 프리셋뿐이다.
   `style` 축(맨몸/헬스장/필라테스/요가/스트레칭)과 phase 예산 프로파일은 미착수.
   `phaseBudgets()`가 concern에서만 예산을 파생시키므로, 모드가 strength 비중을
   조정하려면 이 함수에 프로파일 인자를 받게 고쳐야 한다.

---

## 2026-09-04 — 시연 영상 도입 (유튜브 큐레이션) · 구조 완료, 콘텐츠 진행 중

CapCut Pro로 영상을 직접 제작하는 안을 먼저 검토했으나 **유튜브 큐레이션으로 전환**했다.
AI 생성 동작 대신 실제 물리치료사·병원 채널 영상을 쓰면 검수 질문이
"AI가 해부학적으로 가능한 관절 각도를 그렸나"에서 "이 영상이 이 운동에 맞나"로 바뀐다.
제작 부담·저장 용량·egress가 전부 0이 되고, Storage 이전·sha256 재서명·MP4 규격 검사가 사라진다.

### 설계 판단 3가지

**① `Exercise.mediaRef`를 쓰지 않는다.** `plan-service.ts`가 `Exercise` 객체 전체를
`StoredSession.blocks` 스냅샷으로 동결하므로(SPEC 4.3), `mediaRef`에 링크를 넣으면
ⓐ 이미 계획을 만든 사용자는 계획이 끝날 때까지 영상을 못 보고
ⓑ **영상이 삭제돼도 이미 만들어진 계획의 죽은 링크를 고칠 수 없다.**
유튜브는 링크 로트가 필연이므로 ⓑ가 결정적이다. → 별도 매니페스트 `src/data/exercise-media.ts`.
`mediaRef`는 스키마 호환을 위해 null로 남기고, `verify-media.ts`가 트립와이어로 단정한다.

**② 실행 화면에는 넣지 않는다 (코드 변경 0).** `useWakeLock`의 iOS 폴백이 무음 오디오를
`volume = 0.01`로 **재생 중**이라(muted가 아니다), 소리 있는 유튜브가 오디오 세션을 뺏으면
40분 세션 도중 화면 꺼짐 방지가 조용히 해제된다. 광고가 루틴 중간에 도는 문제,
`transition` 스텝이 iPhone 13에서 이미 26px 넘치는 문제가 그다음이다.
→ `session/[date]/page.tsx`·`session-runner.ts`·`useWakeLock.ts` 전부 무수정.

**③ `showMedia` 기본값을 `showCues`에 묶었다.** 미리보기는 `showCues={false}`인데
거기에 영상만 남으면 영상이 폼 지도의 유일한 전달 수단이 된다(스크린리더·영상 미재생 시 지도 소실).
규칙을 주석이 아니라 기본값으로 강제했다.

### 만든 것

- `src/data/exercise-media.ts` — 매니페스트 + `REVIEWERS` 화이트리스트 + `exerciseVideos()` resolver.
  **`reviewedBy`(REVIEWERS 멤버) + `reviewedAt`이 둘 다 있어야 노출**된다. 값 import가 없어 Node가
  확장자 없는 경로를 만나지 않는다(`exercises.ts`가 `import type`만 쓰는 것과 같은 이유).
- `src/components/ExerciseVideos.tsx` — 썸네일 카드 목록 + 네이티브 `<dialog>` 라이트박스
  (포커스 트랩·Escape 무료). iframe은 **열린 동안에만 마운트**한다 — 남기면 오디오가 계속 재생된다.
  임베드 차단 영상용 "유튜브에서 열기" 탈출구 상시 노출. 채널명 표시(저작권 의무).
  `youtube-nocookie.com` 임베드, `i.ytimg.com` 썸네일, 순수 `<img>`(next.config.ts 무수정).
- `scripts/verify-media.ts` (`npm run verify:media`) — 오프라인 무결성 13종 +
  `--check-links`로 유튜브 oEmbed 생존 확인. **게이트를 데이터가 아니라 resolver 실행으로 단정**한다.
- `e2e/ytimg.ts` + 3개 스펙에 `page.route` 스텁, `e2e/media.spec.ts` 2건.
- `docs/MEDIA.md` — 검색·검수·링크 로트 대응·저작권 절차서.

### 확인 방법

| 검증 | 결과 |
|---|---|
| `verify` · `verify:runner` · `verify:gym` | 전 항목 PASS (회귀) |
| `verify:media` | 전 항목 PASS · 커버리지 0/74 검수완료, 후보 5종 12건 |
| `verify:media -- --check-links` | 12건 전부 생존·임베드 가능, 제목/채널 드리프트 0 |
| `tsc --noEmit` · `next build` | 통과 (17 routes) |
| `npx playwright test` | **4 passed** (media 게이트 포함) |
| `E2E_SUPABASE=1 npx playwright test` | **1 passed** |

**게이트를 실제로 증명한 방법**: 임시로 영상 1건만 승인해 돌렸더니
승인분은 렌더되고 미검수 11건은 차단된 상태가 같은 페이지에 공존하며 두 테스트 모두 통과했다.
확인 후 임시 승인은 되돌렸다(현재 매니페스트에 `reviewedAt` 0건).

`e2e/media.spec.ts`의 게이트 테스트는 **계획의 "수동 확인 ①"을 자동화한 것**이다 —
후보가 대기 중인 지금 상태에서 실제로 화면에 아무것도 안 나오는지 단정한다.

### 알아둘 것

- **스크린샷은 이전부터 비결정적이다.** 같은 코드로 두 번 돌려 `03-profile.png`의 md5가 달랐다.
  ytimg 스텁은 영상이 들어온 뒤의 *추가* churn과 네트워크 의존을 막는 것이지,
  기존 흔들림을 고치지는 않는다. 원인은 별도 조사가 필요하다.
- **Playwright 번들 Chromium에는 H.264 등 독점 코덱이 없다.** `media.spec.ts`가 DOM 속성만
  단정하는 이유다. 실제 재생 확인은 실기기 몫이다.

### 남은 것 — 사람이 해야 한다

1. **후보 12건 검수** (`docs/MEDIA.md` 3-3 체크리스트). 통과분에 `reviewedBy: 'jmd'` + `reviewedAt` 기입, 탈락분은 삭제.
2. **나머지 69종 후보 수집.** 파일럿 결과 페이즈별 검색 난이도가 크게 다르다 —
   `strength`·`mobility`는 한국어 검색으로 충분하지만, `release`·`integration`은
   명칭이 표준화돼 있지 않아 정확도가 낮다(상세는 `docs/MEDIA.md` 6절).
3. **실기기 확인**: 라이트박스를 닫은 뒤 소리가 멈추는지(iframe 언마운트).
