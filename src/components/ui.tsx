'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { DISCLAIMER_LINES } from '@/lib/constants';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export { cx };

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark disabled:bg-slate-300',
  secondary: 'bg-white text-ink border border-line hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'bg-transparent text-brand hover:bg-brand-light/60 disabled:text-slate-400',
  danger: 'bg-white text-danger border border-red-200 hover:bg-red-50 disabled:text-slate-400',
};

export function Button({
  variant = 'primary',
  className,
  full,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; full?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-base font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        'disabled:cursor-not-allowed',
        BUTTON_STYLES[variant],
        full && 'w-full',
        className,
      )}
      {...props}
    />
  );
}

export function LinkButton({
  href,
  variant = 'primary',
  className,
  full,
  children,
  ...rest
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  full?: boolean;
  children: ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <Link
      href={href}
      className={cx(
        'inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-base font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        BUTTON_STYLES[variant],
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-2xl border border-line bg-card p-4 shadow-sm', className)} {...rest}>
      {children}
    </div>
  );
}

/** 상단 헤더: 뒤로가기 + 제목 + 우측 액션 */
export function PageHeader({
  title,
  back,
  right,
  step,
}: {
  title: string;
  back?: string;
  right?: ReactNode;
  /** 온보딩 단계 표시 (예: {current: 1, total: 4}) */
  step?: { current: number; total: number };
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-3">
        {back ? (
          <Link
            href={back}
            aria-label="뒤로"
            className="flex size-10 items-center justify-center rounded-full text-ink hover:bg-slate-100"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : (
          <span className="size-10" />
        )}
        <h1 className="flex-1 truncate text-center text-base font-bold">{title}</h1>
        <div className="flex min-w-10 items-center justify-end">{right}</div>
      </div>
      {step && (
        <div className="flex gap-1 px-4 pb-2" aria-label={`${step.total}단계 중 ${step.current}단계`}>
          {Array.from({ length: step.total }, (_, i) => (
            <span
              key={i}
              className={cx('h-1 flex-1 rounded-full', i < step.current ? 'bg-brand' : 'bg-line')}
            />
          ))}
        </div>
      )}
    </header>
  );
}

/** 페이지 본문 래퍼 + 하단 고정 CTA 영역 */
export function Page({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <main className="flex-1 px-4 pb-32 pt-4 fade-in">{children}</main>
      {footer && (
        <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-[480px] border-t border-line bg-surface/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
          {footer}
        </div>
      )}
    </>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="text-xl font-bold leading-tight">{children}</h2>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

/** SPEC 5.2 의학적 면책 고지 */
export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      role="note"
      aria-label="의학적 면책 고지"
      className={cx(
        'rounded-xl border border-amber-200 bg-amber-50 text-amber-900',
        compact ? 'px-3 py-2 text-xs leading-relaxed' : 'px-4 py-3 text-sm leading-relaxed',
      )}
    >
      {DISCLAIMER_LINES.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </aside>
  );
}

export function ProgressBar({ ratio, label, className }: { ratio: number; label?: string; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>{label}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Chip({
  selected,
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        'min-h-10 rounded-full border px-4 text-sm font-medium transition-colors',
        selected ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink hover:bg-slate-50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ label = '불러오는 중' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted" role="status">
      <span className="size-8 animate-spin rounded-full border-4 border-line border-t-brand" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-danger">
      <p>{message}</p>
      {onRetry && (
        <Button variant="danger" className="mt-3 min-h-10" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </div>
  );
}
