import React from "react";

interface Props {
  rounds: string[];
  value?: string;
  onChange: (r: string) => void;
}

export default function RoundSelect({ rounds, value, onChange }: Props) {
  return (
    <div className="round-select">
      <label>Rodada</label>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Selecione —</option>
        {rounds.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}
