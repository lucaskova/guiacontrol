# GuiaFlow · Landing Page

Landing page premium do **GuiaFlow** — plataforma inteligente de automação fiscal para escritórios contábeis.

Stack:

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS 3.4**
- **Framer Motion 11** (scroll reveal, hover, parallax leve)
- **Lucide React** (ícones)
- Componentes UI no padrão **shadcn/ui** (escritos manualmente, sem CLI)

Design dark estilo Stripe/Linear/Vercel: aurora glow, grid sutil, gradientes brand → violet → cyan, glassmorphism leve, micro-interações em todos os cards.

## Como rodar localmente

```bash
cd landing
npm install
npm run dev
```

Abre em `http://localhost:3000`.

> Por padrão, Next.js 15 ocupa a porta `3000`. O frontend Expo do app GuiaFlow normalmente roda em `8081`, então não há conflito.

## Build de produção

```bash
npm run build
npm run start
```

## Deploy na Vercel (recomendado)

1. Crie um repositório no GitHub apenas com a pasta `landing/` (ou monorepo com `landing/` na raiz).
2. Em https://vercel.com → **Add New Project** → conecte o repositório.
3. Vercel detecta Next.js automaticamente. Se for monorepo, defina:
   - **Root Directory:** `landing`
4. Variáveis de ambiente: nenhuma obrigatória nesta versão.
5. Clique em **Deploy**.

A Vercel cuida de SSL, CDN global e preview por branch sem nenhuma configuração extra.

## Estrutura de pastas

```
landing/
├── app/
│   ├── layout.tsx          # Root layout + metadata SEO
│   ├── page.tsx            # Composição das sections
│   └── globals.css         # Tailwind + utilitários custom (aurora, glass, gradient text)
├── components/
│   ├── site-nav.tsx        # Header sticky com glass
│   ├── site-footer.tsx
│   ├── mockup/
│   │   └── dashboard-mockup.tsx   # Mockup CSS do dashboard real
│   ├── sections/
│   │   ├── hero.tsx
│   │   ├── pain.tsx
│   │   ├── ocr.tsx
│   │   ├── how-it-works.tsx
│   │   ├── timeline.tsx
│   │   ├── differentials.tsx
│   │   ├── results.tsx
│   │   ├── dashboard-preview.tsx
│   │   ├── social-proof.tsx
│   │   └── final-cta.tsx
│   └── ui/
│       ├── button.tsx
│       ├── badge.tsx
│       ├── card.tsx
│       └── reveal.tsx       # Wrapper de scroll reveal com Framer Motion
└── lib/
    └── cn.ts                # Utilitário tailwind-merge + clsx
```

## Sections incluídas

1. **Hero** — Headline forte, aurora glow, 3 stats sociais, mockup do dashboard com glow.
2. **Bloco de dor** — 8 cards com hover gradient, ícones, problemas reais do escritório.
3. **OCR Inteligente** — Visual lado a lado: documento + IA scan beam + campos extraídos animados.
4. **Como funciona** — 4 passos com timeline conectada e números.
5. **Timeline automática** — 5 eventos sequenciais com estado `done`/`live`/`pending`, ping animado no estado vivo.
6. **Diferenciais** — Grid 4×2 com hover gradient direcional.
7. **Dashboard preview** — Parallax leve no scroll + cards de highlights.
8. **Resultados** — 8 KPIs em cards (`-72%`, `+3,4x` etc.).
9. **Prova social** — Estatísticas + 3 depoimentos.
10. **CTA final** — Headline forte, partículas flutuantes, gradiente radial.
11. **Footer** — 3 colunas + linha divisória com glow.

## Customização rápida

- **Cores brand:** `tailwind.config.ts` → `theme.extend.colors.brand` e `violet`.
- **Conteúdo dos cards:** todos os arrays (`pains`, `items`, `events`, `benefits`, `quotes`, `stats`) ficam no topo de cada section, fáceis de editar.
- **Mockup do dashboard:** `components/mockup/dashboard-mockup.tsx` — recriado em CSS do dashboard real do produto. Para trocar por screenshot real, substitua o conteúdo desse componente por `<Image src="/dashboard.png" .../>`.

## Acessibilidade & motion

- Respeita `prefers-reduced-motion` (componente `Reveal` desativa transformações).
- Foco visível em todos os botões (ring brand).
- Contraste AA garantido pelos pares de tons (`text-white/85` em `bg-ink-950`).

## Licença

Uso interno GuiaFlow.
