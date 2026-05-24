'use client';

import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  CheckCheck,
  CheckCircle2,
  CloudUpload,
  Search,
  Sparkles,
  Wallet,
  ShieldCheck,
} from 'lucide-react';

export function DashboardMockup() {
  return (
    <div className="relative w-full">
      {/* Glow behind */}
      <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[40px] bg-[radial-gradient(70%_60%_at_50%_30%,rgba(99,102,241,0.45),transparent_70%)] blur-2xl" />
      <div className="pointer-events-none absolute -inset-14 -z-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_70%_70%,rgba(139,92,246,0.35),transparent_70%)] blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 0.84, 0.3, 1] }}
        className="glass-strong relative overflow-hidden rounded-[26px] p-3 shadow-glowLg"
      >
        {/* Top frame: macOS dots + URL */}
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          </div>
          <div className="ml-3 flex h-6 flex-1 items-center gap-2 rounded-md bg-white/5 px-3 text-[10.5px] text-white/40">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> app.guiacontrol.com
          </div>
        </div>

        {/* App header */}
        <div className="flex items-center gap-3 border-t border-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-teal-700 via-emerald-500 to-emerald-400 ring-1 ring-emerald-500/30">
              <ShieldCheck size={13} strokeWidth={2.5} className="text-white" />
            </span>
            <div>
              <p className="text-[11.5px] font-bold leading-none text-white">
                <span>Guia</span>
                <span className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">Control</span>
              </p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/40">
                Automação fiscal
              </p>
            </div>
          </div>

          <div className="ml-2 flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
            <Search size={12} className="text-white/40" />
            <span className="flex-1 text-[11px] text-white/40">
              Buscar empresas, guias, ações...
            </span>
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-white/60">
              Ctrl K
            </span>
          </div>

          <button className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-brand-500 to-brand-700 px-2.5 py-1.5 text-[10.5px] font-semibold text-white shadow-glow">
            <CloudUpload size={12} /> Upload rápido
          </button>
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/5">
            <Bell size={12} className="text-white/70" />
          </span>
        </div>

        <div className="px-4 pb-4">
          {/* Greeting + live pill */}
          <div className="mt-3 mb-3 flex items-center justify-between">
            <div>
              <p className="text-[12.5px] font-bold tracking-tight text-white">Olá, Lucas</p>
              <p className="mt-0.5 text-[10px] text-white/40">
                Central inteligente de automação fiscal
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-emerald-400" />
              Operação em tempo real
            </div>
          </div>

          {/* Vencidas alert */}
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
            <AlertCircle size={14} className="text-red-400" />
            <div className="flex-1">
              <p className="text-[11px] font-bold text-red-200">2 guia(s) vencida(s)</p>
              <p className="text-[10px] text-red-300/70">Reduza multas com ação imediata</p>
            </div>
            <ArrowUpRight size={12} className="text-red-300" />
          </div>

          {/* Balance card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-violet-700 p-4 shadow-glowLg">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-white/70">Total em aberto</p>
              <div className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
                <Sparkles size={10} className="text-white/90" />
                <span className="text-[9px] font-bold tracking-wider text-white">IA ATIVA</span>
              </div>
            </div>
            <p className="mt-2 text-[26px] font-extrabold tracking-tight text-white">R$ 18.420,00</p>
            <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-semibold text-white/85">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-300" /> 2 vencidas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> 5 a vencer
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> 18 pagas
              </span>
            </div>
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/15 blur-3xl" />
          </div>

          {/* Quick actions grid */}
          <div className="mt-3 grid grid-cols-4 gap-2">
            <QuickCell icon={<CloudUpload size={12} className="text-brand-300" />} label="Upload" hint="Manual" />
            <QuickCell icon={<Sparkles size={12} className="text-violet-300" />} label="OCR IA" hint="Lote" badge="IA" />
            <QuickCell icon={<Wallet size={12} className="text-emerald-300" />} label="Pagamentos" hint="Conciliar" />
            <QuickCell icon={<CheckCheck size={12} className="text-cyan-300" />} label="Empresas" hint="Clientes" />
          </div>

          {/* Metrics row */}
          <div className="mt-3 flex gap-2 overflow-hidden">
            <Metric label="Total" value="R$ 18.4k" tone="from-brand-500/30 to-brand-700/10" />
            <Metric label="Vencidas" value="2" tone="from-red-500/25 to-red-700/10" />
            <Metric label="Pagas" value="18" tone="from-emerald-500/25 to-emerald-700/10" />
            <Metric label="Próx. 7d" value="5" tone="from-violet-500/25 to-violet-700/10" />
          </div>

          {/* Smart alerts */}
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-brand-500/15">
                <Bell size={10} className="text-brand-300" />
              </span>
              <p className="text-[11px] font-bold text-white">Alertas inteligentes</p>
              <span className="ml-auto rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-bold text-brand-200">
                3
              </span>
            </div>
            <AlertRow tone="critical" text="Loja Equipamentos · GA em atraso · R$ 1.745,83" />
            <AlertRow tone="warning" text="3 lembretes prontos para envio · disparar agora?" />
            <AlertRow tone="success" text="Recuperado R$ 4.220 nos últimos 7 dias" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function QuickCell({
  icon,
  label,
  hint,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  badge?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 transition hover:border-brand-500/40 hover:bg-white/[0.06]">
      <div className="flex items-center justify-between">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-white/5">{icon}</span>
        {badge ? (
          <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[8.5px] font-bold text-violet-300">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[10.5px] font-bold text-white">{label}</p>
      <p className="text-[9px] text-white/45">{hint}</p>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`flex-1 rounded-xl border border-white/10 bg-gradient-to-br ${tone} p-2.5`}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-white/55">{label}</p>
      <p className="mt-0.5 text-[14px] font-extrabold text-white">{value}</p>
    </div>
  );
}

function AlertRow({
  tone,
  text,
}: {
  tone: 'critical' | 'warning' | 'success';
  text: string;
}) {
  const cfg = {
    critical: { bg: 'bg-red-500/8', border: 'border-red-500/30', dot: 'bg-red-400', icon: AlertCircle, color: 'text-red-300' },
    warning: { bg: 'bg-amber-500/8', border: 'border-amber-500/30', dot: 'bg-amber-400', icon: Bell, color: 'text-amber-300' },
    success: { bg: 'bg-emerald-500/8', border: 'border-emerald-500/30', dot: 'bg-emerald-400', icon: CheckCircle2, color: 'text-emerald-300' },
  }[tone];
  const Icon = cfg.icon;
  return (
    <div className={`mb-1.5 flex items-center gap-2 rounded-md border ${cfg.border} ${cfg.bg} px-2 py-1.5`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      <Icon size={11} className={cfg.color} />
      <p className="flex-1 truncate text-[10.5px] font-semibold text-white/85">{text}</p>
    </div>
  );
}
