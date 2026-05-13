declare module 'next-pwa' {
  import type { NextConfig } from 'next';

  type PwaOptions = {
    dest: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    runtimeCaching?: unknown[];
  };

  export default function nextPwa(options: PwaOptions): (config: NextConfig) => NextConfig;
}
