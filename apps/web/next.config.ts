import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Raiz do rastreamento de arquivos do build standalone: este app (evita avisos com vários lockfiles).
  outputFileTracingRoot: path.join(__dirname),
  // Gera um servidor autocontido (.next/standalone): imagem Docker enxuta.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // As imagens vêm do acervo do museu e são exibidas com <img> (sem otimização do Next),
    // então não é preciso liberar domínios aqui.
    unoptimized: true,
  },
};

export default nextConfig;
