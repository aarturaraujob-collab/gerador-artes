import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { Download, Image, Search } from "lucide-react";
import { toast } from "sonner";

import { Dashboard } from "@/components/Dashboard";
import { MainLayout } from "@/components/layout/MainLayout";
import { SvgDocument } from "@/engine/document/SvgDocument";
import { exportToPng } from "@/engine/export/PngExporter";
import { dataStore, type Match } from "@/modules/dataStore";

const DAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÃB"];
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const FALLBACK_SHIELD = "/assets/logos/faf.png";

interface TemplateConfig {
  id: string;
  variants: Array<{ games: number; file: string }>;
}

function parseMatchDate(value: string) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return { day: "", date: value, month: "" };

  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return { day: DAYS[date.getDay()], date: String(Number(day)), month: MONTHS[date.getMonth()] };
}

async function imageToDataUri(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) return imageToDataUri(FALLBACK_SHIELD);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function makeSvgResponsive(svg: string) {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  const element = document.documentElement;
  element.removeAttribute("width");
  element.removeAttribute("height");
  element.setAttribute("width", "100%");
  element.setAttribute("height", "100%");
  element.style.width = "100%";
  element.style.height = "auto";
  element.style.display = "block";
  return new XMLSerializer().serializeToString(document);
}

function clubShield(clubId: string): string {
  return dataStore.clubsById.get(clubId)?.shield || FALLBACK_SHIELD;
}

async function renderMatch(folder: string, match: Match): Promise<string> {
  const configResponse = await fetch(`/templates/${folder}/config.json`);
  if (!configResponse.ok) throw new Error("ConfiguraÃ§Ã£o do template nÃ£o encontrada.");
  const config = (await configResponse.json()) as TemplateConfig;
  const variant = config.variants.find(({ games }) => games === 1);
  if (!variant) throw new Error("O template nÃ£o possui variante para um jogo.");

  const svgResponse = await fetch(`/templates/${folder}/${variant.file}`);
  if (!svgResponse.ok) throw new Error("Arquivo SVG do template nÃ£o encontrado.");
  const document = new SvgDocument(await svgResponse.text());
  const parsedDate = parseMatchDate(match.date);
  const stadium = dataStore.stadiumsById.get(match.stadiumId)?.name ?? "";
  const city = dataStore.citiesById.get(match.cityId)?.name ?? "";
  const [homeShield, awayShield] = await Promise.all([
    imageToDataUri(clubShield(match.homeClubId)),
    imageToDataUri(clubShield(match.awayClubId)),
  ]);

  document.setText("txt_dia", parsedDate.day);
  document.setText("txt_data", parsedDate.date);
  document.setText("txt_mes", parsedDate.month ? `.${parsedDate.month}` : "");
  document.setText("txt_hora", match.time);
  document.setText("txt_cidade", city.toUpperCase());
  document.setText("txt_estadio", stadium.toUpperCase());
  document.setImage("img_escudo_mandante", homeShield);
  document.setImage("img_escudo_visitante", awayShield);
  document.setImage("img_mandante", homeShield);
  document.setImage("img_mandante_2", homeShield);
  document.setImage("img_visitante", awayShield);

  return document.toString();
}

export function TemplateCollection() {
  const { folder } = useParams<{ folder: string }>();
  const [competitionId, setCompetitionId] = useState("");
  const [round, setRound] = useState("");
  const [search, setSearch] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [svgResult, setSvgResult] = useState("");
  const [rendering, setRendering] = useState(false);

  const competitionMatches = useMemo(
    () => dataStore.matches.filter((match) => match.competitionId === competitionId),
    [competitionId],
  );
  const rounds = useMemo(
    () => [...new Set(competitionMatches.map((match) => match.round))],
    [competitionMatches],
  );
  const visibleMatches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return competitionMatches.filter((match) => {
      if (match.round !== round) return false;
      if (!query) return true;
      const values = [
        dataStore.clubsById.get(match.homeClubId)?.shortName,
        dataStore.clubsById.get(match.awayClubId)?.shortName,
        dataStore.citiesById.get(match.cityId)?.name,
        dataStore.stadiumsById.get(match.stadiumId)?.name,
      ];
      return values.some((value) => value?.toLocaleLowerCase("pt-BR").includes(query));
    });
  }, [competitionMatches, round, search]);

  useEffect(() => {
    if (!selectedMatch || !folder) return;
    let active = true;
    setRendering(true);
    setSvgResult("");

    renderMatch(folder, selectedMatch)
      .then((svg) => active && setSvgResult(svg))
      .catch((error: unknown) => {
        if (active) toast.error(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel gerar o preview.");
      })
      .finally(() => active && setRendering(false));

    return () => { active = false; };
  }, [folder, selectedMatch]);

  async function exportPng() {
    if (!svgResult || !folder || !selectedMatch) return;
    const svg = new DOMParser().parseFromString(svgResult, "image/svg+xml").querySelector("svg");
    const width = Number.parseInt(svg?.getAttribute("width") ?? "1080", 10);
    const height = Number.parseInt(svg?.getAttribute("height") ?? "1350", 10);
    await exportToPng(svgResult, width, height, `${folder}-${selectedMatch.date}.png`);
    toast.success("PNG exportado.");
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">Gerador de Arte</h1>
          <p className="mt-2 text-sm text-slate-600">Selecione um jogo do calendÃ¡rio para gerar a arte automaticamente.</p>
        </header>

        <Dashboard dataStore={dataStore} />

        <div className="grid grid-cols-12 gap-5">
          <section className="col-span-12 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4">
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="competition">CompetiÃ§Ã£o</label>
              <select id="competition" value={competitionId} onChange={(event) => { setCompetitionId(event.target.value); setRound(""); setSelectedMatch(null); }} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                <option value="">Selecione uma competiÃ§Ã£o</option>
                {dataStore.competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="round">Rodada</label>
              <select id="round" value={round} disabled={!competitionId} onChange={(event) => { setRound(event.target.value); setSelectedMatch(null); }} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-50">
                <option value="">Selecione uma rodada</option>
                {rounds.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="search">Pesquisar jogos</label>
              <div className="relative mt-2"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input id="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Clube, cidade ou estÃ¡dio" className="h-11 w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm" /></div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Jogos</p>
              {!round && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Selecione uma rodada para listar os jogos.</p>}
              {round && visibleMatches.map((match, index) => {
                const home = dataStore.clubsById.get(match.homeClubId);
                const away = dataStore.clubsById.get(match.awayClubId);
                const isSelected = selectedMatch === match;
                return <button type="button" key={`${match.competitionId}-${match.round}-${index}`} onClick={() => setSelectedMatch(match)} className={`w-full rounded-xl border p-3 text-left transition ${isSelected ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-violet-300 hover:bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-800"><span className="flex min-w-0 items-center gap-2"><img className="h-7 w-7 shrink-0 object-contain" src={clubShield(match.homeClubId)} alt="" />{home?.shortName ?? match.homeClubId}</span><span className="text-slate-400">Ã—</span><span className="flex min-w-0 items-center gap-2"><img className="h-7 w-7 shrink-0 object-contain" src={clubShield(match.awayClubId)} alt="" />{away?.shortName ?? match.awayClubId}</span></div>
                  <p className="mt-2 text-xs text-slate-500">{match.date || "Data a definir"}{match.time ? ` Â· ${match.time}` : ""}</p>
                </button>;
              })}
              {round && visibleMatches.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum jogo encontrado.</p>}
            </div>
          </section>

          <section className="col-span-12 flex min-h-[620px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-8">
            <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-900">Preview</h2><p className="text-sm text-slate-500">O preview Ã© atualizado ao selecionar um jogo.</p></div><button onClick={() => void exportPng()} disabled={!svgResult || rendering} className="flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50"><Download size={16} />Exportar PNG</button></div>
            <div className="flex flex-1 items-center justify-center overflow-auto rounded-xl bg-slate-100 p-6">
              {rendering && <p className="text-sm text-slate-500">Gerando previewâ€¦</p>}
              {!rendering && svgResult && <div className="w-full max-w-3xl" dangerouslySetInnerHTML={{ __html: makeSvgResponsive(svgResult) }} />}
              {!rendering && !svgResult && <div className="text-center text-slate-400"><Image className="mx-auto mb-3" size={36} /><p className="text-sm font-medium text-slate-700">Sem preview disponÃ­vel</p><p className="text-sm">Escolha uma competiÃ§Ã£o, rodada e jogo.</p></div>}
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
