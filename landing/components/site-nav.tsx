'use client';

import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ButtonLink } from './ui/button';
import { cn } from '@/lib/cn';
import { loginHref, trialHref } from '@/lib/config';
import { Brand } from './brand';

const links = [
  { href: '#produto', label: 'Produto' },
  { href: '#ocr', label: 'OCR IA' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#diferenciais', label: 'Diferenciais' },
  { href: '#precos', label: 'Resultados' },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 14);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 inset-x-0 z-50 transition-all duration-300',
        scrolled ? 'pt-3' : 'pt-5',
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4">
        <div
          className={cn(
            'glass-strong flex w-full items-center justify-between rounded-full pl-4 pr-2 py-2 transition-all duration-300',
            scrolled ? 'shadow-card' : 'shadow-none',
          )}
        >
          <a href="#top" className="group flex items-center">
            <Brand size="md" showTagline />
          </a>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-full px-3 py-1.5 text-[13px] font-medium text-white/70 transition hover:text-white hover:bg-white/5"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ButtonLink
              href={loginHref}
              variant="ghost"
              size="sm"
            >
              Entrar
            </ButtonLink>
            <ButtonLink href={trialHref} target="_blank" rel="noopener noreferrer" variant="primary" size="sm">
              Testar grátis <ArrowRight size={14} />
            </ButtonLink>
          </div>
        </div>
      </div>
    </header>
  );
}
