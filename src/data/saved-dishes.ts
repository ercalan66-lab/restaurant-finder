import { useCallback, useEffect, useState } from 'react';

import Storage from '@/utils/kv-store';
import { SAVED_DISHES_KEY } from './guest-storage';

/** Foods saved with ♡ on this device (dish ids), like saved restaurants. */
export function useSavedDishes() {
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    Storage.getItem(SAVED_DISHES_KEY)
      .then((value) => { if (active && value) setSaved(new Set(JSON.parse(value) as string[])); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const toggle = useCallback((id: string) => setSaved((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    void Storage.setItem(SAVED_DISHES_KEY, JSON.stringify([...next]));
    return next;
  }), []);

  return { saved, toggle };
}
