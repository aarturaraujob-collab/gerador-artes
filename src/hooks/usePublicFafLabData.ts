import { useEffect, useState } from "react";

import { ClubRepository, type Club } from "@/modules/clubRepository";
import { CompetitionRepository, type CompetitionRecord } from "@/modules/competitionRepository";
import { matchRepository } from "@/modules/matchRepository";
import { playerStatsRepository } from "@/modules/playerStatsRepository";
import type { Match } from "@/modules/dataStore";

const clubRepo = new ClubRepository();
const competitionRepo = new CompetitionRepository();

/**
 * Read-only data source for the public FAF Lab page (/publico/faf-lab) — only
 * fetches the tables that page needs and that have a public RLS policy
 * (competitions, clubs, matches). Deliberately bypasses the shared
 * `dataStore` singleton, which also loads `operational_staff` (CPF/phone/PIX)
 * that must never reach an anonymous visitor.
 */
export function usePublicFafLabData() {
  const [competitions, setCompetitions] = useState<CompetitionRecord[]>([]);
  const [clubsById, setClubsById] = useState<Map<string, Club>>(new Map());
  const [matches, setMatches] = useState<Match[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([competitionRepo.list(), clubRepo.list(), matchRepository.list()]).then(
      async ([competitionRows, clubRows, matchRows]) => {
        if (cancelled) return;
        // Rollout gradual: só as edições marcadas como prontas
        // (public_visible) aparecem no FAF Lab público — as outras ficam
        // disponíveis só para quem está logado, enquanto o elenco/estatística
        // ainda está sendo ajustado.
        const visible = competitionRows.filter((item) => !item.deletedAt && item.publicVisible);
        const visibleIds = new Set(visible.map((item) => item.id));
        const visibleMatches = matchRows.filter((match) => visibleIds.has(match.competitionId));
        const playerCount = await playerStatsRepository.countForCompetitions([...visibleIds]);
        if (cancelled) return;
        setCompetitions(visible);
        setClubsById(new Map(clubRows.filter((item) => !item.deletedAt).map((club) => [club.id, club])));
        setMatches(visibleMatches);
        setTotalPlayers(playerCount);
        setLoaded(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return { competitions, clubsById, matches, totalPlayers, loaded };
}
