const STORAGE_KEY = "urano-faf:activity-log";
const MAX_ENTRIES = 50;

export type ActivityAction =
  | "competition.created"
  | "competition.updated"
  | "competition.deleted"
  | "competition.restored"
  | "club.created"
  | "club.updated"
  | "club.deleted"
  | "club.restored"
  | "stadium.created"
  | "stadium.updated"
  | "stadium.deleted"
  | "stadium.restored"
  | "import.matches"
  | "export.png"
  | "imt.generated";

export interface ActivityEntry {
  id: string;
  action: ActivityAction;
  label: string;
  timestamp: number;
}

function readEntriesFromStorage(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ActivityEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Single in-memory cache, read from localStorage once at module load.
 * useSyncExternalStore requires getSnapshot() to return the SAME reference
 * when nothing changed — re-parsing localStorage on every call (the
 * previous implementation) handed back a brand-new array every render,
 * which React interprets as "the store changed", triggering another
 * render, forever ("Maximum update depth exceeded"). This is only ever
 * reassigned by writeEntries (i.e. logActivity), never on read.
 */
let cachedEntries: ActivityEntry[] = readEntriesFromStorage();

function writeEntries(entries: ActivityEntry[]): void {
  cachedEntries = entries;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Best-effort only — a full/unavailable localStorage should never block the action being logged.
  }
}

const listeners = new Set<() => void>();

/** No backend yet — this is a client-side trail (localStorage), capped at the last 50 actions. */
export function getActivityLog(): ActivityEntry[] {
  return cachedEntries;
}

export function subscribeActivityLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function logActivity(action: ActivityAction, label: string): void {
  const entry: ActivityEntry = { id: crypto.randomUUID(), action, label, timestamp: Date.now() };
  writeEntries([entry, ...cachedEntries].slice(0, MAX_ENTRIES));
  listeners.forEach((listener) => listener());
}
