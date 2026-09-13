import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['pino', 'cheerio', 'robots-parser', 'ipaddr.js'],
  experimental: { cpus: 2 },
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/Quiz/index.html', destination: '/quiz', permanent: true },
      { source: '/Gallary/Gallary.html', destination: '/gallery', permanent: true },
    ];
  },
};
export default config;
