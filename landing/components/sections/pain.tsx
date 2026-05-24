'use client';

import {
  Banknote,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  MessageSquareText,
  RotateCcw,
  Search,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Reveal } from '../ui/reveal';

type Pain = {
  icon: LucideIcon;
  title: string;
  desc: string;
  tone: string;
};

const pains: Pain[] = [
  {
    icon: MessageSquareText,
    title: 'Cobrança manual no WhatsApp',
    desc: 'Mensagens copiadas, datas erradas, links quebrados. O contador vira atendente.',
    tone: 'from-pink-500/20 to-pink-500/0 text-pink-300',
  },
  {
    icon: AlertTriangle,
    title: 'Cliente esquece o vencimento',
    desc: 'Guia em atraso, multa, ligação na sexta às 18h. Ciclo se repete todo mês.',
    tone: 'from-amber-500/20 to-amber-500/0 text-amber-300',
  },
  {
    icon: FileSpreadsheet,
    title: 'Planilhas espalhadas',
    desc: 'Arquivos no e-mail, drive, WhatsApp. Sem fonte única de verdade do escritório.',
    tone: 'from-cyan-500/20 to-cyan-500/0 text-cyan-300',
  },
  {
    icon: RotateCcw,
    title: 'Retrabalho operacional',
    desc: 'Mesma guia digitada três vezes. Erro de R$ por vírgula é regra, não exceção.',
    tone: 'from-violet-500/20 to-violet-500/0 text-violet-300',
  },
  {
    icon: Banknote,
    title: 'Sem confirmação de pagamento',
    desc: 'Cliente diz que pagou. Você acredita. Comprovante não chega. Cobrança quebra.',
    tone: 'from-emerald-500/20 to-emerald-500/0 text-emerald-300',
  },
  {
    icon: Search,
    title: 'Conferência manual sem fim',
    desc: 'Olho a olho com PDF, boleto, extrato e e-mail. Tempo do contador queimando.',
    tone: 'from-blue-500/20 to-blue-500/0 text-blue-300',
  },
  {
    icon: Clock,
    title: 'Tarefas repetitivas todo mês',
    desc: 'Mesmo fluxo, mesmas guias, mesmos atrasos. Tempo que não volta para a estratégia.',
    tone: 'from-indigo-500/20 to-indigo-500/0 text-indigo-300',
  },
  {
    icon: ClipboardList,
    title: 'Visão fragmentada',
    desc: 'Você olha 5 lugares pra responder uma pergunta simples: "essa guia foi paga?"',
    tone: 'from-rose-500/20 to-rose-500/0 text-rose-300',
  },
];

export function PainSection() {
  return (
    <section className="relative px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
            O problema
          </p>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-3 max-w-2xl text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
            O caos operacional do escritório contábil.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
            Você não foi formado para mandar lembrete por WhatsApp e abrir 12 abas para conferir
            uma guia. Mas é o que acontece todos os meses.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pains.map((p, i) => (
            <PainCard key={p.title} pain={p} delay={0.04 * i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PainCard({ pain, delay }: { pain: Pain; delay: number }) {
  const Icon = pain.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 0.84, 0.3, 1] }}
      viewport={{ once: true, amount: 0.3 }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] p-5 transition-colors hover:border-white/15 hover:bg-white/[0.04]"
    >
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${pain.tone} blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
      />
      <div className="relative">
        <span className="inline-grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5">
          <Icon size={16} className="text-white/85" />
        </span>
        <h3 className="mt-4 text-[15px] font-bold text-white">{pain.title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{pain.desc}</p>
      </div>
    </motion.div>
  );
}
