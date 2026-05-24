'use client';

import {
  CheckCheck,
  Gauge,
  Layers,
  RefreshCcw,
  ShieldCheck,
  Timer,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Reveal } from '../ui/reveal';
import { Badge } from '../ui/badge';
import { motion } from 'framer-motion';

const benefits = [
  { icon: RefreshCcw, label: 'Menos retrabalho', metric: '-72%', sub: 'tarefas manuais por mês' },
  { icon: TrendingDown, label: 'Menos inadimplência', metric: '-38%', sub: 'guias em atraso após 30 dias' },
  { icon: ShieldCheck, label: 'Mais controle', metric: '100%', sub: 'das guias em uma única tela' },
  { icon: Gauge, label: 'Mais produtividade', metric: '+3,4x', sub: 'guias processadas por hora' },
  { icon: Timer, label: 'Mais velocidade', metric: '8s', sub: 'do upload ao lembrete enviado' },
  { icon: Layers, label: 'Mais automação', metric: '24/7', sub: 'lembretes e cobranças contínuas' },
  { icon: CheckCheck, label: 'Menos tarefas manuais', metric: '0', sub: 'planilhas paralelas necessárias' },
  { icon: TrendingUp, label: 'Mais previsibilidade', metric: '+91%', sub: 'pagamentos no prazo' },
];

export function Results() {
  return (
    <section id="precos" className="relative px-4 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Badge tone="success">Resultados</Badge>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-3 max-w-2xl text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[44px]">
            Seu escritório mais produtivo.{' '}
            <span className="text-gradient">No primeiro mês.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/60">
            Os ganhos não são teóricos. São os números reais que escritórios contábeis usando o
            GuiaControl estão entregando.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {benefits.map((b, i) => (
            <ResultCard key={b.label} item={b} delay={i * 0.04} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ResultCard({
  item,
  delay,
}: {
  item: (typeof benefits)[number];
  delay: number;
}) {
  const Icon = item.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 0.84, 0.3, 1] }}
      viewport={{ once: true, amount: 0.3 }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025] p-5 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/[0.03]"
    >
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-emerald-300 transition group-hover:border-emerald-500/30 group-hover:bg-emerald-500/10">
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-4 text-[28px] font-extrabold leading-none tracking-tight text-white">
        {item.metric}
      </p>
      <p className="mt-2 text-[13.5px] font-bold text-white/85">{item.label}</p>
      <p className="text-[12px] text-white/45">{item.sub}</p>
    </motion.div>
  );
}
