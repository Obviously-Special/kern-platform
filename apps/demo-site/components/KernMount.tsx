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
      });
    });
  }, []);

  return null;
}
