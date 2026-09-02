const STORAGE_KEY = "urano-faf:standings-highlight-count";

export const STANDINGS_HIGHLIGHT_OPTIONS = [2, 4, 6, 8] as const;
export type StandingsHighlightCount = (typeof STANDINGS_HIGHLIGHT_OPTIONS)[number];

const DEFAULT_HIGHLIGHT_COUNT: StandingsHighlightCount = 4;

function isValidHighlightCount(value: number): value is StandingsHighlightCount {
  return (STANDINGS_HIGHLIGHT_OPTIONS as readonly number[]).includes(value);
}

export function getStandingsHighlightCount(): StandingsHighlightCount {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return isValidHighlightCount(parsed) ? parsed : DEFAULT_HIGHLIGHT_COUNT;
  } catch {
    return DEFAULT_HIGHLIGHT_COUNT;
  }
}

export function setStandingsHighlightCount(value: StandingsHighlightCount): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Best-effort only — a UI preference, never business data.
  }
}
