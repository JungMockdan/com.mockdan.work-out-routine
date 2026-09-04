/**
 * 운동 시연 영상 매니페스트 (유튜브 큐레이션)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 왜 Exercise.mediaRef가 아니라 별도 파일인가
 * ─────────────────────────────────────────────────────────────────────────
 * src/lib/plan-service.ts가 buildPlan(input, EXERCISES)를 호출하면
 * Block.items[].exercise 에 Exercise 객체 **전체**가 들어가고, 그대로
 * StoredSession.blocks 스냅샷으로 동결된다 (localStorage 'moccu.plan.v1' /
 * Supabase sessions.blocks jsonb). SPEC 4.3이 이 불변성을 요구한다.
 *
 * 따라서 mediaRef에 영상을 넣으면:
 *   1. 이미 계획을 만든 사용자는 계획이 끝날 때까지 영상을 못 본다. 12주면 12주.
 *   2. 링크 로트를 고칠 수 없다. 유튜브 영상은 삭제·비공개로 바뀌는데,
 *      스냅샷에 박힌 링크는 **이미 만들어진 계획에서 영영 죽은 채로 남는다.**
 *      매니페스트라면 이 파일 한 줄만 고치면 전원에게 즉시 반영된다.
 *
 * mediaRef는 engine.ts(수정 금지)와 supabase 마이그레이션이 참조하므로
 * 삭제하지 않고 null로 둔다. scripts/verify-media.ts가 전부 null인지 단정한다.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 규칙
 * ─────────────────────────────────────────────────────────────────────────
 * · 영상은 cues[]를 **대체하지 않는다.** 자리를 만들려고 큐를 숨기지 말 것.
 *   스크린리더 사용자와 영상을 못 여는 상황에서 폼 지도가 통째로 사라진다.
 *
 * · **영상 검수 ≠ 처방 검수.** SPEC 9장의 미충족 기준(exercises.reviewed_by)은
 *   처방·금기의 타당성 문제다. 여기의 reviewedBy/reviewedAt은 "이 영상이 이
 *   운동의 올바른 시연인가"만 뜻한다. 이걸 채워도 SPEC 9 체크박스는 안 닫힌다.
 *
 * · **실행 화면(/session/[date])에는 넣지 않는다.** src/hooks/useWakeLock.ts의
 *   iOS 폴백이 무음 오디오를 volume 0.01로 재생 중(muted가 아니다)이라,
 *   소리 있는 유튜브가 오디오 세션을 뺏으면 40분 세션 도중 화면 꺼짐 방지가
 *   조용히 해제된다. 광고가 루틴 중간에 돌아가는 문제는 그다음이다.
 *
 * · 저작권: 공식 iframe 임베드만 쓴다. 다운로드·재호스팅 금지, 광고·브랜딩
 *   제거 금지, 카드에 **채널명을 반드시 표시**한다.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 워크플로 — 이 파일이 곧 리뷰 대기열이다
 * ─────────────────────────────────────────────────────────────────────────
 * 1. 후보를 검색해 reviewedBy/reviewedAt **없이** 기입한다. title·channel은
 *    유튜브 oEmbed에서 받아 적는다 (사람이 영상을 열지 않고 1차 선별하도록).
 * 2. exerciseVideos()가 미검수 항목을 걸러내므로 앱에는 아무것도 안 나온다.
 * 3. 사람이 영상을 보고 → reviewedBy/reviewedAt을 채우거나 항목을 지운다.
 *
 * 검증: npm run verify:media           (오프라인 — 데이터 무결성)
 *       npm run verify:media -- --check-links   (네트워크 — 링크 생존)
 */

/** 검수자 화이트리스트. 추가는 의도적인 별도 편집이어야 한다. */
export const REVIEWERS = ['mjpark'] as const;
export type Reviewer = (typeof REVIEWERS)[number];

export interface VideoEntry {
  /** 유튜브 영상 ID 11자 */
  videoId: string;
  /** oEmbed title — 사람이 열지 않고 1차 선별하기 위한 것 */
  title: string;
  /** oEmbed author_name — 출처 표시 의무 */
  channel: string;
  lang: 'ko' | 'en';
  /** 긴 영상에서 해당 구간부터 시작 */
  startSec?: number;
  /** 검색 근거 / 검수 시 주의할 점 */
  note?: string;
  reviewedBy?: Reviewer;
  /** ISO 날짜. 없으면 미검수 → 앱에 노출되지 않는다. */
  reviewedAt?: string | null;
}

/** 운동 id → 영상 목록. 배열 순서 = 우선순위(첫 항목이 대표).
 *  reviewedBy/reviewedAt 없는 항목 = 검수 대기 = 앱에 노출되지 않는다. */
export const EXERCISE_VIDEOS: Record<string, VideoEntry[]> = {
  'rel-pec-ball': [
    {
      videoId: 'l_V4oXaVaTw',
      title: '소흉근 고민을 끝내줄 영상 [라운드숄더 흉곽출구 손저림]',
      channel: '안아파연구소',
      lang: 'ko',
      note: '소흉근 주제는 맞다. ⚠️ 벽+볼 셀프 릴리즈를 실제로 보여주는지 반드시 확인 — 아니면 삭제',
    },
  ],
  'mob-worlds-greatest': [
    {
      videoId: 'ztmFO8IRAbk',
      title: '[세계에서 가장 위대한 스트레칭(중간 끊김없음/양쪽세트 연속동작) World\'s greatest stretch ]',
      channel: 'Butter',
      lang: 'ko',
      note: '중간 끊김 없는 좌우 연속 동작 — 시연용으로 가장 적합',
    },
    {
      videoId: 'lNj88v68oy8',
      title: 'world\'s greatest stretch(월드 그레이티스트 스트레칭)',
      channel: '서울 중구 체력인증센터 체력증진교실',
      lang: 'ko',
      note: '공공 체력인증센터 제작',
    },
    {
      videoId: 'kk8RnOLzngc',
      title: 'How to Do World\'s Greatest Stretch',
      channel: 'Your House Fitness',
      lang: 'en',
      note: '한국어 후보가 부족할 때의 영어 대체',
    },
  ],
  'act-chin-tuck': [
    {
      videoId: 'I-l9G6yrta8',
      title: '일자목, 거북목 교정하는 목운동! 따라만 하면 좋아집니다. [따라해보세요]',
      channel: '분당서울대학교병원',
      lang: 'ko',
      note: '병원 채널. ⚠️ 여러 목운동 묶음 — 친 턱 구간을 찾아 startSec 지정 필요',
    },
    {
      videoId: '5DZikn30YAE',
      title: '일자목 교정운동 [上편] - 물리치료사 가르치는 진짜 운동!',
      channel: '리얼리햅',
      lang: 'ko',
      note: '물리치료사. 上편이라 해당 동작이 여기 있는지 확인',
    },
    {
      videoId: 'rbdEP_xqN84',
      title: '[가물치] 거북목 교정 운동 이걸로 끝 !  #거북목스트레칭 #거북목',
      channel: '김해복음병원',
      lang: 'ko',
      note: '병원 채널',
    },
  ],
  'int-wall-posture-hold': [
    {
      videoId: 'aNfXC1BI3P4',
      title: '벽에 등을 대고 서서 꼭 하세요! 거북목, 라운드숄더로 자세가 틀어지신 분들, 무릎관절로 고생하시는 분들에게  정말 효과가 좋습니다. #shorts',
      channel: '인간미 넘치는 건강멘토',
      lang: 'ko',
      note: '⚠️ 검색 정확도 낮음. 벽 정렬 유지 동작이 맞는지 확인 — 아니면 삭제',
    },
    {
      videoId: 'HYl-aWda6YY',
      title: '어디에서나, \'벽\' 이용한 바른 자세 만들기 MBN 220114 방송',
      channel: 'MBN Entertainment',
      lang: 'ko',
      note: '⚠️ 방송 클립. 시연이 명확한지 확인',
    },
  ],
  'str-lat-pulldown': [
    {
      videoId: 'OwevV94sVO0',
      title: '등운동, 랫풀다운 정석으로 하는 방법 (한국에서 제일 정확하고 디테일하게 설명 해주는 영상)',
      channel: '파워게르만POGER',
      lang: 'ko',
      note: '자세 설명이 상세',
    },
    {
      videoId: 'dhE07Wm6jIQ',
      title: '운동 효과 두 배 올리는 올바른 운동법 \'랫풀다운\'',
      channel: '서울예스병원',
      lang: 'ko',
      note: '병원 채널',
    },
    {
      videoId: 'aPSnJ7_Zlxk',
      title: '랫풀다운 도대체 어떻게 해야 할까!? 광배근으로 당기는 방법! (등 운동, 상체 프레임 넓히는 방법, 운동 자세)',
      channel: '쇠질연구소',
      lang: 'ko',
      note: '광배근 사용법 중심',
    },
  ],
};

export interface ResolvedVideo {
  videoId: string;
  title: string;
  channel: string;
  lang: 'ko' | 'en';
  /** hqdefault(480×360)는 항상 존재한다. maxresdefault는 404가 날 수 있다. */
  thumb: string;
  watchUrl: string;
  embedUrl: string;
}

/** 검수를 통과한 항목인가. 게이트의 단일 정의 — 여기만 고치면 된다. */
export function isReviewed(v: VideoEntry): boolean {
  return Boolean(v.reviewedAt) && REVIEWERS.includes(v.reviewedBy as Reviewer);
}

/**
 * 검수 완료된 영상만 화면용 형태로 돌려준다. 없으면 빈 배열.
 * 미검수 후보는 여기서 걸러지므로 UI는 게이트를 몰라도 된다.
 */
export function exerciseVideos(exerciseId: string): ResolvedVideo[] {
  const entries = EXERCISE_VIDEOS[exerciseId];
  if (!entries) return [];
  return entries.filter(isReviewed).map((v) => {
    const t = v.startSec ? `&start=${v.startSec}` : '';
    return {
      videoId: v.videoId,
      title: v.title,
      channel: v.channel,
      lang: v.lang,
      thumb: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
      // 프라이버시 강화 모드 — 재생 전까지 쿠키를 심지 않는다
      embedUrl: `https://www.youtube-nocookie.com/embed/${v.videoId}?rel=0&modestbranding=1&playsinline=1${t}`,
      watchUrl: `https://www.youtube.com/watch?v=${v.videoId}${v.startSec ? `&t=${v.startSec}` : ''}`,
    };
  });
}
