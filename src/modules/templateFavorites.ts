const STORAGE_KEY = "urano-faf:favorite-templates";

function readFavoritesFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/**
 * Single in-memory cache, read from localStorage once at module load. Same
 * fix as activityLog.ts: useSyncExternalStore needs getSnapshot() to return
 * the SAME reference when nothing changed — re-parsing into a `new Set(...)`
 * on every call handed back a brand-new object every render, which React
 * treats as "the store changed" and re-renders forever ("Maximum update
 * depth exceeded"). Only ever reassigned by writeFavorites, never on read.
 */
let cachedFavorites: Set<string> = readFavoritesFromStorage();

function writeFavorites(favorites: Set<string>): void {
  cachedFavorites = favorites;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
  } catch {
    // Best-effort only — favoriting is a UI preference, never business data.
  }
}

const listeners = new Set<() => void>();

export function getFavoriteTemplates(): Set<string> {
  return cachedFavorites;
}

export function subscribeFavoriteTemplates(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toggleFavoriteTemplate(templateId: string): void {
  // Clone before mutating — reusing cachedFavorites in place would mean
  // writeFavorites reassigns the exact same reference, and
  // useSyncExternalStore would never notice the change.
  const favorites = new Set(cachedFavorites);
  if (favorites.has(templateId)) favorites.delete(templateId);
  else favorites.add(templateId);
  writeFavorites(favorites);
  listeners.forEach((listener) => listener());
}
