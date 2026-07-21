import { cities as cityRows } from "../../tables/cities";
import { clubs as clubRows } from "../../tables/clubs";
import { competitions as competitionRows } from "../../tables/competitions";
import { matches as matchRows } from "../../tables/matches";
import { stadiums as stadiumRows } from "../../tables/stadiums";

export interface Competition {
  id: string;
  name: string;
  logo: string;
}

export interface Club {
  id: string;
  shortName: string;
  fullName: string;
  shield: string;
}

export interface City {
  id: string;
  name: string;
}

export interface Stadium {
  id: string;
  name: string;
  cityId: string;
}

export interface Match {
  competitionId: string;
  round: string;
  date: string;
  time: string;
  homeClubId: string;
  awayClubId: string;
  stadiumId: string;
  cityId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  tv: string | null;
}

export interface DataStore {
  competitions: readonly Competition[];
  clubs: readonly Club[];
  cities: readonly City[];
  stadiums: readonly Stadium[];
  matches: readonly Match[];
  clubsById: ReadonlyMap<string, Club>;
  citiesById: ReadonlyMap<string, City>;
  stadiumsById: ReadonlyMap<string, Stadium>;
  lastUpdated: string;
}

function latestTableDate(matches: readonly Match[]): string {
  const dates = matches
    .map((match) => match.date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))
    .filter((parts): parts is RegExpMatchArray => parts !== null)
    .map(([, day, month, year]) => `${year}-${month}-${day}`)
    .sort();
  return dates[dates.length - 1] ?? "—";
}

function createDataStore(): DataStore {
  const competitions = competitionRows as readonly Competition[];
  const clubs = clubRows as readonly Club[];
  const cities = cityRows as readonly City[];
  const stadiums = stadiumRows as readonly Stadium[];
  const matches = matchRows as readonly Match[];

  return {
    competitions,
    clubs,
    cities,
    stadiums,
    matches,
    clubsById: new Map(clubs.map((club) => [club.id, club])),
    citiesById: new Map(cities.map((city) => [city.id, city])),
    stadiumsById: new Map(stadiums.map((stadium) => [stadium.id, stadium])),
    lastUpdated: latestTableDate(matches),
  };
}

// The table modules are bundled once. This immutable store is the sole in-memory cache.
export const dataStore = createDataStore();

export function getCompetitions(): readonly Competition[] {
  return dataStore.competitions;
}

export function getMatches(): readonly Match[] {
  return dataStore.matches;
}

export function getClubs(): readonly Club[] {
  return dataStore.clubs;
}

export function getCities(): readonly City[] {
  return dataStore.cities;
}

export function getStadiums(): readonly Stadium[] {
  return dataStore.stadiums;
}
