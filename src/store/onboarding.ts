'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Concern, Equipment, Level, PlanInput } from '@/lib/engine';
import { STORAGE_KEYS } from '@/lib/constants';
import { shiftISO, todayISO } from '@/lib/dates';

export interface OnboardingState {
  /** 배열 순서 = 우선순위 */
  concerns: Concern[];
  level: Level;
  equipment: Equipment[];
  avoidTags: string[];
  startDate: string;
  endDate: string;
  daysPerWeek: 2 | 3 | 4 | 5;
  sessionMinutes: number;

  toggleConcern: (c: Concern) => void;
  reorderConcerns: (from: number, to: number) => void;
  setLevel: (l: Level) => void;
  toggleEquipment: (e: Equipment) => void;
  toggleAvoidTag: (t: string) => void;
  setSchedule: (
    patch: Partial<Pick<OnboardingState, 'startDate' | 'endDate' | 'daysPerWeek' | 'sessionMinutes'>>,
  ) => void;
  toPlanInput: () => PlanInput;
  hydrateFromInput: (input: PlanInput) => void;
  resetAll: () => void;
}

function defaults() {
  const start = todayISO();
  return {
    concerns: [] as Concern[],
    level: 2 as Level,
    equipment: [] as Equipment[],
    avoidTags: [] as string[],
    startDate: start,
    endDate: shiftISO(start, 27), // 기본 4주(2사이클)
    daysPerWeek: 3 as 2 | 3 | 4 | 5,
    sessionMinutes: 40,
  };
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...defaults(),
      toggleConcern: (c) =>
        set((s) => ({
          concerns: s.concerns.includes(c) ? s.concerns.filter((x) => x !== c) : [...s.concerns, c],
        })),
      reorderConcerns: (from, to) =>
        set((s) => {
          if (from === to || from < 0 || to < 0 || from >= s.concerns.length || to >= s.concerns.length) return {};
          const next = [...s.concerns];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          return { concerns: next };
        }),
      setLevel: (level) => set({ level }),
      toggleEquipment: (e) =>
        set((s) => ({
          equipment: s.equipment.includes(e) ? s.equipment.filter((x) => x !== e) : [...s.equipment, e],
        })),
      toggleAvoidTag: (t) =>
        set((s) => ({
          avoidTags: s.avoidTags.includes(t) ? s.avoidTags.filter((x) => x !== t) : [...s.avoidTags, t],
        })),
      setSchedule: (patch) => set(patch),
      toPlanInput: () => {
        const s = get();
        return {
          startDate: s.startDate,
          endDate: s.endDate,
          daysPerWeek: s.daysPerWeek,
          sessionMinutes: s.sessionMinutes,
          concerns: s.concerns,
          level: s.level,
          equipment: s.equipment,
          avoidTags: s.avoidTags,
        };
      },
      hydrateFromInput: (input) =>
        set({
          concerns: input.concerns,
          level: input.level,
          equipment: input.equipment,
          avoidTags: input.avoidTags ?? [],
          startDate: input.startDate,
          endDate: input.endDate,
          daysPerWeek: input.daysPerWeek,
          sessionMinutes: input.sessionMinutes,
        }),
      resetAll: () => set(defaults()),
    }),
    {
      name: STORAGE_KEYS.onboarding,
      storage: createJSONStorage(() => localStorage),
      // SSR 마크업과 첫 클라이언트 렌더가 일치하도록, 저장값 복원은 useEffect에서 수행한다(AppShell)
      skipHydration: true,
      partialize: (s) => ({
        concerns: s.concerns,
        level: s.level,
        equipment: s.equipment,
        avoidTags: s.avoidTags,
        startDate: s.startDate,
        endDate: s.endDate,
        daysPerWeek: s.daysPerWeek,
        sessionMinutes: s.sessionMinutes,
      }),
    },
  ),
);
