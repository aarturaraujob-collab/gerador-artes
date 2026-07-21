import { useSyncExternalStore } from "react";

import { dataStore, type DataStore } from "@/modules/dataStore";

/** Subscribes a component to the live data store (seed data + imports). */
export function useDataStore(): DataStore {
  return useSyncExternalStore(dataStore.subscribe, dataStore.getSnapshot);
}
