import type { TemplateFormat } from "@/engine";
import type { DateFilterMode } from "@/pages/templates/matchDateFilter";

const STORAGE_KEY = "urano-faf:artes-filters";

export interface ArtesFilterPreferences {
  format?: TemplateFormat;
  competitionIds?: string[];
  dateMode?: DateFilterMode;
  customIso?: string;
}

/** Remembers the last filters used on the "Central de Geração" screen for this browser session only (CP7). */
export function loadArtesFilterPreferences(): ArtesFilterPreferences {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ArtesFilterPreferences) : {};
  } catch {
    return {};
  }
}

export function saveArtesFilterPreferences(preferences: ArtesFilterPreferences): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Best-effort only — remembering filters is a UI convenience, never business data.
  }
}
