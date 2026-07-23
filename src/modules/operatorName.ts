const STORAGE_KEY = "urano-faf:operator-name";

/** Who to attribute new match-history entries to — no auth system, so this is a self-declared, locally stored name. */
export function getOperatorName(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setOperatorName(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Best-effort only — a full/unavailable localStorage should never block the setting from being used in-session.
  }
}
