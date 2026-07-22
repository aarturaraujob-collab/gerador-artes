import { useSyncExternalStore } from "react";

import { getActivityLog, subscribeActivityLog, type ActivityEntry } from "@/modules/activityLog";

/** Subscribes a component to the client-side activity log (localStorage-backed). */
export function useActivityLog(): ActivityEntry[] {
  return useSyncExternalStore(subscribeActivityLog, getActivityLog);
}
