'use client';

import { motion } from 'framer-motion';
import { Building2, Calendar, FileText, Sparkles, Tag, Wallet } from 'lucide-react';
import { Reveal } from '../ui/reveal';
import { Badge } from '../ui/badge';

const fields = [
  { icon: Building2, label: 'Empresa', value: 'Loja Equipamentos LTDA', delay: 0.0 },
  { icon: Calendar, label: 'Vencimento', value: '23/05/2026', delay: 0.18 },
  { icon: Wallet, label: 'Valor', value: 'R$ 1.745,83', delay: 0.36 },
  { icon: Tag, label: 'Tipo da guia', value: 'GA · Guia da Previdência', delay: 0.54 },
];

export function OcrSection() {
  return (
    <section id="ocr" className="relative overflow-hidden px-4 py-24 sm:py-28">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[500px] -translate-y-1/2 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(124,58,237,0.18),transparent_70%)] blur-3xl" />

      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <Reveal>
            <Badge tone="violet">
              <Sparkles size={11} /> OCR Inteligente
            </Badge>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[44px] lg:leading-[1.1]">
              IA lê suas guias.{' '}
              <span className="text-gradient">Você confirma e segue.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/60">
              Tecnologia de leitura automática de guias com inteligência artificial. O GuiaControl
              identifica empresa, vencimento, valor e tipo direto do PDF ou imagem — sem
              preenchimento manual.
            </p>
          </Reveal>

          <ul className="mt-8 space-y-3">
            {[
              'Aceita PDF, JPG e PNG · scaneados ou nativos',
              'Reconhece QR Code Pix e código de barras automaticamente',
              'Casa cada guia com a empresa certa pelo CNPJ',
              'Funciona em lote — 50 guias em uma única importação',
            ].map((item) => (
              <Reveal key={item} delay={0.12}>
                <li className="flex items-start gap-3 text-[14px] text-white/75">
                  <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-emerald-500/15 text-emerald-300">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>

        {/* OCR Visual */}
        <Reveal delay={0.1}>
          <div className="relative">
            {/* Glow ring */}
            <div className="pointer-events-none absolute -inset-6 rounded-[32px] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(139,92,246,0.35),transparent_70%)] blur-2xl" />

            <div className="glass-strong relative grid grid-cols-[200px_1fr] gap-4 rounded-3xl p-5 shadow-glowLg sm:grid-cols-[220px_1fr]">
              {/* Document */}
              <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-zinc-100 to-zinc-200 p-3 text-zinc-900">
                <div className="flex items-center gap-1.5">
                  <FileText size={11} className="text-zinc-500" />
                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                    GUIA · GA
                  </p>
                </div>
                <p className="mt-1 text-[10.5px] font-bold leading-tight">
                  Loja Equipamentos LTDA
                </p>
                <p className="text-[8.5px] text-zinc-600">CNPJ 12.345.678/0001-90</p>

                <div className="my-3 h-px bg-zinc-300/70" />

                <div className="space-y-1.5">
                  <DocLine label="Vencimento" value="23/05/2026" />
                  <DocLine label="Valor" value="R$ 1.745,83" />
                  <DocLine label="Competência" value="04/2026" />
                </div>

                <div className="mt-3 flex items-center gap-1">
                  <div className="grid grid-cols-[repeat(20,1fr)] gap-px h-9 w-full">
                    {Array.from({ length: 60 }).map((_, i) => (
                      <span
                        key={i}
                        className="bg-zinc-900"
                        style={{ width: `${(i % 4) + 1}px` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Scan beam */}
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-violet-400/0 via-violet-400/40 to-violet-400/0"
                  initial={{ y: '-110%' }}
                  animate={{ y: '110%' }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* IA pulse mark */}
                <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/15 px-1.5 py-0.5 text-[7.5px] font-bold uppercase text-violet-300">
                  <span className="h-1 w-1 animate-pulseDot rounded-full bg-violet-300" />
                  IA lendo
                </div>
              </div>

              {/* Extracted fields */}
              <div className="flex flex-col gap-2">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-white/45">
                  Dados extraídos automaticamente
                </p>
                {fields.map((f) => (
                  <ExtractedField key={f.label} field={f} />
                ))}

                <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11.5px] font-semibold text-emerald-200">
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-emerald-500/20 text-emerald-300">
                    ✓
                  </span>
                  Pronta para envio em 2 segundos
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function DocLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[9px]">
      <span className="text-zinc-500">{label}</span>
      <span className="font-bold text-zinc-900">{value}</span>
    </div>
  );
}

function ExtractedField({ field }: { field: (typeof fields)[number] }) {
  const Icon = field.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: 14 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: field.delay, ease: [0.16, 0.84, 0.3, 1] }}
      viewport={{ once: true, amount: 0.4 }}
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5"
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/15">
        <Icon size={14} className="text-violet-300" />
      </span>
      <div className="flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
          {field.label}
        </p>
        <p className="text-[12.5px] font-bold text-white">{field.value}</p>
      </div>
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold tracking-wider text-emerald-300">
        OK
      </span>
    </motion.div>
  );
}
