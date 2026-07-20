import React from "react";
import type { Competition } from "../modules/dataStore";

interface Props {
  competitions: Competition[];
  value?: string;
  onChange: (id: string) => void;
}

export default function CompetitionSelect({ competitions, value, onChange }: Props) {
  return (
    <div className="competition-select">
      <label>Competição</label>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Selecione —</option>
        {competitions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
