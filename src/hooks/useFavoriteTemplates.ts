import { useSyncExternalStore } from "react";

import { getFavoriteTemplates, subscribeFavoriteTemplates } from "@/modules/templateFavorites";

/** Subscribes a component to the favorited-template set (localStorage-backed). */
export function useFavoriteTemplates(): Set<string> {
  return useSyncExternalStore(subscribeFavoriteTemplates, getFavoriteTemplates);
}
