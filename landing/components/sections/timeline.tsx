'use client';

import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Eye,
  FilePlus,
  MessageCircle,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Reveal } from '../ui/reveal';
import { Badge } from '../ui/badge';

const events = [
  {
    icon: FilePlus,
    title: 'Guia cadastrada',
    sub: 'Lj Equipamentos · GA · R$ 1.745,83',
    when: '14:02',
    state: 'done',
  },
  {
    icon: MessageCircle,
    title: 'Lembrete enviado pelo WhatsApp',
    sub: 'Mensagem personalizada com link do cliente',
    when: '14:02',
    state: 'done',
  },
  {
    icon: Eye,
    title: 'Cliente visualizou',
    sub: 'Abriu o link e conferiu valor e vencimento',
    when: '14:11',
    state: 'done',
  },
  {
    icon: Wallet,
    title: 'Pagamento identificado',
    sub: 'PIX confirmado · valor batido com a guia',
    when: '14:23',
    state: 'live',
  },
  {
    icon: ShieldCheck,
    title: 'Guia confirmada · arquivada',
    sub: 'Comprovante anexado · conciliação automática',
    when: '14:24',
    state: 'pending',
  },
] as const;

export function TimelineSection() {
  return (
    <section className="relative overflow-hidden px-4 py-24 sm:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[500px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(34,211,238,0.18),transparent_70%)] blur-3xl" />

      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <Reveal>
            <Badge tone="cyan">
              <CheckCircle2 size={11} /> Operação viva
            </Badge>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[44px]">
              Automação fiscal{' '}
              <span className="text-gradient">acontecendo em tempo real.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/60">
              Cada guia segue uma timeline clara — do cadastro ao pagamento. Você abre o app e
              vê exatamente o que aconteceu, sem precisar perguntar.
            </p>
          </Reveal>
        </div>

        <div className="relative mx-auto mt-14 max-w-3xl">
          {/* Vertical line */}
          <div className="pointer-events-none absolute left-[27px] top-0 h-full w-px bg-gradient-to-b from-brand-500/10 via-brand-500/40 to-brand-500/0" />
          <ul className="flex flex-col gap-3">
            {events.map((e, i) => (
              <TimelineRow key={e.title} event={e} index={i} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function TimelineRow({
  event,
  index,
}: {
  event: (typeof events)[number];
  index: number;
}) {
  const Icon = event.icon;
  const tone =
    event.state === 'done'
      ? 'from-emerald-500 to-emerald-700 ring-emerald-500/30 text-white'
      : event.state === 'live'
      ? 'from-violet-500 to-violet-700 ring-violet-500/30 text-white'
      : 'from-zinc-700 to-zinc-800 ring-white/10 text-white/70';

  const cardTone =
    event.state === 'live'
      ? 'border-violet-500/40 bg-violet-500/5'
      : 'border-white/8 bg-white/[0.025]';

  return (
    <motion.li
      initial={{ opacity: 0, x: -16 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, delay: index * 0.09, ease: [0.16, 0.84, 0.3, 1] }}
      viewport={{ once: true, amount: 0.4 }}
      className="relative flex items-start gap-4"
    >
      <div className="relative">
        <span
          className={`relative grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-b ${tone} shadow-glow ring-4`}
        >
          <Icon size={20} />
          {event.state === 'live' ? (
            <span className="ping-slow absolute inset-0 rounded-2xl bg-violet-400" />
          ) : null}
        </span>
      </div>

      <div className={`flex-1 rounded-2xl border ${cardTone} p-4 transition`}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-bold tracking-tight text-white">{event.title}</h3>
          {event.state === 'done' ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
              concluído
            </span>
          ) : null}
          {event.state === 'live' ? (
            <span className="flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-200">
              <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-violet-300" />
              ao vivo
            </span>
          ) : null}
          {event.state === 'pending' ? (
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/50">
              próximo
            </span>
          ) : null}
          <span className="ml-auto text-[11px] font-mono text-white/45">{event.when}</span>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-white/60">{event.sub}</p>
      </div>
    </motion.li>
  );
}
