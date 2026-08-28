/** 'YYYY-MM-DD' 문자열 유틸. 엔진과 동일하게 UTC Date만 사용한다. */
import { addDays, formatDate, parseDate } from './engine';

export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

/** 사용자의 로컬 오늘 날짜를 'YYYY-MM-DD'로 */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isValidISO(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseDate(s);
  return !Number.isNaN(d.getTime()) && formatDate(d) === s;
}

export function shiftISO(iso: string, days: number): string {
  return formatDate(addDays(parseDate(iso), days));
}

export function weekdayOf(iso: string): number {
  return parseDate(iso).getUTCDay();
}

/** '9월 3일 (수)' */
export function formatKo(iso: string, withWeekday = true): string {
  const d = parseDate(iso);
  const base = `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
  return withWeekday ? `${base} (${WEEKDAY_KO[d.getUTCDay()]})` : base;
}

/** '2026년 9월' */
export function formatMonthKo(year: number, month0: number): string {
  return `${year}년 ${month0 + 1}월`;
}

/** 'HH:MM' (로컬) */
export function formatClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 'M:SS' */
export function formatMMSS(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function compareISO(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
