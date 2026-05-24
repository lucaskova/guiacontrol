import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GuiaControl — Automação fiscal inteligente para escritórios contábeis',
  description:
    'O contador sobe a guia. O GuiaControl faz o resto. OCR Inteligente, lembretes automáticos e acompanhamento em tempo real para escritórios contábeis.',
  keywords: [
    'GuiaControl',
    'automação fiscal',
    'contabilidade',
    'OCR contábil',
    'gestão de guias',
    'cobrança automática',
    'escritório contábil',
  ],
  openGraph: {
    title: 'GuiaControl — Automação fiscal inteligente',
    description:
      'OCR Inteligente, lembretes automáticos e acompanhamento em tempo real para escritórios contábeis.',
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GuiaControl — Automação fiscal inteligente',
    description:
      'OCR Inteligente, lembretes automáticos e acompanhamento em tempo real para escritórios contábeis.',
  },
};

export const viewport: Viewport = {
  themeColor: '#05060A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-ink-950 antialiased">{children}</body>
    </html>
  );
}
