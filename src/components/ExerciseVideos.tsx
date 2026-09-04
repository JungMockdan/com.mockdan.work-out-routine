'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { exerciseVideos } from '@/data/exercise-media';
import { cx } from './ui';

/**
 * 운동별 시연 영상 (유튜브 임베드).
 *
 * · 검수를 통과한 영상만 나온다. exerciseVideos()가 게이트라서 이 컴포넌트는
 *   게이트를 몰라도 된다 — 미검수 후보만 있으면 그냥 null을 돌려준다.
 * · iframe은 라이트박스가 열린 동안에만 마운트한다. 닫을 때 언마운트하지 않으면
 *   오디오가 계속 재생된다.
 * · 실행 화면(/session/[date])에서는 쓰지 않는다. useWakeLock의 iOS 폴백이
 *   무음 오디오를 재생 중이라, 소리 있는 영상이 오디오 세션을 뺏으면
 *   세션 도중 화면 꺼짐 방지가 조용히 해제된다.
 * · 채널명 표시는 저작권상 의무다. 지우지 말 것.
 */
export function ExerciseVideos({ exerciseId, nameKo }: { exerciseId: string; nameKo: string }) {
  const videos = exerciseVideos(exerciseId);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const close = useCallback(() => setOpenIdx(null), []);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (openIdx != null && !el.open) el.showModal();
    else if (openIdx == null && el.open) el.close();
  }, [openIdx]);

  if (videos.length === 0) return null;
  const open = openIdx != null ? videos[openIdx] : null;

  return (
    <div className="mt-2 border-t border-line pt-2">
      <p className="text-xs font-semibold text-muted">시연 영상</p>
      <ul className="mt-1.5 grid gap-1.5">
        {videos.map((v, i) => (
          <li key={v.videoId}>
            <button
              type="button"
              onClick={() => setOpenIdx(i)}
              aria-label={`${nameKo} 시연 영상 재생 — ${v.title} · ${v.channel}`}
              className={cx(
                'flex w-full items-center gap-2.5 rounded-lg border border-line bg-white p-1.5 text-left',
                'min-h-12 hover:bg-slate-50',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              )}
            >
              <span className="relative shrink-0">
                {/* next/image를 쓰지 않는다 — next.config.ts에 remotePatterns를 추가할 이유가 없다 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.thumb}
                  alt=""
                  width={128}
                  height={72}
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-24 rounded bg-slate-100 object-cover"
                />
                <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-6 items-center justify-center rounded-full bg-black/55 text-[10px] leading-none text-white">
                    ▶
                  </span>
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-xs font-medium text-ink">{v.title}</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted">
                  {v.channel}
                  {v.lang === 'en' && ' · EN'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={close}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        aria-label={`${nameKo} 시연 영상`}
        className="w-[min(92vw,520px)] rounded-2xl border border-line bg-card p-0 backdrop:bg-black/60"
      >
        {open && (
          <div className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h4 className="line-clamp-2 text-sm font-bold">{open.title}</h4>
                <p className="truncate text-xs text-muted">{open.channel}</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="-mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                aria-label="영상 닫기"
              >
                ✕
              </button>
            </div>

            <div className="mt-2 aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                src={open.embedUrl}
                title={`${nameKo} 시연 영상`}
                className="size-full"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>

            {/* 임베드가 차단된 영상은 위 iframe이 오류 화면을 띄운다. 이 링크가 유일한 탈출구다. */}
            <a
              href={open.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold text-brand hover:bg-brand-light/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              유튜브에서 열기 ↗
            </a>
          </div>
        )}
      </dialog>
    </div>
  );
}
