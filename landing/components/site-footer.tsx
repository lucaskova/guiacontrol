import { Brand } from './brand';

export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/5 px-6 py-14">
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <Brand size="md" />
          <p className="mt-4 text-[13px] leading-relaxed text-white/55">
            Plataforma inteligente de automação fiscal para escritórios contábeis. OCR, lembretes
            e acompanhamento em tempo real.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          <FooterCol
            title="Produto"
            items={[
              { label: 'OCR Inteligente', href: '#ocr' },
              { label: 'Como funciona', href: '#como-funciona' },
              { label: 'Diferenciais', href: '#diferenciais' },
              { label: 'Resultados', href: '#precos' },
            ]}
          />
          <FooterCol
            title="Empresa"
            items={[
              { label: 'Para contadores', href: '#' },
              { label: 'Para clientes', href: '#' },
              { label: 'Suporte', href: '#' },
              { label: 'Status', href: '#' },
            ]}
          />
          <FooterCol
            title="Recursos"
            items={[
              { label: 'Política de privacidade', href: '#' },
              { label: 'Termos de uso', href: '#' },
              { label: 'Cookies', href: '#' },
              { label: 'Contato', href: '#' },
            ]}
          />
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-6xl items-center justify-between text-[12px] text-white/40">
        <p>© {new Date().getFullYear()} GuiaControl · Todos os direitos reservados.</p>
        <p className="hidden md:block">Feito com automação para contadores brasileiros.</p>
      </div>
    </footer>
  );
}

type Item = { label: string; href: string };

function FooterCol({ title, items }: { title: string; items: Item[] }) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">{title}</p>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.label}>
            <a href={it.href} className="text-[13px] text-white/70 transition hover:text-white">
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
