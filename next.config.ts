import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // 자료 파일 업로드(FormData server action)용. 자료 정책의 최대 크기와 맞춤.
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
