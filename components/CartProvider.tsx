// components/CartProvider.tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine } from "@/lib/types";

type NewLine = Omit<CartLine, "id">;

type CartContextValue = {
  lines: CartLine[];
  ready: boolean;
  count: number;
  subtotal: number;
  addLine: (line: NewLine) => void;
  upsertDesignLine: (line: NewLine & { designId: string }) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeLine: (id: string) => void;
  clearDesign: (id: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "novaedge-cart-v1";

function newId() {
  return crypto.randomUUID();
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage after hydration avoids a server/client mismatch
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* storage blocked: the cart simply lives for this visit */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [lines, ready]);

  const addLine = useCallback((line: NewLine) => {
    setLines((current) => {
      // A customized item is always its own line (one design per item).
      if (!line.designId) {
        const match = current.find(
          (l) => !l.designId && l.productId === line.productId && l.size === line.size && l.color === line.color
        );
        if (match) {
          return current.map((l) => (l.id === match.id ? { ...l, quantity: Math.min(l.quantity + line.quantity, 20) } : l));
        }
      }
      return [...current, { ...line, id: newId() }];
    });
  }, []);

  const upsertDesignLine = useCallback((line: NewLine & { designId: string }) => {
    setLines((current) => {
      const existing = current.find((l) => l.designId === line.designId);
      if (existing) return current.map((l) => (l.id === existing.id ? { ...l, ...line, id: existing.id, quantity: 1 } : l));
      return [...current, { ...line, quantity: 1, id: newId() }];
    });
  }, []);

  const setQuantity = useCallback((id: string, quantity: number) => {
    setLines((current) =>
      current.map((l) => (l.id === id && !l.designId ? { ...l, quantity: Math.max(1, Math.min(quantity, 20)) } : l))
    );
  }, []);

  const removeLine = useCallback((id: string) => setLines((current) => current.filter((l) => l.id !== id)), []);

  const clearDesign = useCallback(
    (id: string) => setLines((current) => current.map((l) => (l.id === id ? { ...l, designId: null, printUrl: null } : l))),
    []
  );

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      ready,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
      addLine,
      upsertDesignLine,
      setQuantity,
      removeLine,
      clearDesign,
      clear,
    }),
    [lines, ready, addLine, upsertDesignLine, setQuantity, removeLine, clearDesign, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
