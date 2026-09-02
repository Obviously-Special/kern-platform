'use client';

import { useEffect } from 'react';

/**
 * Mounts the KERN browser SDK on the demo site — the stand-in customer.
 * In production deployments the SDK arrives as a script tag; for the
 * walking skeleton we import the workspace package directly.
 */
export default function KernMount() {
  useEffect(() => {
    import('@kern/sdk').then(({ initKern }) => {
      initKern({
        apiUrl: process.env.NEXT_PUBLIC_KERN_API_URL ?? 'http://localhost:8787',
        siteId: 'demo-bergblick',
        // Fixed development key seeded by the API at boot (see apps/api/src/tenants/service.ts).
        // Real customers receive a per-site key from their tenant configuration.
        siteKey: process.env.NEXT_PUBLIC_KERN_SITE_KEY ?? 'kern-demo-site-key-v0',
      });
    });
  }, []);

  return null;
}
