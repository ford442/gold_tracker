import { useEffect, useState } from 'react';

export type PriceFlashDirection = 'up' | 'down' | null;

const FLASH_MS = 800;

/**
 * Returns a flash direction when `price` changes, clearing after the CSS animation.
 */
export function usePriceFlash(price: number): PriceFlashDirection {
  const [prevPrice, setPrevPrice] = useState(price);
  const [flash, setFlash] = useState<PriceFlashDirection>(null);

  if (price !== prevPrice) {
    const direction =
      Number.isFinite(price) && Number.isFinite(prevPrice)
        ? (price > prevPrice ? 'up' : 'down')
        : null;
    setPrevPrice(price);
    setFlash(direction);
  }

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(t);
  }, [flash]);

  return flash;
}
