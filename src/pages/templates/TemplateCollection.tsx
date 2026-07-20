import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { SvgDocument } from "@/engine/document/SvgDocument";
import { exportToPng } from "@/engine/export/PngExporter";
import { importSpreadsheet, type GameData } from "@/engine/import/SpreadsheetImporter";
import { clubs, type Club } from "@/data/clubs";
import { Image, Download, Upload, Loader2, ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";

const EMPTY_GAME: GameData = {
  homeId: "", awayId: "",
  dia: "", data: "",
  mes: "", hora: "",
  cidade: "", estadio: "",
};

const DAYS = ["SEG","TER","QUA","QUI","SEX","SÁB","DOM"];
const MONTHS = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

function suffix(index: number) {
  return index === 0 ? "" : `_${index + 1}`;
}

async function imageToDataUri(path: string): Promise<string> {
  const res = await fetch(path);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

function ClubPicker({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col space-y-2">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
      >
        <option value="">Selecione...</option>
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}

function GameForm({ index, game, onChange }: {
  index: number; game: GameData;
  onChange: (field: keyof GameData, value: string) => void;
}) {
  const inputField = (key: keyof GameData, label: string, placeholder: string) => (
    <div className="flex flex-col space-y-2">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <input
        type="text"
        value={game[key]}
        placeholder={placeholder}
        onChange={(e) => onChange(key, e.target.value)}
        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Jogo {index + 1}</h3>
      </div>

      {/* Seção: Clubes */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-slate-500">Clubes</div>
        <div className="grid grid-cols-2 gap-3">
          <ClubPicker label="Mandante" value={game.homeId} onChange={(v) => onChange("homeId", v)} />
          <ClubPicker label="Visitante" value={game.awayId} onChange={(v) => onChange("awayId", v)} />
        </div>
      </div>

      {/* Seção: Data da partida */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-slate-500">Data da partida</div>
        <div className="grid grid-cols-4 gap-3">
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-slate-700">Dia</label>
            <select value={game.dia} onChange={(e) => onChange("dia", e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="">...</option>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {inputField("data", "Data", "17")}

          <div className="flex flex-col">
            <label className="text-sm font-semibold text-slate-700">Mês</label>
            <select value={game.mes} onChange={(e) => onChange("mes", e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="">...</option>
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {inputField("hora", "Hora", "19:00")}
        </div>
      </div>

      {/* Seção: Local */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-slate-500">Local</div>
        <div className="grid grid-cols-2 gap-3">
          {inputField("cidade", "Cidade", "MACEIÓ")}
          {inputField("estadio", "Estádio", "REI PELÉ")}
        </div>
      </div>
    </div>
  );
}

export function TemplateCollection() {
  const { folder } = useParams<{ folder: string }>();
  const [count, setCount] = useState(1);
  const [games, setGames] = useState<GameData[]>([{ ...EMPTY_GAME }]);
  const [svgResult, setSvgResult] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Batch (importação) ──────────────────────────────────────────────────
  const [batchQueue, setBatchQueue] = useState<GameData[][]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchExporting, setBatchExporting] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBatch = batchQueue.length > 0;

  useEffect(() => {
    if (!isBatch) {
      setGames((prev) => {
        const next = [...prev];
        while (next.length < count) next.push({ ...EMPTY_GAME });
        return next.slice(0, count);
      });
    }
  }, [count, isBatch]);

  const updateGame = useCallback((idx: number, field: keyof GameData, value: string) => {
    setGames((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, []);

  const findClub = (id: string): Club | undefined => clubs.find((c) => c.id === id);

  // ── Importar planilha ───────────────────────────────────────────────────
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await importSpreadsheet(file);
      setImportWarnings(result.warnings);

      if (result.games.length === 0) return;

      // Carregar config pra saber quantos jogos por arte
      const configRes = await fetch(`/templates/${folder}/config.json`);
      const config = await configRes.json();
      const maxGames = Math.max(...config.variants.map((v: { games: number }) => v.games));

      // Dividir em lotes de `maxGames` jogos cada
      const batches: GameData[][] = [];
      for (let i = 0; i < result.games.length; i += maxGames) {
        batches.push(result.games.slice(i, i + maxGames));
      }

      setBatchQueue(batches);
      setBatchIndex(0);
      setGames(batches[0]);
      setCount(batches[0].length);
      setSvgResult("");
    } catch (err) {
      setImportWarnings([`Erro ao ler planilha: ${err}`]);
    }

    // Limpa input pra permitir reimportar o mesmo arquivo
    e.target.value = "";
  }, [folder]);

  const goToBatch = useCallback((idx: number) => {
    if (idx < 0 || idx >= batchQueue.length) return;
    setBatchIndex(idx);
    setGames(batchQueue[idx]);
    setCount(batchQueue[idx].length);
    setSvgResult("");
  }, [batchQueue]);

  const clearBatch = useCallback(() => {
    setBatchQueue([]);
    setBatchIndex(0);
    setImportWarnings([]);
    setGames([{ ...EMPTY_GAME }]);
    setCount(1);
    setSvgResult("");
  }, []);

  // ── Gerar arte (1 lote) ─────────────────────────────────────────────────
  const generate = useCallback(async (gamesToUse?: GameData[]) => {
    const gamesForGen = gamesToUse ?? games;

    // Validação: pelo menos mandante e visitante preenchidos em cada jogo
    const incomplete = gamesForGen.findIndex((g) => !g.homeId || !g.awayId);
    if (incomplete >= 0) {
      toast.warning(`Jogo ${incomplete + 1}: selecione mandante e visitante.`);
      return "";
    }

    setLoading(true);
    try {
      const configRes = await fetch(`/templates/${folder}/config.json`);
      const config = await configRes.json();

      const effectiveCount = Math.min(gamesForGen.length, 4);
      const variant = config.variants.find(
        (v: { games: number }) => v.games === effectiveCount
      );
      if (!variant) { toast.error("Variante não encontrada para esse número de jogos."); return ""; }

      const svgRes = await fetch(`/templates/${folder}/${variant.file}`);
      const svgText = await svgRes.text();
      const doc = new SvgDocument(svgText);

      for (let i = 0; i < effectiveCount; i++) {
        const s = suffix(i);
        const g = gamesForGen[i];
        if (!g) continue;

        doc.setText(`txt_dia${s}`, g.dia);
        doc.setText(`txt_data${s}`, g.data);
        doc.setText(`txt_mes${s}`, `.${g.mes}`);
        doc.setText(`txt_hora${s}`, g.hora);
        doc.setText(`txt_cidade${s}`, g.cidade.toUpperCase());
        doc.setText(`txt_estadio${s}`, g.estadio.toUpperCase());

        const home = findClub(g.homeId);
        const away = findClub(g.awayId);

        if (home) {
          const uri = await imageToDataUri(home.shield);
          doc.setImage(`img_escudo_mandante${s}`, uri);
          // thumb-faftv usa img_mandante e img_mandante_2
          doc.setImage(`img_mandante${s}`, uri);
          doc.setImage(`img_mandante_2${s}`, uri);
        }
        if (away) {
          const uri = await imageToDataUri(away.shield);
          doc.setImage(`img_escudo_visitante${s}`, uri);
          doc.setImage(`img_visitante${s}`, uri);
        }
      }

      const result = doc.toString();
      setSvgResult(result);
      toast.success("Arte gerada com sucesso!");
      return result;
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar arte. Verifique os campos e tente novamente.");
      return "";
    } finally {
      setLoading(false);
    }
  }, [folder, games]);

  // ── Exportar PNG ────────────────────────────────────────────────────────
  const download = useCallback(async (svg?: string) => {
    const svgToExport = svg || svgResult;
    if (!svgToExport) return;
    try {
      // Detectar dimensões do SVG
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgToExport, "image/svg+xml");
      const svgEl = svgDoc.querySelector("svg");
      const w = parseInt(svgEl?.getAttribute("width") ?? "1080", 10);
      const h = parseInt(svgEl?.getAttribute("height") ?? "1350", 10);

      await exportToPng(svgToExport, w, h, `${folder}-${Date.now()}.png`);
      toast.success("PNG exportado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao exportar PNG. Tente gerar a arte novamente.");
    }
  }, [svgResult, folder]);

  // ── Exportar tudo (batch) ───────────────────────────────────────────────
  const exportAll = useCallback(async () => {
    if (batchQueue.length === 0) return;
    setBatchExporting(true);

    try {
      for (let i = 0; i < batchQueue.length; i++) {
        setBatchIndex(i);
        setGames(batchQueue[i]);
        setCount(batchQueue[i].length);

        const svg = await generate(batchQueue[i]);
        if (svg) {
          // Pequeno delay entre downloads pra browser não bloquear
          await new Promise((r) => setTimeout(r, 400));
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(svg, "image/svg+xml");
          const svgEl = svgDoc.querySelector("svg");
          const w = parseInt(svgEl?.getAttribute("width") ?? "1080", 10);
          const h = parseInt(svgEl?.getAttribute("height") ?? "1350", 10);
          await exportToPng(svg, w, h, `${folder}-${i + 1}-${Date.now()}.png`);
        }
      }
      toast.success(`${batchQueue.length} artes exportadas com sucesso!`);
    } catch (err) {
      console.error(err);
      toast.error("Erro no export em lote. Algumas artes podem não ter sido exportadas.");
    } finally {
      setBatchExporting(false);
    }
  }, [batchQueue, folder, generate]);

  return (
    <MainLayout>
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Cabeçalho */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900">Gerador de Arte</h1>
            <p className="mt-2 text-sm text-slate-600">Crie artes rapidamente preenchendo as informações dos jogos.</p>
          </div>

          <div className="grid grid-cols-12 gap-5">
            {/* Formulário - 4 colunas */}
            <div className="col-span-12 lg:col-span-4 space-y-5">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">

                {/* Importar planilha */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleImport}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 text-sm font-medium hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all"
                  >
                    <FileSpreadsheet size={16} />
                    <span>Importar Planilha (.csv / .xlsx)</span>
                  </button>
                </div>

                {/* Warnings da importação */}
                {importWarnings.length > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1">
                    {importWarnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-700">{w}</p>
                    ))}
                  </div>
                )}

                {/* Batch navigation */}
                {isBatch && (
                  <div className="flex items-center justify-between rounded-xl bg-violet-50 border border-violet-200 p-3">
                    <button
                      onClick={() => goToBatch(batchIndex - 1)}
                      disabled={batchIndex === 0}
                      className="p-1 rounded-lg hover:bg-violet-100 disabled:opacity-30"
                    >
                      <ChevronLeft size={18} className="text-violet-700" />
                    </button>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-violet-800">
                        Arte {batchIndex + 1} de {batchQueue.length}
                      </p>
                      <p className="text-xs text-violet-600">
                        {batchQueue.reduce((sum, b) => sum + b.length, 0)} jogos importados
                      </p>
                    </div>
                    <button
                      onClick={() => goToBatch(batchIndex + 1)}
                      disabled={batchIndex >= batchQueue.length - 1}
                      className="p-1 rounded-lg hover:bg-violet-100 disabled:opacity-30"
                    >
                      <ChevronRight size={18} className="text-violet-700" />
                    </button>
                  </div>
                )}

                {/* Quantos jogos (manual) */}
                {!isBatch && (
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Quantos jogos?</label>
                    <div className="mt-2">
                      <select
                        value={count}
                        onChange={(e) => setCount(Number(e.target.value))}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {games.map((g, i) => (
                    <div key={i}>
                      <GameForm index={i} game={g} onChange={(field, value) => updateGame(i, field, value)} />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => generate()}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-60"
                  >
                    <Image size={16} />
                    <span>{loading ? 'Gerando...' : 'Gerar Arte'}</span>
                  </button>

                  <button
                    onClick={() => download()}
                    disabled={!svgResult}
                    className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-white text-slate-700 border border-slate-200 font-semibold hover:shadow disabled:opacity-40"
                  >
                    <Download size={16} />
                    <span>Exportar PNG</span>
                  </button>
                </div>

                {/* Botões de lote */}
                {isBatch && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={exportAll}
                      disabled={batchExporting}
                      className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {batchExporting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Upload size={16} />
                      )}
                      <span>
                        {batchExporting
                          ? `Exportando...`
                          : `Exportar Tudo (${batchQueue.length})`}
                      </span>
                    </button>
                    <button
                      onClick={clearBatch}
                      className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-white text-slate-500 border border-slate-200 font-semibold hover:text-red-600 hover:border-red-300"
                    >
                      <span>Limpar Lote</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Preview - 8 colunas */}
            <div className="col-span-12 lg:col-span-8">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[600px] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Preview</h2>
                    <p className="text-sm text-slate-500">Visualize a arte gerada antes de exportar.</p>
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center">
                  {svgResult ? (
                    <div className="w-full h-full flex items-center justify-center overflow-auto">
                      <div className="max-w-[520px] w-full" dangerouslySetInnerHTML={{ __html: svgResult }} />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center text-slate-400 space-y-3">
                      <div className="w-40 h-32 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                        <Image size={36} className="text-slate-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">Sem preview disponível</p>
                        <p className="text-sm">Preencha os campos e clique em "Gerar Arte" para visualizar.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-end space-x-3">
                  <button
                    onClick={() => download()}
                    disabled={!svgResult}
                    className="flex items-center gap-2 h-12 px-4 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Download size={16} />
                    <span>Exportar PNG</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </MainLayout>
  );
}
