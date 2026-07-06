import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const repoRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: repoRoot,
  experimental: {
    serverActions: {
      // 자료 파일 업로드(FormData server action)용. 자료 정책의 최대 크기와 맞춤.
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
