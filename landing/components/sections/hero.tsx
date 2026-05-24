'use client';

import { useState } from 'react';
import { ArrowRight, Play, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button, ButtonLink } from '../ui/button';
import { Badge } from '../ui/badge';
import { DashboardMockup } from '../mockup/dashboard-mockup';
import { VideoModal } from '../video-modal';
import { trialHref } from '@/lib/config';

const stats = [
  { value: '+12mil', label: 'Guias processadas' },
  { value: '98,7%', label: 'Precisão do OCR' },
  { value: '4 min', label: 'Setup médio' },
];

export function Hero() {
  const [videoOpen, setVideoOpen] = useState(false);
  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-20 sm:pb-24 lg:pt-36">
      <div className="aurora" />
      <div className="absolute inset-0 -z-10 bg-grid" />

      {/* Spotlight beam */}
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.45),transparent_70%)] blur-3xl" />

      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge tone="brand" className="border-brand-500/40 bg-brand-500/10">
              <Sparkles size={12} /> Automação fiscal inteligente
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: [0.16, 0.84, 0.3, 1] }}
            className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[64px]"
          >
            O contador sobe a guia.
            <br />
            <span className="text-gradient">O GuiaControl faz o resto.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-5 max-w-2xl text-balance text-base leading-relaxed text-white/65 sm:text-[17px]"
          >
            Automatize leitura de guias, lembretes, acompanhamento e confirmação de pagamentos em
            uma única plataforma — com OCR Inteligente que extrai empresa, valor, vencimento e tipo
            sem você digitar uma linha.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <ButtonLink href={trialHref} target="_blank" rel="noopener noreferrer" size="lg">
              Testar grátis <ArrowRight size={16} />
            </ButtonLink>
            <Button type="button" variant="outline" size="lg" onClick={() => setVideoOpen(true)}>
              <Play size={14} className="opacity-80" /> Ver demonstração
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
          >
            {stats.map((s) => (
              <div key={s.label} className="flex items-baseline gap-2">
                <span className="text-base font-extrabold text-white sm:text-lg">{s.value}</span>
                <span className="text-[12px] font-medium text-white/55">{s.label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Dashboard mockup */}
        <div className="relative mt-16 sm:mt-20" id="produto">
          <DashboardMockup />
          <p className="mt-5 text-center text-[12px] text-white/40">
            Visualização real do dashboard · operação em tempo real
          </p>
        </div>
      </div>

      <VideoModal open={videoOpen} onClose={() => setVideoOpen(false)} />
    </section>
  );
}
