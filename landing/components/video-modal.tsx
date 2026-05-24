'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { ExternalLink, PlayCircle, Sparkles, X } from 'lucide-react';
import { SITE_CONFIG, demoHref } from '@/lib/config';
import { DashboardMockup } from './mockup/dashboard-mockup';

type Props = { open: boolean; onClose: () => void };

export function VideoModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const url = SITE_CONFIG.demoVideoUrl;
  const isYoutube = /youtube\.com|youtu\.be/.test(url);
  const isMp4 = /\.mp4(\?|$)/i.test(url);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            type="button"
            aria-label="Fechar"
            className="absolute inset-0 cursor-default bg-ink-950/80 backdrop-blur-md"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Demonstração do GuiaControl"
            className="glass-strong relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl shadow-glowLg"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.16, 0.84, 0.3, 1] }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-ink-900/80 text-white/85 transition hover:border-white/30 hover:text-white"
            >
              <X size={16} />
            </button>

            <div className="aspect-video w-full bg-ink-900">
              {isYoutube ? (
                <iframe
                  src={`${url}${url.includes('?') ? '&' : '?'}autoplay=1&rel=0&modestbranding=1`}
                  className="h-full w-full"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  title="GuiaControl demo"
                />
              ) : isMp4 ? (
                <video src={url} controls autoPlay className="h-full w-full" />
              ) : (
                <PlaceholderVideo />
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function PlaceholderVideo() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="absolute inset-0 scale-[0.78] origin-center">
        <div className="pointer-events-none">
          <DashboardMockup />
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950/55 via-ink-950/85 to-ink-950/95" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-violet-500/15 to-transparent" />

      <div className="relative px-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-200">
          <Sparkles size={12} /> Vídeo em produção
        </span>
        <h3 className="mt-4 text-balance text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Demonstração completa em breve
        </h3>
        <p className="mx-auto mt-3 max-w-md text-[13.5px] leading-relaxed text-white/65">
          Enquanto o vídeo não fica pronto, agende uma demo ao vivo direto no WhatsApp.
          Levam 10 minutos e é o contador que conduz.
        </p>
        <a
          href={demoHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-shimmer mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-brand-500 to-brand-700 px-5 py-2.5 text-[13.5px] font-bold text-white shadow-glow transition hover:from-brand-400 hover:to-brand-600 hover:shadow-glowLg"
        >
          <PlayCircle size={16} /> Ver demo ao vivo
          <ExternalLink size={13} className="opacity-80" />
        </a>
      </div>
    </div>
  );
}
