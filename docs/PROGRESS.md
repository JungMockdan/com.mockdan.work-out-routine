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
