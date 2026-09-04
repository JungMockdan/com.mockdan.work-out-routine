/**
 * e2e 전용 날짜 유틸.
 * 시작일은 앱이 오늘 이전으로 못 가게 클램프하므로, 테스트는 고정 날짜를 쓰면 안 된다.
 * 요일 패턴·날짜 포맷은 중복 정의하지 않고 엔진/앱 유틸을 그대로 재사용한다.
 */
import { weekdayPattern } from '../src/lib/engine';
import { shiftISO, weekdayOf } from '../src/lib/dates';

export { shiftISO } from '../src/lib/dates';
export { formatKo } from '../src/lib/dates';

/** startISO 이후(당일 포함) 첫 운동일. 엔진의 weekdayPattern을 그대로 따른다. */
export function firstSessionISO(startISO: string, daysPerWeek: 2 | 3 | 4 | 5): string {
  const pattern = new Set(weekdayPattern(daysPerWeek));
  for (let i = 0; i < 7; i++) {
    const d = shiftISO(startISO, i);
    if (pattern.has(weekdayOf(d))) return d;
  }
  throw new Error(`운동일을 찾지 못했습니다: ${startISO}`);
}
