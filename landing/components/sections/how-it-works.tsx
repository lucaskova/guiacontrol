'use client';

import { Activity, Bell, CloudUpload, ScanLine } from 'lucide-react';
import { motion } from 'framer-motion';
import { Reveal } from '../ui/reveal';
import { Badge } from '../ui/badge';

const steps = [
  {
    n: '01',
    icon: CloudUpload,
    title: 'Faça upload da guia',
    desc: 'Arraste o PDF ou imagem (1 ou 50 de uma vez). Funciona com guias escaneadas, nativas, com QR Code Pix ou código de barras.',
  },
  {
    n: '02',
    icon: ScanLine,
    title: 'OCR identifica automaticamente',
    desc: 'A IA extrai empresa, valor, vencimento e tipo. Você só revisa o lote em uma tela e confirma.',
  },
  {
    n: '03',
    icon: Bell,
    title: 'Cliente recebe o lembrete',
    desc: 'Mensagem personalizada no WhatsApp com valor, vencimento dd/mm/aaaa e link da página dele.',
  },
  {
    n: '04',
    icon: Activity,
    title: 'Sistema acompanha em tempo real',
    desc: 'Quem viu, quem pagou, quem anexou comprovante. Tudo conciliado sem você abrir uma planilha.',
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="relative px-4 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Badge tone="cyan">
            <Activity size={11} /> Fluxo automático
          </Badge>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-3 max-w-2xl text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[44px]">
            Quatro passos. Zero retrabalho.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/60">
            Do PDF da guia ao lembrete entregue ao cliente — em segundos.
          </p>
        </Reveal>

        <div className="relative mt-14">
          {/* Connecting line on desktop */}
          <div
            className="pointer-events-none absolute left-[3.25rem] top-6 hidden h-[calc(100%-3rem)] w-px bg-gradient-to-b from-brand-500/0 via-brand-500/40 to-brand-500/0 lg:block"
            aria-hidden
          />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {steps.map((s, i) => (
              <Step key={s.n} step={s} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Step({
  step,
  index,
}: {
  step: (typeof steps)[number];
  index: number;
}) {
  const Icon = step.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.07, ease: [0.16, 0.84, 0.3, 1] }}
      viewport={{ once: true, amount: 0.3 }}
      className="group relative flex gap-5 rounded-2xl border border-white/8 bg-white/[0.025] p-6 transition-all hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.04]"
    >
      <div className="flex flex-col items-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-glow ring-4 ring-brand-500/20">
          <Icon size={20} />
        </span>
        <span className="mt-3 text-[10.5px] font-bold tracking-[0.18em] text-white/35">
          {step.n}
        </span>
      </div>
      <div className="flex-1 pt-1">
        <h3 className="text-lg font-bold tracking-tight text-white">{step.title}</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/60">{step.desc}</p>
      </div>
    </motion.div>
  );
}
