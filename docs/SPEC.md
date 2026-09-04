# 커스텀 교정운동 조합 시스템 — 개발 사양서 v0.1

모바일 웹(PWA) 서비스. 사용자가 자신의 체형 문제를 선택하면 **40분 루틴**을 자동 조합하고,
**시작일~종료일** 사이에 **2주 사이클**로 반복 배치한다.

이 문서는 **다른 AI/개발자에게 그대로 인계**하기 위한 단일 진실 소스(single source of truth)다.
코어 로직은 이미 구현되어 있고 검증까지 끝났다. 남은 일은 **UI + 저장소 + 콘텐츠**다.

---

## 0. 현재 구현 상태

| 영역 | 상태 | 파일 |
|---|---|---|
| 도메인 타입 정의 | ✅ 완료 | `src/lib/engine.ts` |
| 시간 계산(40분 타임박싱) | ✅ 완료 | `src/lib/engine.ts` |
| 운동 조합 알고리즘 | ✅ 완료 | `src/lib/engine.ts` |
| 2주 사이클 스케줄 엔진 | ✅ 완료 | `src/lib/engine.ts` |
| 운동 시드 DB (56종) | ✅ 완료 (전문가 검수 필요) | `src/data/exercises.ts` |
| 엔진 검증 스크립트 | ✅ 완료 (전 항목 통과) | `scripts/verify.ts` |
| Next.js 앱 / 화면 | ❌ 미착수 | — |
| 저장소(Supabase) | ❌ 미착수 | — |
| 운동 영상·이미지 | ❌ 미착수 (`mediaRef` 전부 null) | — |

검증 실행:

```bash
npm run verify
```

---

## 1. 제품 정의

### 1.1 해결하는 문제
헬스장 회원이 자기 체형 문제(굽은어깨·거북목·고관절 불안정·골반 불균형)에 맞는 운동을
**무엇을, 몇 세트, 어떤 순서로, 40분 안에** 해야 하는지 모른다.

### 1.2 핵심 사용자 흐름
1. 개선하고 싶은 문제를 **우선순위 순서로** 선택 (복수 선택)
2. 레벨·보유 장비·주당 횟수·시작일/종료일 입력
3. 시스템이 전체 기간의 일자별 루틴을 생성
4. 캘린더에서 오늘 루틴을 열고, 타이머를 따라 40분 수행
5. 완료 체크 → 진도율 누적

### 1.3 5가지 개선 목표 (`Concern`)
| 코드 | 한글 |
|---|---|
| `rounded_shoulder` | 굽은 어깨 |
| `forward_head` | 거북목 |
| `hip_instability` | 불안한 고관절 |
| `pelvic_tilt` | 골반 불균형 |
| `major_muscle` | 대근육 강화 |

---

## 2. 조합 알고리즘 (구현 완료 — 규칙 설명)

### 2.1 세션 구조: 5단계 페이즈
교정운동의 표준 흐름을 그대로 따른다. **순서를 바꾸면 안 된다.**

```
release(이완) → mobility(가동성) → activation(활성화) → strength(강화) → integration(통합·정리)
```

기본 시간 배분(40분 = 2400초 기준):

| 페이즈 | 기본 비율 | 기본 시간 |
|---|---|---|
| release | 12.5% | 5분 |
| mobility | 15% | 6분 |
| activation | 17.5% | 7분 |
| strength | 42.5% | 17분 |
| integration | 12.5% | 5분 |

### 2.2 목표에 따른 시간 재배분
선택한 목표가 페이즈 예산을 편향시킨다 (`CONCERN_PHASE_BIAS`).
- **대근육 강화**를 고르면 strength ×1.8, release ×0.7 → 강화 시간이 크게 늘어남
- **거북목**을 고르면 release ×1.4, activation ×1.4, strength ×0.75
- 복수 선택 시 각 목표 가중치로 가중 평균한 뒤 합이 40분이 되도록 정규화

목표 가중치: 첫 번째로 고른 항목 1.0, 이후 **0.85배씩 감쇠** 후 정규화.
→ 선택 순서가 곧 우선순위다. **UI에서 순서를 바꿀 수 있어야 한다.**

### 2.3 운동 선택 점수식
각 페이즈 예산 안에서 그리디로 채운다. 점수가 높은 순으로 선택:

```
점수 = 목표적합도 × 100          // 지배적 항
     + 그날 강조부위 보너스 (±12)  // 상체/하체 번갈아
     − 세션 내 근육 중복 × 14      // 한 부위 과부하 방지
     − 사이클 내 사용 횟수 × 9      // 2주 내내 같은 운동 방지
     − |강도 − 레벨적정강도| × 6    // 레벨 매칭
     + 결정론적 난수 (0~4)         // 동점 처리 + 다양성
```

**제외 규칙**
- 보유하지 않은 장비를 요구하는 운동 (`none`/`mat`은 항상 보유로 간주)
- 사용자 금기 태그(`avoidTags`)와 겹치는 `contraindications`를 가진 운동
- 남은 예산을 크게 초과하는 운동

### 2.4 회차별 강조 부위 로테이션
연속된 날 같은 부위를 반복하면 회복이 안 된다.

```
1회차 upper → 2회차 lower → 3회차 full → 4회차 lower → 5회차 upper → …
(sessionIndex % 3 === 0 → full, 홀수 → upper, 짝수 → lower)
```

### 2.5 40분 정확도 보정
그리디만으로는 시간이 정확히 안 맞으므로 `trimToTarget()`이 후처리한다.
- **부족하면**: strength 블록 마지막 운동의 세트 +1 (반복)
- **초과하면**: 모든 운동의 휴식을 5초씩 감소 → 그래도 넘치면 세트 −1 → 운동 제거

**허용 오차: ±120초.** 검증 결과 실제 세션은 39.2~40.9분 범위에 들어온다.

---

## 3. 2주 사이클 스케줄 엔진

### 3.1 요일 패턴
| 주당 횟수 | 요일 |
|---|---|
| 2회 | 화, 금 |
| 3회 | 월, 수, 금 |
| 4회 | 월, 화, 목, 금 |
| 5회 | 월~금 |

시작일~종료일 사이에서 해당 요일만 운동일, 나머지는 `restDates`.

### 3.2 주차 판정과 점진적 과부하
`dayOffset = 시작일로부터 며칠째` 기준으로:
- `week = (dayOffset % 14) < 7 ? 1 : 2`
- **2주차 보정**: 반복수/유지시간 **+12%**, 휴식 **−10%**

### 3.3 사이클 반복
기간이 14일보다 길면 사이클이 반복된다.
- 새 사이클 진입(`dayOffset % 14 === 0`) 시 운동 사용 이력 초기화
- 시드를 `seed + cycle * 1000`으로 변경 → **3주차부터는 다른 운동 조합**이 나온다

### 3.4 레벨 보정
| 레벨 | 보정 |
|---|---|
| 1 (입문) | 세트 −1(3세트 이상일 때), 휴식 ×1.2 |
| 2 (중급) | 보정 없음 |
| 3 (상급) | 반복/유지 ×1.15, 휴식 ×0.85 |

---

## 4. 데이터 모델

### 4.1 운동 (`Exercise`)
`src/lib/engine.ts`의 인터페이스가 정본. 핵심 필드:

| 필드 | 설명 |
|---|---|
| `phase` | 5단계 중 어디에 속하는가 |
| `targets` | 목표별 기여도 0~1 (0.9↑ 핵심 / 0.5~0.7 보조 / 0.2~0.4 간접) |
| `primaryMuscles` | 중복 패널티 계산에 사용 |
| `intensity` | 1~5, 레벨 매칭에 사용 |
| `equipment` | 필터링 기준 |
| `prescription` | **시간 계산의 유일한 근거** |
| `cues` | 실행 화면에 표시할 코칭 포인트 (2~3개) |
| `contraindications` | 금기 태그 |
| `progressionId` | 상위 난이도 운동 id |
| `mediaRef` | 영상/이미지 에셋 키 (현재 전부 null) |

### 4.2 시간 계산식
```
1세트 시간 = holdSec ?? (reps × tempoSec)      // tempoSec 기본 3초
좌우 운동이면 × 2
총 시간 = 1세트 시간 × sets + restSec × (sets − 1) + 20초(전환)
```
**전환 시간 20초는 반드시 포함해야 한다.** 빼면 실제 수행 시간이 40분을 훨씬 넘는다.

### 4.3 DB 스키마 (Supabase / PostgreSQL)

```sql
-- 운동 마스터 (src/data/exercises.ts를 시드로 적재)
create table exercises (
  id            text primary key,
  name_ko       text not null,
  name_en       text not null,
  phase         text not null check (phase in ('release','mobility','activation','strength','integration')),
  targets       jsonb not null default '{}',      -- {"rounded_shoulder":1.0, ...}
  primary_muscles   text[] not null,
  secondary_muscles text[] default '{}',
  intensity     smallint not null check (intensity between 1 and 5),
  equipment     text[] not null,
  prescription  jsonb not null,                   -- {sets,reps,holdSec,tempoSec,restSec,perSide}
  cues          text[] not null default '{}',
  contraindications text[] default '{}',
  progression_id text references exercises(id),
  media_ref     text,
  is_active     boolean not null default true,
  reviewed_by   text,                             -- 전문가 검수자
  reviewed_at   timestamptz
);

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text,
  level       smallint not null default 2 check (level between 1 and 3),
  equipment   text[] not null default '{}',
  avoid_tags  text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- 생성된 계획 (입력값 + 스냅샷)
create table plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  start_date     date not null,
  end_date       date not null,
  days_per_week  smallint not null check (days_per_week between 2 and 5),
  session_minutes smallint not null default 40,
  concerns       text[] not null,                 -- 순서 = 우선순위
  level          smallint not null,
  equipment      text[] not null,
  avoid_tags     text[] not null default '{}',
  seed           integer not null,
  status         text not null default 'active' check (status in ('active','completed','abandoned')),
  created_at     timestamptz not null default now()
);

-- 일자별 세션 (엔진 출력을 그대로 저장 — 재생성해도 과거 기록이 바뀌지 않게)
create table sessions (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references plans(id) on delete cascade,
  date          date not null,
  session_index smallint not null,
  week          smallint not null check (week in (1,2)),
  focus         text not null check (focus in ('upper','lower','full')),
  blocks        jsonb not null,                   -- Block[] 스냅샷
  total_sec     integer not null,
  status        text not null default 'planned' check (status in ('planned','in_progress','done','skipped')),
  completed_at  timestamptz,
  elapsed_sec   integer,                          -- 실제 소요 시간(완료 시 기록). ⚠️ 사인오프 대기
  unique (plan_id, date)
);

-- 운동 단위 수행 기록
create table session_logs (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references sessions(id) on delete cascade,
  exercise_id    text not null references exercises(id),
  completed_sets smallint not null default 0,
  rpe            smallint check (rpe between 1 and 10),   -- 자각 강도
  pain_flag      boolean not null default false,          -- 통증 신고
  note           text,
  logged_at      timestamptz not null default now()
);
```

**RLS 필수**: `profiles`, `plans`, `sessions`, `session_logs`는 `user_id = auth.uid()` 기준으로
select/insert/update 정책을 걸 것. `exercises`는 전체 읽기 허용 + 쓰기 금지.

**중요**: 계획 생성 시 엔진 출력(`blocks`)을 **스냅샷으로 저장**한다.
운동 DB가 나중에 수정돼도 사용자가 이미 받은 과거 루틴이 바뀌면 안 된다.

---

## 5. 화면 · 라우팅

모바일 우선. 모든 화면 `max-width: 480px` 중앙 정렬.

| 경로 | 화면 | 핵심 요소 |
|---|---|---|
| `/` | 온보딩 / 홈 | 진행 중인 계획 있으면 오늘 루틴 카드, 없으면 시작 CTA |
| `/onboarding/concerns` | 목표 선택 | 5개 카드 복수 선택 + **드래그로 우선순위 정렬** |
| `/onboarding/profile` | 레벨·장비 | 레벨 3택1, 장비 칩 다중 선택, 통증 부위(금기 태그) |
| `/onboarding/schedule` | 기간 설정 | 시작일·종료일 데이트피커, 기간 프리셋 칩(2/4/8/12주 — ⚠️ 사인오프 대기), 주당 횟수 2~5, 세션 시간(기본 40분) |
| `/onboarding/preview` | 생성 결과 미리보기 | 첫 세션 전체 + 2주 캘린더 요약, "이 계획 시작하기" |
| `/plan` | 캘린더 | 월간 그리드, 운동일/휴식일/완료 상태 표시, 진도율 바 |
| `/plan/[date]` | 해당 일 루틴 상세 | 페이즈별 아코디언, 운동 카드(이름·처방·시간·큐) |
| `/session/[date]` | **루틴 실행** | 타이머, 세트 카운터, 다음 운동 프리뷰, 진행 바, 건너뛰기 |
| `/session/[date]/done` | 완료 | 소요 시간, RPE 입력, 통증 신고, 진도율 갱신 |
| `/settings` | 설정 | 프로필 수정, 계획 재생성, 데이터 초기화 |

### 5.1 실행 화면(`/session/[date]`) — 가장 공수가 큰 화면
필수 동작:
- 운동 시간(hold) / 반복(reps) 두 모드 지원 — hold는 카운트다운, reps는 수동 완료 버튼
- 세트 간 휴식 자동 카운트다운 + 다음 세트 자동 진입
- **화면 꺼짐 방지**: `navigator.wakeLock` (미지원 시 무음 오디오 루프 폴백)
- **백그라운드 복귀 시 시간 보정**: `visibilitychange`에서 경과 시간을 `performance.now()` 기준으로 재계산
  (iOS Safari는 백그라운드에서 `setInterval`이 멈춘다 — 절대 시각 기준으로 계산할 것)
- 종료 시각 예측 표시("예상 종료 14:38")
- 언제든 일시정지/중단 가능, 중단 시 진행 상태 로컬 저장

### 5.2 필수 고지
온보딩 마지막과 세션 시작 화면에 표시:
> 본 서비스는 의학적 진단·치료가 아닙니다. 통증이 발생하면 즉시 중단하고 전문의와 상담하세요.
> 급성 통증, 최근 수술, 임신 중이라면 시작 전 전문가와 상의하세요.

---

## 6. API (서버 라우트)

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/api/plans` | `PlanInput` → 엔진 실행 → `plans` + `sessions` 저장 → `Plan` 반환 |
| `GET` | `/api/plans/current` | 진행 중 계획 + 오늘 세션 |
| `GET` | `/api/sessions/[date]` | 해당 일 세션 상세 |
| `POST` | `/api/sessions/[id]/complete` | 완료 처리 + `session_logs` 일괄 기록 |
| `POST` | `/api/plans/[id]/regenerate` | 시드 변경 후 **미수행 세션만** 재생성 (완료분은 보존) |

엔진은 **서버에서 실행**한다. 클라이언트에서 돌리면 운동 DB 전체를 내려보내야 한다.

구현하면서 추가된 라우트 (⚠️ 사인오프 대기 — 위 표에 없던 것):

| 메서드 | 경로 | 설명 | 추가 이유 |
|---|---|---|---|
| `POST` | `/api/profile` | `profiles` 행 병합 저장 | 설정 화면(5장)의 "프로필 수정"에 저장처가 필요 |
| `POST` | `/api/reset` | 사용자의 `plans` 삭제(cascade) | 설정 화면의 "데이터 초기화"에 저장처가 필요 |
| `POST` | `/api/sessions/[id]/status` | 세션 상태를 `planned`/`in_progress`/`skipped`로 갱신 | 실행 화면의 시작·중단이 완료(`complete`)와 별개 상태 전이를 쓴다 |

세 라우트 모두 Supabase 모드 전용이다. localStorage 모드에서는 `501`을 반환하고 클라이언트가 로컬 저장소를 직접 쓴다.

---

## 7. 기술 스택

- **Next.js 15 (App Router) + TypeScript**
- **Tailwind CSS** — 모바일 우선
- **Supabase** — Postgres + Auth + RLS
- **Zustand** — 온보딩 입력 상태(`src/store/onboarding.ts`, persist). ⚠️ 사인오프 대기
  - 원래 문구는 "실행 화면의 타이머 상태만"이었다. 실제 구현은 반대가 됐다.
  - 실행 화면 타이머는 Zustand를 쓰지 않는다. `src/lib/session-runner.ts`의 순수 상태 머신 +
    화면단 `useState`로 만들었다. 경과 시간을 절대 시각으로 계산해야 해서 전역 스토어가 이득이 없었다.
  - 대신 온보딩 4화면이 화면 간 입력을 넘겨야 해서 여기에 persist 스토어를 썼다.
- **Vercel** 배포, **PWA** (manifest + service worker, 홈 화면 추가)
- 날짜는 전부 `'YYYY-MM-DD'` 문자열 + UTC `Date`로만 다룬다 (엔진이 이미 그렇게 되어 있음)

---

## 8. 구현 순서 (권장)

1. **Next.js 앱 스캐폴딩** + Tailwind + 기존 `src/lib`, `src/data` 그대로 이식
2. **온보딩 4화면** — 상태는 우선 클라이언트에 보관
3. **미리보기 화면** — 엔진 호출해서 결과를 화면에 뿌리는 것까지 (여기서 로직이 맞는지 눈으로 확인됨)
4. **캘린더 + 루틴 상세**
5. **실행 화면** (가장 오래 걸림 — 별도로 시간 확보)
6. **Supabase 연동** — 그 전까지는 localStorage로 동작시켜도 된다
7. **완료/기록/진도율**
8. **PWA + 배포**

---

## 9. 완료 기준 (Acceptance Criteria)

- [ ] 5개 목표를 임의 조합으로 선택해도 모든 세션이 **40분 ±2분**
- [ ] 장비를 하나도 선택하지 않아도 **빈 페이즈 블록 없이** 루틴이 생성된다
- [ ] 2주 사이클 안에서 한 운동이 전 세션에 반복되지 않는다
- [ ] 통증 부위를 선택하면 해당 금기 운동이 **한 번도** 나오지 않는다
- [ ] 같은 입력 + 같은 시드 → 같은 루틴 (재현성)
- [ ] 실행 화면 타이머가 백그라운드 전환 후 복귀해도 **시간이 밀리지 않는다**
- [ ] iPhone Safari / Android Chrome 실기기에서 온보딩→실행→완료 전 과정 동작
- [ ] 운동 56종 전부 전문가 검수 완료(`reviewed_by`, `reviewed_at` 채워짐)
- [ ] 의학적 면책 고지가 온보딩과 세션 시작 화면에 노출

---

## 10. 알려진 한계 / 남은 결정 사항

1. **운동 DB는 검수 전이다.** `targets` 가중치와 `contraindications`는 개발자가 채운 초안이다.
   특히 고관절 불안정·경추 관련 운동은 전문가 검수 없이 오픈하면 안 된다.
2. **`mediaRef`가 전부 null이다.** 영상/이미지 없이도 `cues` 텍스트로 동작은 하지만,
   실사용에서는 시연 자료가 없으면 자세가 틀어진다. 콘텐츠 확보를 병행할 것.
3. **`progressionId`가 일부 운동에만 있다.** 현재 2주차 과부하는 볼륨 +12%로 처리하고 있고,
   운동 자체를 상위 버전으로 교체하는 로직은 아직 엔진에 넣지 않았다 (필요 시 확장).
4. **요일 패턴이 고정이다.** 사용자가 직접 요일을 고르게 하려면 `weekdayPattern()`을
   입력값으로 대체하면 된다 (엔진 수정 5줄 내외).
5. **인바디/체형 사진 기반 자동 진단은 범위 밖이다.** 현재는 사용자 자가 선택만 지원.
