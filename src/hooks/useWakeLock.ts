'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** 1초짜리 무음 WAV (8kHz mono, 무음 샘플) — wakeLock 미지원 브라우저 폴백용 */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQfAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAfAAA' +
  'A'.repeat(10600);

type WakeLockSentinelLike = { release: () => Promise<void>; addEventListener?: (t: string, cb: () => void) => void };

/**
 * 화면 꺼짐 방지. navigator.wakeLock 우선, 미지원이면 무음 오디오 루프 폴백.
 * enable()은 반드시 사용자 제스처(시작 버튼) 안에서 호출할 것.
 */
export function useWakeLock() {
  const [active, setActive] = useState(false);
  const [method, setMethod] = useState<'wakeLock' | 'audio' | 'none'>('none');
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wantedRef = useRef(false);

  const acquire = useCallback(async () => {
    if (!wantedRef.current) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } };
    if (nav.wakeLock) {
      try {
        const s = await nav.wakeLock.request('screen');
        sentinelRef.current = s;
        s.addEventListener?.('release', () => {
          // 백그라운드 전환 등으로 해제되면 복귀 시 재획득한다
          if (wantedRef.current && document.visibilityState === 'visible') void acquire();
        });
        setMethod('wakeLock');
        setActive(true);
        return;
      } catch {
        /* 폴백으로 */
      }
    }
    try {
      if (!audioRef.current) {
        const a = new Audio(SILENT_WAV);
        a.loop = true;
        a.volume = 0.01;
        audioRef.current = a;
      }
      await audioRef.current.play();
      setMethod('audio');
      setActive(true);
    } catch {
      setMethod('none');
      setActive(false);
    }
  }, []);

  const enable = useCallback(async () => {
    wantedRef.current = true;
    await acquire();
  }, [acquire]);

  const disable = useCallback(() => {
    wantedRef.current = false;
    void sentinelRef.current?.release().catch(() => undefined);
    sentinelRef.current = null;
    audioRef.current?.pause();
    setActive(false);
    setMethod('none');
  }, []);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible' && wantedRef.current) void acquire();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void sentinelRef.current?.release().catch(() => undefined);
      audioRef.current?.pause();
    };
  }, [acquire]);

  return { active, method, enable, disable };
}
