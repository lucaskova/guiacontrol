'use client';

import {
  Bell,
  BarChart3,
  Building2,
  History,
  LayoutDashboard,
  Send,
  Sparkles,
  UserCircle2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Reveal } from '../ui/reveal';
import { Badge } from '../ui/badge';

const items = [
  {
    icon: Sparkles,
    title: 'OCR Inteligente',
    desc: 'Lê empresa, valor, vencimento e tipo de qualquer guia automaticamente.',
    grad: 'from-violet-500/30 via-violet-500/0',
  },
  {
    icon: Bell,
    title: 'Alertas automáticos',
    desc: 'D-7, D-3, vencimento e atraso. Tudo disparado no horário certo.',
    grad: 'from-amber-500/30 via-amber-500/0',
  },
  {
    icon: UserCircle2,
    title: 'Área do cliente',
    desc: 'Cada cliente acessa link próprio com guias, valores e Pix copia-e-cola.',
    grad: 'from-cyan-500/30 via-cyan-500/0',
  },
  {
    icon: Building2,
    title: 'Multiempresa',
    desc: 'Gerencie 10 ou 1.000 empresas em uma única visão consolidada.',
    grad: 'from-emerald-500/30 via-emerald-500/0',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard inteligente',
    desc: 'Total em aberto, vencidas, próximas — atualizado em tempo real.',
    grad: 'from-brand-500/30 via-brand-500/0',
  },
  {
    icon: History,
    title: 'Histórico completo',
    desc: 'Toda mensagem, visualização, pagamento e comprovante registrado.',
    grad: 'from-pink-500/30 via-pink-500/0',
  },
  {
    icon: Send,
    title: 'Lembretes automáticos',
    desc: 'WhatsApp via API Brasil, com personalização por cliente.',
    grad: 'from-blue-500/30 via-blue-500/0',
  },
  {
    icon: BarChart3,
    title: 'Gestão operacional',
    desc: 'Pendências priorizadas, automações vivas, sem planilha paralela.',
    grad: 'from-indigo-500/30 via-indigo-500/0',
  },
];

export function Differentials() {
  return (
    <section id="diferenciais" className="relative px-4 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Badge tone="brand">Diferenciais</Badge>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-3 max-w-2xl text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[44px]">
            Tudo o que sua operação fiscal precisa.
            <br />
            <span className="text-gradient">Em uma única plataforma.</span>
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <DiffCard key={it.title} item={it} delay={i * 0.04} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DiffCard({
  item,
  delay,
}: {
  item: (typeof items)[number];
  delay: number;
}) {
  const Icon = item.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 0.84, 0.3, 1] }}
      viewport={{ once: true, amount: 0.3 }}
      whileHover={{ y: -5 }}
      className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025] p-5 transition-colors hover:border-white/15 hover:bg-white/[0.04]"
    >
      <div
        className={`pointer-events-none absolute inset-0 -z-0 bg-gradient-to-br ${item.grad} to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
      />
      <div className="relative">
        <span className="inline-grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/85 transition group-hover:border-brand-500/40 group-hover:bg-brand-500/10 group-hover:text-brand-200">
          <Icon size={18} />
        </span>
        <h3 className="mt-4 text-[15px] font-bold tracking-tight text-white">{item.title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{item.desc}</p>
      </div>
    </motion.div>
  );
}
