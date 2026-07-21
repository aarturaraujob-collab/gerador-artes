import slugify from "slugify";

import type {
  Club,
  City,
  Competition,
  ExtractedRow,
  Stadium,
} from "./types.js";

export interface NormalizedMatch {
  competitionId: string;
  round: string;
  date: string;
  time: string;

  homeClubId: string;
  awayClubId: string;

  stadiumId: string;
  cityId: string;

  homeGoals?: number;
  awayGoals?: number;

  tv?: string;
}

export interface Database {
  clubs: Club[];
  cities: City[];
  stadiums: Stadium[];
  competitions: Competition[];
  matches: NormalizedMatch[];
}

function id(value: string): string {
  return slugify(value, {
    lower: true,
    strict: true,
    trim: true,
  });
}

export function normalize(
  db: Database,
  competitionName: string,
  rows: ExtractedRow[]
): void {
  const competitionId = id(competitionName);

  if (!db.competitions.some((c) => c.id === competitionId)) {
    db.competitions.push({
      id: competitionId,
      name: competitionName,
    });
  }

  for (const row of rows) {
    if (!row.home || !row.away) continue;

    const homeClubId = id(row.home);
    const awayClubId = id(row.away);

    if (!db.clubs.some((c) => c.id === homeClubId)) {
      db.clubs.push({
        id: homeClubId,
        shortName: row.home,
        fullName: row.home,
        shield: "",
      });
    }

    if (!db.clubs.some((c) => c.id === awayClubId)) {
      db.clubs.push({
        id: awayClubId,
        shortName: row.away,
        fullName: row.away,
        shield: "",
      });
    }

    const cityName = row.city ?? "";
    const cityId = cityName ? id(cityName) : "";

    if (
      cityName &&
      !db.cities.some((c) => c.id === cityId)
    ) {
      db.cities.push({
        id: cityId,
        name: cityName,
      });
    }

    const stadiumName = row.stadium ?? "";
    const stadiumId = stadiumName ? id(stadiumName) : "";

    if (
      stadiumName &&
      !db.stadiums.some((s) => s.id === stadiumId)
    ) {
      db.stadiums.push({
        id: stadiumId,
        name: stadiumName,
        cityId,
      });
    }

    db.matches.push({
      competitionId,

      round: row.round ?? "",
      date: row.date ?? "",
      time: row.time ?? "",

      homeClubId,
      awayClubId,

      stadiumId,
      cityId,

      homeGoals: row.homeGoals,
      awayGoals: row.awayGoals,

      tv: row.tv,
    });
  }
}