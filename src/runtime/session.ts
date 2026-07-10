const STORAGE_KEY = "fleethq-embed:session";

interface SessionState {
  url: string;
  mode: "inline" | "modal";
  title?: string;
  targetSelector?: string | null;
  tenant?: string | null;
  savedAt: number;
}

const TTL_MS = 30 * 60 * 1000;

const readStorage = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const saveSession = (state: Omit<SessionState, "savedAt">): void => {
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {
    /* quota / private mode — silently drop */
  }
};

export const loadSession = (): SessionState | null => {
  const storage = readStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionState;
    if (!parsed.url || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearSession = (): void => {
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};
