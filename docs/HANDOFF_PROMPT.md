# 다른 AI에게 붙여넣을 지시문

아래 블록을 그대로 복사해서 쓰면 된다. `docs/SPEC.md`, `src/lib/engine.ts`, `src/data/exercises.ts`를
함께 첨부하거나 같은 저장소에서 작업하게 할 것.

---

## A. 전체 앱을 한 번에 맡길 때

```
너는 이 프로젝트의 프론트엔드 개발자다.

[프로젝트]
헬스장 회원용 커스텀 교정운동 웹앱(모바일 웹/PWA).
사용자가 자기 체형 문제(굽은어깨, 거북목, 불안한 고관절, 골반 불균형, 대근육 강화)를 고르면
40분짜리 운동 루틴을 자동 조합하고, 시작일~종료일 사이에 2주 사이클로 반복 배치한다.

[이미 완성된 것 — 절대 다시 만들지 마라]
- src/lib/engine.ts : 도메인 타입 + 40분 타임박싱 + 운동 조합 알고리즘 + 2주 스케줄 엔진.
                      런타임 import가 0인 순수 함수 모듈이다. 그대로 가져다 쓴다.
- src/data/exercises.ts : 운동 시드 DB 56종.
- scripts/verify.ts : 엔진 검증 스크립트. `node scripts/verify.ts` 로 전 항목 통과 확인됨.
- docs/SPEC.md : 제품/알고리즘/DB스키마/화면/완료기준 전체 사양. 이게 단일 진실 소스다.

[네가 만들 것]
docs/SPEC.md의 5장(화면·라우팅), 6장(API), 7장(기술 스택)을 그대로 구현한다.
Next.js 15 App Router + TypeScript + Tailwind + Supabase + PWA.

[구현 순서 — 이 순서를 지켜라]
1. Next.js 앱 스캐폴딩. 기존 src/lib, src/data를 그대로 이식하고 typecheck 통과시킨다.
2. 온보딩 4화면 (/onboarding/concerns, /profile, /schedule, /preview). 상태는 일단 클라이언트 보관.
3. 미리보기 화면에서 buildPlan()을 실제로 호출해 결과를 렌더링한다.
   ← 이 단계에서 반드시 멈추고 스크린샷과 함께 결과를 보고할 것.
4. 캘린더(/plan) + 루틴 상세(/plan/[date])
5. 실행 화면(/session/[date]) — SPEC 5.1의 필수 동작을 전부 만족시킨다.
6. Supabase 연동 (SPEC 4.3 스키마 + RLS). 그 전까지는 localStorage로 동작해도 된다.
7. 완료/기록/진도율, PWA, 배포

[반드시 지킬 것]
- engine.ts의 시간 계산식과 페이즈 순서를 바꾸지 마라. 40분 정확도가 여기에 달려 있다.
- 전환 시간 20초(TRANSITION_SEC)를 시간 계산에서 빼지 마라.
- 계획 생성 시 엔진 출력(blocks)을 스냅샷으로 저장해라. 운동 DB가 바뀌어도 과거 루틴은 그대로여야 한다.
- 목표(concerns) 배열의 "순서"가 우선순위다. UI에서 순서를 바꿀 수 있게 만들어라.
- 실행 화면 타이머는 setInterval 누적이 아니라 절대 시각(Date/performance.now) 기준으로 계산해라.
  iOS Safari는 백그라운드에서 타이머가 멈춘다.
- 의학적 면책 고지(SPEC 5.2)를 온보딩 마지막과 세션 시작 화면에 반드시 넣어라.
- 모바일 우선. max-width 480px 중앙 정렬.

[완료 기준]
docs/SPEC.md 9장의 체크리스트를 전부 만족해야 완료다. 각 항목을 어떻게 확인했는지 함께 보고해라.

[보고 방식]
각 단계가 끝날 때마다 무엇을 만들었고 무엇이 남았는지 짧게 보고하고 다음 단계로 넘어가라.
사양에 없는 기능을 임의로 추가하지 마라. 애매하면 물어봐라.
```

---

## B. 화면 하나만 맡길 때 (예: 실행 화면)

```
docs/SPEC.md의 5.1절(실행 화면)만 구현해라.

경로: /session/[date]
입력: buildSession()이 반환한 SessionPlan (타입은 src/lib/engine.ts 참조)

필수 동작
- hold형 운동은 카운트다운, reps형 운동은 수동 완료 버튼 — 두 모드를 모두 지원
- 세트 간 휴식 자동 카운트다운 후 다음 세트 자동 진입
- navigator.wakeLock으로 화면 꺼짐 방지 (미지원 시 무음 오디오 루프 폴백)
- visibilitychange에서 절대 시각 기준으로 경과 시간 재계산 (iOS Safari 대응)
- 상단에 전체 진행 바 + 예상 종료 시각
- 하단에 다음 운동 프리뷰
- 일시정지/중단 가능. 중단 시 진행 상태를 localStorage에 저장하고 재진입 시 복원
- 각 운동 카드에 exercise.cues를 표시

하지 말 것
- engine.ts 수정 금지. 이 화면은 SessionPlan을 소비만 한다.
- 세트/렙/휴식 값을 화면에서 임의로 바꾸지 마라. prescription 값을 그대로 따른다.
```

---

## C. 운동 DB만 확장/검수할 때

```
src/data/exercises.ts의 운동 목록을 확장해라.

규칙
- Exercise 인터페이스(src/lib/engine.ts)를 정확히 따른다.
- phase는 release / mobility / activation / strength / integration 중 하나.
- targets 값 기준: 0.9~1.0 = 그 목표의 핵심 운동 / 0.5~0.7 = 보조 / 0.2~0.4 = 간접 기여
- prescription은 실제 수행 가능한 값이어야 한다. 이 값으로 세션 시간이 계산된다.
- cues는 2~3개. "무엇을 느껴야 하는가"와 "무엇을 하면 안 되는가"를 담는다.
- 장비가 필요 없는 운동은 equipment: ['none'] 또는 ['mat'] 으로 둔다.
  각 phase마다 무장비 운동이 최소 4종은 있어야 장비 미보유 사용자도 루틴을 받는다.
- 위험 요소가 있으면 contraindications에 태그를 넣는다.
  (knee_pain, shoulder_impingement, cervical_disc, lumbar_disc, wrist_pain, groin_strain, dizziness)

추가한 뒤 반드시 `node scripts/verify.ts`를 실행해서 전 항목이 통과하는지 확인하고 결과를 보고해라.
시간 오차가 ±2분을 벗어나면 prescription 값을 조정해라.
```

---

## D. 인계 시 함께 전달할 주의사항

이건 AI 지시문이 아니라 **사람이 알고 있어야 할 내용**이다.

1. **운동 DB는 아직 전문가 검수 전이다.** 개발은 진행해도 되지만, 오픈 전에
   물리치료사 또는 교정운동 전문가의 검수를 반드시 1회 이상 받아야 한다.
   특히 경추(거북목)와 고관절 불안정 관련 운동은 잘못 처방하면 악화 요인이 된다.
2. **영상/이미지가 없다.** `mediaRef`가 전부 null이다. 텍스트 큐만으로도 앱은 돌아가지만
   실사용 품질은 콘텐츠가 좌우한다. 개발과 병행해서 촬영 일정을 잡을 것.
3. **AI가 사양에 없는 기능을 추가하려 들면 막아라.** 특히 "AI 코치", "자동 체형 분석",
   "소셜 공유" 같은 것. 40분 루틴 정확도와 실행 화면 완성도가 이 제품의 전부다.
