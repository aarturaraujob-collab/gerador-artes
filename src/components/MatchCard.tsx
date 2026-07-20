import React from "react";

interface Props {
  match: any;
  onSelect?: (m: any, checked: boolean) => void;
  selected?: boolean;
}

export default function MatchCard({ match, onSelect, selected }: Props) {
  const home = match.homeClubId || match.home || match.homeClub || "";
  const away = match.awayClubId || match.away || match.awayClub || "";
  const date = match.date || "";
  const time = match.time || "";

  return (
    <div className="match-card">
      <input
        type="checkbox"
        checked={!!selected}
        onChange={(e) => onSelect && onSelect(match, e.target.checked)}
      />
      <div className="teams">
        <div className="team home">{home}</div>
        <div className="versus">x</div>
        <div className="team away">{away}</div>
      </div>
      <div className="meta">{date} {time}</div>
    </div>
  );
}
