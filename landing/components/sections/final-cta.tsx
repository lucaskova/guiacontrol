'use client';

import { motion } from 'framer-motion';
import { ArrowRight, CalendarCheck, Sparkles } from 'lucide-react';
import { ButtonLink } from '../ui/button';
import { Reveal } from '../ui/reveal';
import { demoHref, loginHref, trialHref } from '@/lib/config';

const particles = Array.from({ length: 18 });

export function FinalCta() {
  return (
    <section id="cta" className="relative overflow-hidden px-4 py-28">
      {/* Background gradient */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 50%, rgba(99,102,241,0.25), transparent 70%), radial-gradient(40% 60% at 80% 20%, rgba(139,92,246,0.25), transparent 70%), radial-gradient(40% 60% at 20% 80%, rgba(34,211,238,0.20), transparent 70%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-50" />

      {/* Floating particles */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {particles.map((_, i) => (
          <motion.span
            key={i}
            className="absolute block h-1 w-1 rounded-full bg-white/40"
            initial={{
              x: `${(i * 53) % 100}%`,
              y: `${(i * 31) % 100}%`,
              opacity: 0,
            }}
            animate={{
              y: [`${(i * 31) % 100}%`, `${((i * 31) % 100) - 12}%`],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 4 + (i % 5),
              delay: (i % 7) * 0.4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      <div className="mx-auto max-w-4xl text-center">
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold tracking-wide uppercase text-white/80">
            <Sparkles size={11} className="text-brand-300" />
            Comece em minutos · sem cartão
          </span>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[64px]">
            Pare de gerenciar guias{' '}
            <span className="text-gradient">manualmente.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-white/65">
            Automatize seu escritório contábil com inteligência artificial. Você sobe a guia. O
            GuiaControl faz o resto.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href={trialHref} target="_blank" rel="noopener noreferrer" size="lg">
              Testar grátis <ArrowRight size={16} />
            </ButtonLink>
            <ButtonLink
              href={demoHref}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="lg"
            >
              <CalendarCheck size={14} className="opacity-80" />
              Solicitar demonstração
            </ButtonLink>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="mt-5 text-[12.5px] text-white/45">
            14 dias grátis · sem cartão de crédito · suporte humano em português
          </p>
        </Reveal>

        <Reveal delay={0.25}>
          <p className="mt-3 text-[13px] text-white/55">
            Já tem conta?{' '}
            <a
              href={loginHref}
              className="font-semibold text-white/85 underline-offset-4 hover:text-white hover:underline"
            >
              Entrar no app →
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
