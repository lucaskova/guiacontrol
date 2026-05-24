import * as React from 'react';
import { cn } from '@/lib/cn';

type BadgeProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: 'brand' | 'cyan' | 'violet' | 'success' | 'warning' | 'neutral';
};

const tones: Record<NonNullable<BadgeProps['tone']>, string> = {
  brand: 'bg-brand-500/10 text-brand-200 border-brand-500/30',
  cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  violet: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  neutral: 'bg-white/5 text-white/80 border-white/10',
};

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
