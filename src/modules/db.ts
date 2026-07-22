/**
 * Shared IndexedDB connection for every durable collection in the app
 * (competitions, clubs, stadiums, ...). One database, one connection promise,
 * one place that owns schema versioning — adding a new object store means
 * adding its name below and bumping DB_VERSION; IndexedDB handles the
 * upgrade transparently, existing stores and their data are untouched.
 */

const DB_NAME = "faf-mkt-ops";
const DB_VERSION = 2;
const STORE_NAMES = ["competitions", "clubs", "stadiums"] as const;

export type StoreName = (typeof STORE_NAMES)[number];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

export async function getStore(name: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await getDb();
  return db.transaction(name, mode).objectStore(name);
}
