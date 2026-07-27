import { useSyncExternalStore } from "react";

import { getAuthSnapshot, subscribeAuth, type AuthSnapshot } from "@/modules/auth";

/** Subscribes a component to the current Supabase Auth session. */
export function useAuthSession(): AuthSnapshot {
  return useSyncExternalStore(subscribeAuth, getAuthSnapshot);
}
