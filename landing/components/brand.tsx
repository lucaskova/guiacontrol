import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';

type Size = 'sm' | 'md' | 'lg';

const sizes: Record<Size, { box: string; icon: number; text: string; tagline: string }> = {
  sm: {
    box: 'h-7 w-7 rounded-lg',
    icon: 13,
    text: 'text-[13px]',
    tagline: 'text-[9px]',
  },
  md: {
    box: 'h-8 w-8 rounded-xl',
    icon: 15,
    text: 'text-[15px]',
    tagline: 'text-[10px]',
  },
  lg: {
    box: 'h-10 w-10 rounded-xl',
    icon: 18,
    text: 'text-[18px]',
    tagline: 'text-[10px]',
  },
};

type Props = {
  size?: Size;
  className?: string;
  showTagline?: boolean;
};

export function Brand({ size = 'md', className, showTagline = false }: Props) {
  const s = sizes[size];
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn(
          'grid place-items-center bg-gradient-to-br from-teal-700 via-emerald-500 to-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.20),0_10px_30px_-12px_rgba(16,185,129,0.55)] ring-1 ring-emerald-500/30',
          s.box,
        )}
      >
        <ShieldCheck size={s.icon} strokeWidth={2.5} className="text-white drop-shadow" />
      </span>
      <span className={cn('font-extrabold tracking-tight leading-none', s.text)}>
        <span className="text-white">Guia</span>
        <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-300 bg-clip-text text-transparent">
          Control
        </span>
      </span>
      {showTagline ? (
        <span
          className={cn(
            'hidden sm:inline font-semibold uppercase tracking-[0.18em] text-white/50',
            s.tagline,
          )}
        >
          · Automação fiscal
        </span>
      ) : null}
    </span>
  );
}
