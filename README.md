# 모꾸 교정운동 (moccu_work_out)

헬스장 회원용 **커스텀 교정운동 조합 시스템** — 모바일 웹/PWA.

체형 문제(굽은어깨 · 거북목 · 불안한 고관절 · 골반 불균형 · 대근육 강화)를 우선순위로 선택하면
**40분 루틴**을 자동 조합하고, **시작일~종료일** 사이에 **2주 사이클**로 배치한다.
캘린더에서 오늘 루틴을 열고 타이머를 따라 수행하면 완료·RPE·통증이 기록된다.

단일 진실 소스: [`docs/SPEC.md`](docs/SPEC.md) · 구현 보고: [`docs/PROGRESS.md`](docs/PROGRESS.md)

---

## 실행

Node **22.18+** (TypeScript 파일 직접 실행에 사용).

```bash
npm install
npm run dev            # http://localhost:3000
npm run build && npm start
```

기본은 **localStorage 모드**로 동작한다(계정·서버 DB 불필요, 데이터는 기기에 저장).

### Supabase 모드 (선택)

`.env.example`을 `.env.local`로 복사하고 키를 채우면 저장소가 자동 전환된다.

```bash
# 1) 스키마 적용 (supabase CLI 또는 SQL 편집기에서 supabase/migrations/0001_init.sql 실행)
# 2) 운동 시드 적재
node --env-file=.env.local scripts/seed-exercises.ts
# 3) Supabase 대시보드에서 Authentication → Anonymous sign-ins 활성화
```

## 검증

```bash
npm run verify         # 엔진: 40분 정확도·다양성·금기 제외·재현성
npm run verify:runner  # 실행 화면 상태 머신: 절대 시각 보정·일시정지·건너뛰기
npm run verify:gym     # 헬스장 모드: 기구 조건·홈 사용자 격리
npm run verify:media   # 시연 영상: 검수 게이트·매니페스트 무결성
npm run verify:media -- --check-links   # + 유튜브 링크 생존 확인 (네트워크)
npm run typecheck
npm run test:e2e       # Playwright (모바일 뷰포트, docs/screenshots/ 갱신)
```

## 구조

```
src/lib/engine.ts        코어 엔진 (타임박싱·조합·스케줄) — 수정 금지, 런타임 의존성 0
src/data/exercises.ts    운동 시드 DB 56종 (⚠️ 전문가 검수 전)
src/lib/session-runner.ts 실행 화면 상태 머신 (절대 시각 기반, 순수 모듈)
src/lib/plan-service.ts  입력 검증 + 계획 생성/재생성 (blocks 스냅샷 보존)
src/lib/repo/            저장소 추상화 (localStorage ↔ Supabase 자동 선택)
src/app/                 화면: 온보딩 4단계 → 미리보기 → 캘린더 → 실행 → 완료, 설정
src/app/api/             SPEC 6 서버 라우트 (엔진은 서버에서만 실행)
supabase/migrations/     스키마 + RLS
scripts/                 verify · verify-runner · seed-exercises · make-icons
e2e/                     Playwright 시나리오
```

## 주의

- **운동 DB는 전문가(물리치료사/교정운동 전문가) 검수 전이다.** 오픈 전 검수 필수 (SPEC 9·10).
- **시연 영상은 검수를 통과한 것만 노출된다.** 후보를 `src/data/exercise-media.ts`에 넣어도
  `reviewedBy`/`reviewedAt`가 없으면 앱에 나오지 않는다. 현황은 `npm run verify:media`,
  제작·검수 절차는 `docs/MEDIA.md`. (`Exercise.mediaRef`는 미사용 — 이유는 SPEC 10.2)
- 의학적 진단·치료가 아니다. 면책 고지는 온보딩 마지막·세션 시작 화면에 노출된다.
