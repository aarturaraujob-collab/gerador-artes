import type { CompetitionFormat } from "./competitionRepository";

export interface FormatBracketNode {
  id: string;
  phaseId: string;
  groupLetter: string;
  home: string;
  away: string;
}

export interface FormatBracketConnection {
  fromNodeId: string;
  toNodeId: string;
  toSide: "home" | "away";
}

export interface FormatBracketPhase {
  id: string;
  name: string;
  nodes: FormatBracketNode[];
}

export interface FormatBracket {
  phases: FormatBracketPhase[];
  connections: FormatBracketConnection[];
}

const GROUP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function letterFor(index: number): string {
  return GROUP_LETTERS[index] ?? `G${index + 1}`;
}

/**
 * Builds the elimination-stage flowchart straight from the competition's
 * fórmula de disputa — no match data involved. One column per mata-mata
 * phase, one box per confronto, connected to whichever earlier confronto
 * produced its "Vencedor Grupo X" side. Matchup sides are always exactly one
 * of computeFormatSeeding's producedOptions labels (the wizard only lets you
 * pick from that list), so a plain string match is enough to find the source.
 */
export function computeFormatBracket(format: CompetitionFormat | undefined): FormatBracket {
  const phases = format?.phases ?? [];
  let letterCursor = 0;
  const producedBy = new Map<string, string>();
  const bracketPhases: FormatBracketPhase[] = [];
  const connections: FormatBracketConnection[] = [];

  for (const phase of phases) {
    if (phase.type !== "mata-mata") {
      letterCursor += Math.max(1, phase.groupCount ?? 1);
      continue;
    }

    const nodes: FormatBracketNode[] = [];
    for (const matchup of phase.matchups ?? []) {
      const letter = letterFor(letterCursor++);
      nodes.push({ id: matchup.id, phaseId: phase.id, groupLetter: letter, home: matchup.home, away: matchup.away });

      for (const side of ["home", "away"] as const) {
        const sourceNodeId = matchup[side] ? producedBy.get(matchup[side]) : undefined;
        if (sourceNodeId) connections.push({ fromNodeId: sourceNodeId, toNodeId: matchup.id, toSide: side });
      }

      producedBy.set(`Vencedor Grupo ${letter}`, matchup.id);
    }
    bracketPhases.push({ id: phase.id, name: phase.name || "Mata-mata", nodes });
  }

  return { phases: bracketPhases, connections };
}

export function hasKnockoutPhase(format: CompetitionFormat | undefined): boolean {
  return (format?.phases ?? []).some((phase) => phase.type === "mata-mata" && (phase.matchups?.length ?? 0) > 0);
}
