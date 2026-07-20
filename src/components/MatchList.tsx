import React from "react";
import MatchCard from "./MatchCard";

interface Props {
  matches: any[];
  onToggle: (m: any, checked: boolean) => void;
  selectedIds: Set<any>;
  filter?: (m: any) => boolean;
}

export default function MatchList({ matches, onToggle, selectedIds, filter }: Props) {
  const list = filter ? matches.filter(filter) : matches;
  return (
    <div className="match-list">
      {list.map((m, idx) => (
        <MatchCard
          key={m.ref ?? idx}
          match={m}
          selected={selectedIds.has(m.ref ?? idx) || selectedIds.has(m.id ?? m.ref ?? idx)}
          onSelect={onToggle}
        />
      ))}
    </div>
  );
}
