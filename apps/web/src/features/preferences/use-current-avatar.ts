import { useEffect, useState } from 'react';
import { apiBlob } from '@/lib/api';

export function useCurrentAvatar(hasAvatar: boolean | undefined, avatarUpdatedAt?: string | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (!hasAvatar) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    void apiBlob('/preferences/avatar', { signal: controller.signal })
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [hasAvatar, avatarUpdatedAt]);

  return url;
}
