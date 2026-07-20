// dataStore: loads tables/*.ts once and caches them in memory.
// Provides refresh() to re-import modules with cache-busting query string.

export type Competition = { id: string; name: string; logo?: string };
export type Club = { id: string; shortName: string; fullName?: string; shield?: string };
export type Stadium = { id: string; name: string; cityId?: string };
export type Match = any; // Keep generic to remain compatible with generator/normalizer output

let competitions: Competition[] = [];
let clubs: Club[] = [];
let stadiums: Stadium[] = [];
let matches: Match[] = [];

async function importModule<T = any>(path: string): Promise<T> {
  // Cache bust to allow refresh after files change
  const url = `${path}?t=${Date.now()}`;
  const mod = await import(/* @vite-ignore */ url);
  // modules export const X = ... as const
  const key = Object.keys(mod)[0];
  return mod[key] as T;
}

export async function loadAll() {
  if (competitions.length || clubs.length || matches.length || stadiums.length) {
    // already loaded
    return {
      competitions,
      clubs,
      stadiums,
      matches,
    };
  }

  try {
    competitions = (await importModule<Competition[]>("/tables/competitions.ts")) || [];
  } catch (e) {
    competitions = [];
  }

  try {
    clubs = (await importModule<Club[]>("/tables/clubs.ts")) || [];
  } catch (e) {
    clubs = [];
  }

  try {
    stadiums = (await importModule<Stadium[]>("/tables/stadiums.ts")) || [];
  } catch (e) {
    stadiums = [];
  }

  try {
    matches = (await importModule<Match[]>("/tables/matches.ts")) || [];
  } catch (e) {
    matches = [];
  }

  return { competitions, clubs, stadiums, matches };
}

export async function refreshAll() {
  competitions = [];
  clubs = [];
  stadiums = [];
  matches = [];
  return loadAll();
}

export function getCompetitions() {
  return competitions;
}

export function getMatches() {
  return matches;
}

export function getClubs() {
  return clubs;
}

export function getStadiums() {
  return stadiums;
}
