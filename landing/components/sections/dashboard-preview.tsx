'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Activity, BarChart3, Bell, Building2, Sparkles } from 'lucide-react';
import { Reveal } from '../ui/reveal';
import { Badge } from '../ui/badge';
import { DashboardMockup } from '../mockup/dashboard-mockup';

const highlights = [
  {
    icon: Bell,
    title: 'Alertas inteligentes',
    desc: 'Atrasos, prontos pra envio e recuperações — priorizados com severidade visual.',
  },
  {
    icon: Activity,
    title: 'Timeline operacional',
    desc: 'Toda guia tem uma linha do tempo — cadastro, envio, visualização, pagamento.',
  },
  {
    icon: Building2,
    title: 'Multi-empresa fluida',
    desc: 'Filtro por empresa, busca global Ctrl+K e consolidação por escritório.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard financeiro',
    desc: 'Total em aberto, vencidas, próximas e pagas — em um cartão único, premium.',
  },
];

export function DashboardPreview() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], ['8%', '-8%']);

  return (
    <section ref={ref} className="relative overflow-hidden px-4 py-24 sm:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-50" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[500px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.18),transparent_70%)] blur-3xl" />

      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div>
            <Reveal>
              <Badge tone="brand">
                <Sparkles size={11} /> Painel
              </Badge>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[44px] lg:leading-[1.1]">
                Um painel de controle{' '}
                <span className="text-gradient">para sua operação fiscal.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/60">
                Densidade operacional sem ruído. Cada elemento foi pensado para você responder a
                pergunta certa em um único olhar.
              </p>
            </Reveal>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {highlights.map((h, i) => (
                <Reveal key={h.title} delay={0.1 + i * 0.05}>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition hover:border-white/15 hover:bg-white/[0.04]">
                    <span className="inline-grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-brand-200">
                      <h.icon size={16} />
                    </span>
                    <p className="mt-3 text-[14px] font-bold text-white">{h.title}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">{h.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <motion.div style={{ y }} className="relative">
            <DashboardMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
