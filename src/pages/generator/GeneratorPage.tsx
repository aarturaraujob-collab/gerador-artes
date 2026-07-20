import React, { useEffect, useMemo, useState } from "react";
import { loadAll, getCompetitions, getMatches, getClubs, getStadiums } from "../../modules/dataStore";
import CompetitionSelect from "../../components/CompetitionSelect";
import RoundSelect from "../../components/RoundSelect";
import MatchList from "../../components/MatchList";
import Dashboard from "../../components/Dashboard";
import ImportPanel from "../../components/ImportPanel";

export default function GeneratorPage() {
  const [loaded, setLoaded] = useState(false);
  const [competition, setCompetition] = useState("");
  const [round, setRound] = useState("");
  const [selected, setSelected] = useState<Set<any>>(new Set());
  const [search, setSearch] = useState("");

  const [dataVersion, setDataVersion] = useState(Date.now());

  useEffect(() => {
    loadAll().then(() => setLoaded(true));
  }, [dataVersion]);

  const competitions = getCompetitions();
  const matches = getMatches();
  const clubs = getClubs();
  const stadiums = getStadiums();

  const competitionMatches = useMemo(() => {
    if (!competition) return [];
    return matches.filter((m: any) => m.competitionId === competition || (m.competition && m.competition === competition));
  }, [matches, competition]);

  const rounds = useMemo(() => {
    const s = new Set<string>();
    for (const m of competitionMatches) {
      if (m.round) s.add(m.round);
    }
    return Array.from(s);
  }, [competitionMatches]);

  const filteredMatches = useMemo(() => {
    let list = competitionMatches;
    if (round) list = list.filter((m: any) => m.round === round);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((m: any) => {
        const home = (m.homeClubId || m.home || "").toLowerCase();
        const away = (m.awayClubId || m.away || "").toLowerCase();
        return home.includes(q) || away.includes(q);
      });
    }
    return list;
  }, [competitionMatches, round, search]);

  function handleToggle(m: any, checked: boolean) {
    const key = m.ref ?? m.id ?? JSON.stringify(m);
    const next = new Set(selected);
    if (checked) next.add(key);
    else next.delete(key);
    setSelected(next);
  }

  function handleUpdated() {
    // refresh UI after user executed npm run import:faf and clicked Atualizar banco
    setDataVersion(Date.now());
    loadAll().then(() => setLoaded(true));
  }

  async function handleGenerateSelected() {
    // In this first iteration we will call a global `generate` function if present, else download JSON
    const keys = Array.from(selected);
    const toGenerate = filteredMatches.filter((m: any) => keys.includes(m.ref ?? m.id ?? JSON.stringify(m)));
    for (const m of toGenerate) {
      if ((window as any).generate) {
        try {
          await (window as any).generate(m);
        } catch (e) {
          console.error(e);
        }
      } else {
        const blob = new Blob([JSON.stringify(m, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `match-${m.ref ?? m.id ?? "export"}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Gerador de Artes — FAF</h1>

      <Dashboard
        competitions={competitions.length}
        matches={matches.length}
        clubs={clubs.length}
        stadiums={stadiums.length}
      />

      <ImportPanel onUpdated={handleUpdated} />

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <CompetitionSelect competitions={competitions} value={competition} onChange={(v) => { setCompetition(v); setRound(""); setSelected(new Set()); }} />
        </div>
        <div style={{ width: 240 }}>
          <RoundSelect rounds={rounds} value={round} onChange={(r) => { setRound(r); setSelected(new Set()); }} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Pesquisar clube</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar mandante ou visitante" />
        </div>
        <div>
          <button onClick={handleGenerateSelected}>Gerar Artes Selecionadas</button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <MatchList matches={filteredMatches} onToggle={handleToggle} selectedIds={new Set(selected)} />
      </div>
    </div>
  );
}
