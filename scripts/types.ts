export type RawRow = Record<string, string>;

export interface ExtractedRow {
  competition?: string | null;
  phase?: string | null;
  round?: string | null;

  date?: string | null;
  time?: string | null;

  home?: string | null;
  away?: string | null;

  homeGoals?: number | null;
  awayGoals?: number | null;

  stadium?: string | null;
  city?: string | null;
  uf?: string | null;

  tv?: string | null;
  ref?: string | null;
}

export interface Club {
  id: string;
  shortName: string;
  fullName: string;
  shield: string;
}

export interface Stadium {
  id: string;
  name: string;
  cityId: string;
}

export interface City {
  id: string;
  name: string;
}

export interface Competition {
  id: string;
  name: string;
  logo: string;
}

export interface ParsedData {
  clubs: Club[];
  stadiums: Stadium[];
  cities: City[];
  competitions: Competition[];
}

export interface Database {
  clubs: Club[];
  cities: City[];
  stadiums: Stadium[];
  competitions: Competition[];
  matches: any[];
}
