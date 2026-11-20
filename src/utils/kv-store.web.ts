/**
 * Web version of kv-store.ts. Browsers already have localStorage, so the web build uses it instead of
 * expo-sqlite's in-browser SQLite, which needs special server headers and can only be open in one tab
 * ("Access Handles cannot be created if there is another open Access Handle"). Same async methods as
 * expo-sqlite/kv-store, limited to the ones this app uses.
 */
type BrowserStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };

const local = () => (globalThis as { localStorage?: BrowserStorage }).localStorage;

const KeyValueStore = {
  getItem: async (key: string) => local()?.getItem(key) ?? null,
  getItemAsync: async (key: string) => local()?.getItem(key) ?? null,
  setItem: async (key: string, value: string) => { local()?.setItem(key, value); },
  setItemAsync: async (key: string, value: string) => { local()?.setItem(key, value); },
  removeItemAsync: async (key: string) => { local()?.removeItem(key); },
};

export default KeyValueStore;
