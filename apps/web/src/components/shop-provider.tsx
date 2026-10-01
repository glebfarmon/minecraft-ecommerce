'use client';

import type { Currency, Product } from '@/lib/catalog';
import { findProduct } from '@/lib/catalog';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

type CartLine = { server: string; slug: string; qty: number };

type ShopState = {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  lines: { product: Product; qty: number }[];
  count: number;
  add: (product: Product) => void;
  remove: (product: Product) => void;
};

const ShopContext = createContext<ShopState | null>(null);

const STORAGE_KEY = 'shop:v1';

function load(): { currency?: Currency; cart?: CartLine[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { currency?: Currency; cart?: CartLine[] }) : {};
  } catch {
    return {};
  }
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [{ currency, cart }, setState] = useState<{ currency: Currency; cart: CartLine[] }>({
    currency: 'EUR',
    cart: [],
  });
  const hydrated = useRef(false);

  // Restore after mount so server and first client render match.
  useEffect(() => {
    const saved = load();
    hydrated.current = true;
    if (!saved.currency && !saved.cart) return;
    const restore = () => {
      setState({
        currency: saved.currency === 'PLN' ? 'PLN' : 'EUR',
        cart: Array.isArray(saved.cart) ? saved.cart : [],
      });
    };
    queueMicrotask(restore);
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ currency, cart }));
    } catch {
      // Storage unavailable (private mode); the cart just won't survive a reload.
    }
  }, [currency, cart]);

  const setCurrency = useCallback((next: Currency) => {
    setState((s) => ({ ...s, currency: next }));
  }, []);

  const setCart = useCallback((update: (lines: CartLine[]) => CartLine[]) => {
    setState((s) => ({ ...s, cart: update(s.cart) }));
  }, []);

  const add = useCallback(
    (product: Product) => {
      setCart((lines) => {
        const hit = lines.find((l) => l.server === product.server && l.slug === product.slug);
        if (hit) return lines.map((l) => (l === hit ? { ...l, qty: l.qty + 1 } : l));
        return [...lines, { server: product.server, slug: product.slug, qty: 1 }];
      });
    },
    [setCart],
  );

  const remove = useCallback(
    (product: Product) => {
      setCart((lines) =>
        lines.filter((l) => !(l.server === product.server && l.slug === product.slug)),
      );
    },
    [setCart],
  );

  const value = useMemo<ShopState>(() => {
    const lines = cart.flatMap((l) => {
      const product = findProduct(l.server, l.slug);
      return product ? [{ product, qty: l.qty }] : [];
    });
    return {
      currency,
      setCurrency,
      lines,
      count: lines.reduce((sum, l) => sum + l.qty, 0),
      add,
      remove,
    };
  }, [currency, cart, setCurrency, add, remove]);

  return <ShopContext value={value}>{children}</ShopContext>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside <ShopProvider>');
  return ctx;
}
