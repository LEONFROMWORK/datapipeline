import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: undefined,
  },
  // API 타임아웃 설정
  serverRuntimeConfig: {
    // Will only be available on the server-side
    mySecret: 'secret',
  },
  // 이미지 최적화 설정
  images: {
    unoptimized: true,
  },
  // 빌드 시 타입 체크 비활성화 (빠른 빌드를 위해)
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
