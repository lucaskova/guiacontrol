// @ts-nocheck
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Snippet inline executado antes da hidratação do React.
 * 1) Detecta se a URL é da Área do Cliente (/cliente/<token>)
 *    e troca o manifest para um nome/escopo específico — assim o cliente
 *    instala "Minhas Guias" e o contador instala "GuiaControl".
 * 2) Registra o Service Worker (PWA offline shell).
 */
const PWA_BOOTSTRAP = `
(function () {
  try {
    var p = window.location.pathname || '/';
    var isCliente = p.indexOf('/cliente/') === 0;

    if (isCliente) {
      var parts = p.split('/').filter(Boolean); // ['cliente', '<token>']
      var token = parts[1] || '';
      var manifest = {
        name: 'Minhas Guias — GuiaControl',
        short_name: 'Minhas Guias',
        description: 'Suas guias fiscais — acesse, pague e envie comprovantes.',
        start_url: '/cliente/' + token,
        scope: '/cliente/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFFFFF',
        theme_color: '#0F766E',
        lang: 'pt-BR',
        icons: [
          { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
          { src: '/icon-192.png', type: 'image/png', sizes: '192x192', purpose: 'any' },
          { src: '/icon-512.png', type: 'image/png', sizes: '512x512', purpose: 'any' },
          { src: '/icon-maskable-512.png', type: 'image/png', sizes: '512x512', purpose: 'maskable' }
        ]
      };
      var blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
      var url = URL.createObjectURL(blob);
      var link = document.getElementById('app-manifest');
      if (link) link.setAttribute('href', url);
      document.title = 'Minhas Guias';
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () {});
      });
    }
  } catch (e) {}
})();
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR" style={{ height: '100%' }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <meta name="format-detection" content="telephone=no" />

        <title>GuiaControl — Automação fiscal inteligente</title>
        <meta
          name="description"
          content="Automação fiscal para escritórios contábeis. OCR Inteligente, lembretes e acompanhamento em tempo real."
        />

        {/* PWA */}
        <link id="app-manifest" rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0F766E" />
        <meta name="application-name" content="GuiaControl" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GuiaControl" />

        {/* Ícones */}
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="mask-icon" href="/icon.svg" color="#0F766E" />

        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
          If you want to enable scrolling, remove `ScrollViewStyleReset` and
          set `overflow: auto` on the body style below.
        */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
            `,
          }}
        />

        <script dangerouslySetInnerHTML={{ __html: PWA_BOOTSTRAP }} />
      </head>
      <body
        style={{
          margin: 0,
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </body>
    </html>
  );
}
