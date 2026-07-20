import React from "react";

interface Props {
  competitions: number;
  matches: number;
  clubs: number;
  stadiums: number;
}

export default function Dashboard({ competitions, matches, clubs, stadiums }: Props) {
  return (
    <div className="dashboard">
      <div>Competições: <strong>{competitions}</strong></div>
      <div>Jogos: <strong>{matches}</strong></div>
      <div>Clubes: <strong>{clubs}</strong></div>
      <div>Estádios: <strong>{stadiums}</strong></div>
    </div>
  );
}
