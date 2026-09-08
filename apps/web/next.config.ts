import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { NextConfig } from 'next';

// O monorepo tem UM .env, na raiz. O Next só lê o .env do próprio app, então
// carregamos o da raiz aqui — duplicar env por app é a origem clássica de
// "funciona na API mas não no painel".
const rootEnv = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // Única variável que chega ao browser. Todo o resto do .env fica no servidor.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
      { protocol: 'https', hostname: 'static-cdn.jtvnw.net' },
    ],
  },
};

export default nextConfig;
