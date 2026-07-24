/**
 * Shared IndexedDB plumbing for every document type under src/documents —
 * one database, one object store per document type. Deliberately separate
 * from src/modules/db.ts (the app's shared database) so this module stays
 * fully self-contained, per the sprint's "independent module" requirement.
 */
const DB_NAME = "urano-faf-documents";
const DB_VERSION = 2;

interface StoreIndexDefinition {
  name: string;
  keyPath: string;
}

interface StoreDefinition {
  name: string;
  indexes: StoreIndexDefinition[];
}

/** Every store this database knows about. Adding a new document type means adding one entry here. */
const STORES: StoreDefinition[] = [
  {
    name: "imts",
    indexes: [
      { name: "season", keyPath: "season" },
      { name: "gameRef", keyPath: "gameRef" },
    ],
  },
  {
    name: "detailedTables",
    indexes: [
      { name: "competitionId", keyPath: "competitionId" },
      { name: "status", keyPath: "status" },
    ],
  },
];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeDef of STORES) {
        if (db.objectStoreNames.contains(storeDef.name)) continue;
        const store = db.createObjectStore(storeDef.name, { keyPath: "id" });
        for (const index of storeDef.indexes) {
          store.createIndex(index.name, index.keyPath, { unique: false });
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

export function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

export async function getStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await getDb();
  return db.transaction(storeName, mode).objectStore(storeName);
}
