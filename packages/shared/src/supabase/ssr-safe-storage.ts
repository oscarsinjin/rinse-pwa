interface StorageLike {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
}

/**
 * Expo Router's web "static" output renders screens on Node during dev/export,
 * where `window` doesn't exist. AsyncStorage's web shim reaches for
 * `window.localStorage` unconditionally and crashes the whole server. This
 * wrapper no-ops on the server and only touches real storage on the client.
 */
export function createSSRSafeStorage(storage: StorageLike): StorageLike {
  const isServer = typeof window === 'undefined';

  return {
    getItem: (key) => (isServer ? Promise.resolve(null) : storage.getItem(key)),
    setItem: (key, value) => (isServer ? Promise.resolve() : storage.setItem(key, value)),
    removeItem: (key) => (isServer ? Promise.resolve() : storage.removeItem(key)),
  };
}
