'use client';

import { Reveal } from '../ui/reveal';
import { Badge } from '../ui/badge';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

const stats = [
  { value: '+12.840', label: 'Guias processadas pela IA' },
  { value: '+38.200', label: 'Lembretes WhatsApp enviados' },
  { value: '+340', label: 'Empresas atendidas' },
  { value: '7.200h', label: 'Tempo economizado em conferência' },
];

const quotes = [
  {
    q: 'Em duas semanas paramos de mandar guia uma a uma no WhatsApp. O cliente vê tudo no link dele. A inadimplência caiu sozinha.',
    name: 'Carla Menezes',
    role: 'Sócia · Contábil Menezes',
  },
  {
    q: 'O OCR é absurdo. Subo 30 guias do mês de uma vez, ele extrai tudo, eu só clico em confirmar. Ganhei umas 4 horas por semana.',
    name: 'Rafael Andrade',
    role: 'Contador responsável · Andrade & Co',
  },
  {
    q: 'A timeline de cada guia é o que mais me impressiona. Eu sei se o cliente viu, se pagou, se tem comprovante. Sem perguntar.',
    name: 'Juliana Tavares',
    role: 'Coordenadora fiscal · TaxWise',
  },
];

export function SocialProof() {
  return (
    <section className="relative px-4 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Badge tone="brand">Confiança</Badge>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-3 max-w-2xl text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[44px]">
            Os números do{' '}
            <span className="text-gradient">caos automatizado.</span>
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              viewport={{ once: true, amount: 0.4 }}
              className="rounded-2xl border border-white/8 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6"
            >
              <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/45">
                {s.label}
              </p>
              <p className="mt-3 text-[34px] font-extrabold tracking-tight text-white">
                {s.value}
              </p>
              <div className="mt-2 h-px w-12 bg-gradient-to-r from-brand-500 to-violet-500" />
            </motion.div>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {quotes.map((q, i) => (
            <motion.figure
              key={q.name}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.06 }}
              viewport={{ once: true, amount: 0.3 }}
              className="rounded-2xl border border-white/8 bg-white/[0.025] p-6"
            >
              <Quote size={18} className="text-brand-300/80" />
              <blockquote className="mt-3 text-[14.5px] leading-relaxed text-white/80">
                "{q.q}"
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-[12.5px] font-extrabold text-white">
                  {q.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <div>
                  <p className="text-[13px] font-bold text-white">{q.name}</p>
                  <p className="text-[11.5px] text-white/45">{q.role}</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
