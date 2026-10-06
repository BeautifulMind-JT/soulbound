import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { secureKeyValueStore } from "../auth/secure-store";
import { parseBlockedMembers, toggleBlocked } from "./safety";

const STORAGE_KEY = "soulbound.blocked-members";

interface BlockContextValue {
  readonly blocked: readonly number[];
  readonly isBlocked: (memberNumber: number) => boolean;
  readonly toggle: (memberNumber: number) => void;
}

const BlockContext = createContext<BlockContextValue | null>(null);

// Local-only, device-persisted block/hide list. There is no backend block
// endpoint yet (documented blocker).
export function BlockProvider({ children }: { readonly children: ReactNode }) {
  const [blocked, setBlocked] = useState<readonly number[]>([]);

  useEffect(() => {
    void secureKeyValueStore.getItem(STORAGE_KEY)
      .then((raw) => setBlocked(parseBlockedMembers(raw)))
      .catch(() => setBlocked([]));
  }, []);

  const toggle = useCallback((memberNumber: number) => {
    setBlocked((current) => {
      const next = toggleBlocked(current, memberNumber);
      void secureKeyValueStore.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo<BlockContextValue>(() => ({
    blocked,
    isBlocked: (memberNumber) => blocked.includes(memberNumber),
    toggle,
  }), [blocked, toggle]);

  return <BlockContext.Provider value={value}>{children}</BlockContext.Provider>;
}

export function useBlocks(): BlockContextValue {
  const value = useContext(BlockContext);
  if (!value) {
    throw new Error("useBlocks must be used within BlockProvider");
  }
  return value;
}
