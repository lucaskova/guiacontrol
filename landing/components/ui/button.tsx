'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
};

const base =
  'btn-shimmer relative inline-flex items-center justify-center gap-2 font-semibold tracking-tight rounded-full transition-all duration-200 will-change-transform select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 disabled:opacity-60 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-glow hover:from-brand-400 hover:to-brand-600 hover:shadow-glowLg active:scale-[0.98]',
  secondary:
    'glass-strong text-white/90 hover:text-white hover:bg-white/10',
  ghost: 'text-white/80 hover:text-white hover:bg-white/5',
  outline:
    'border border-white/15 text-white/90 hover:text-white hover:bg-white/5 hover:border-white/25',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-7 text-[15px]',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => (
    <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

type ButtonLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  size?: Size;
};

export const ButtonLink = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => (
    <a ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </a>
  ),
);
ButtonLink.displayName = 'ButtonLink';
