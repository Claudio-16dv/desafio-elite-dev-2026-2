import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/fraunces/wght-italic.css';
import type { Metadata, Viewport } from 'next';
import { AppFooter } from '@/components/layout/app-footer';
import { AppHeader } from '@/components/layout/app-header';
import { Providers } from '@/components/layout/providers';
import { runtimeConfigScript } from '@/lib/runtime-config';
import './globals.css';

// A configuração de runtime (API_URL) é lida a cada requisição, não no build.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Casa de Leilões', template: '%s | Casa de Leilões' },
  description: 'Leilões online ao vivo: dê lances, acompanhe em tempo real e audite o histórico de cada lote.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf7' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1816' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Configuração de runtime (endereço da API): script síncrono, roda antes do React hidratar. */}
        <script dangerouslySetInnerHTML={{ __html: runtimeConfigScript() }} />
      </head>
      <body className="relative min-h-dvh overflow-x-hidden">
        {/* Fundo "aurora": manchas de cor desfocadas, fixas atrás de todo o conteúdo. */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -left-32 size-[34rem] animate-aurora rounded-full bg-brand-3/10 blur-[120px] dark:bg-brand-3/5" />
          <div className="absolute top-1/3 -right-40 size-[30rem] animate-aurora rounded-full bg-brand-2/5 blur-[120px] [animation-delay:-6s] dark:bg-brand-2/5" />
          <div className="absolute -bottom-48 left-1/4 size-[28rem] animate-aurora rounded-full bg-brand-1/5 blur-[120px] [animation-delay:-12s] dark:bg-brand-1/5" />
          <div className="absolute inset-0 bg-dots opacity-25 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        </div>

        <Providers>
          <a
            href="#conteudo"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            Pular para o conteúdo
          </a>
          <AppHeader />
          <main id="conteudo" className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-10">
            {children}
          </main>
          <AppFooter />
        </Providers>
      </body>
    </html>
  );
}
