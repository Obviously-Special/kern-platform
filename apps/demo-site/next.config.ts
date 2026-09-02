import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source (source-first exports);
  // let Next transpile them alongside the app.
  transpilePackages: ['@kern/sdk', '@kern/contracts'],
};

export default nextConfig;
