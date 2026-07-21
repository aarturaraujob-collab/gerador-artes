import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { MainLayout } from "@/components/layout/MainLayout";
import { templates as templateRegistry } from "@/components/templates/templates";
import { useDataStore } from "@/hooks/useDataStore";
import { dataStore, type BackgroundAssets, type CompetitionRecord, type ExtractedRow } from "@/modules/dataStore";
import { spreadsheetImporter } from "@/engine";
import { emptyBackground } from "@/modules/competitionRepository";

const STEP_LABELS = ["Dados", "Assets", "Importação", "Templates", "Resumo"];

interface FormState {
  id: string;
  name: string;
  season: number;
  category: string;
  gender: string;
  ageGroup: string;
  logo: string;
  background: BackgroundAssets;
  templates: string[];
}

function emptyForm(): FormState {
  return {
    id: "",
    name: "",
    season: new Date().getFullYear(),
    category: "",
    gender: "",
    ageGroup: "",
    logo: "",
    background: emptyBackground(),
    templates: [],
  };
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function inputClass(disabled?: boolean) {
  return `mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm ${disabled ? "cursor-not-allowed bg-slate-50 text-slate-400" : ""}`;
}

export function CompetitionWizard() {
  const { id: editingId } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const store = useDataStore();
  const isEditing = Boolean(editingId);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loaded, setLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);

  const [importFileName, setImportFileName] = useState("");
  const [importPreview, setImportPreview] = useState<{ rows: ExtractedRow[]; valid: number; invalid: number } | null>(null);
  const [importConfirmed, setImportConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    const existing = store.competitions.find((item) => item.id === editingId);
    if (existing) {
      setForm({
        id: existing.id,
        name: existing.name,
        season: existing.season,
        category: existing.category,
        gender: existing.gender,
        ageGroup: existing.ageGroup,
        logo: existing.logo,
        background: existing.background,
        templates: existing.templates,
      });
      setLoaded(true);
    }
    // Only sync from the store once, on arrival — further edits are local until saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, editingId]);

  const existingMatchCount = form.id ? store.matches.filter((match) => match.competitionId === form.id).length : 0;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function canAdvanceFromStep1(): boolean {
    return form.id.trim().length > 0 && form.name.trim().length > 0;
  }

  function goNext() {
    if (step === 1 && !canAdvanceFromStep1()) {
      toast.error("Preencha ao menos Nome e ID para continuar.");
      return;
    }
    setStep((current) => Math.min(5, current + 1));
  }

  function goBack() {
    setStep((current) => Math.max(1, current - 1));
  }

  async function handleAssetUpload(file: File, target: "logo" | "thumb") {
    const dataUri = await fileToDataUri(file);
    if (target === "logo") update("logo", dataUri);
    else update("background", { ...form.background, thumb: dataUri });
  }

  async function handleImportFile(file: File) {
    setImportFileName(file.name);
    setImportConfirmed(false);
    try {
      const parsed = await spreadsheetImporter.parse(file);
      setImportPreview({ rows: parsed.rows, valid: parsed.validCount, invalid: parsed.invalidCount });
    } catch (error) {
      setImportPreview(null);
      toast.error(error instanceof Error ? error.message : "Falha ao ler a planilha.");
    }
  }

  async function confirmImport() {
    if (!importPreview || !form.id) return;
    setImporting(true);
    try {
      const { count } = dataStore.importMatchesForCompetition(form.id, importPreview.rows);
      setImportConfirmed(true);
      toast.success(`${count} jogo(s) importado(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar planilha.");
    } finally {
      setImporting(false);
    }
  }

  function toggleTemplate(templateId: string) {
    setForm((current) => ({
      ...current,
      templates: current.templates.includes(templateId)
        ? current.templates.filter((id) => id !== templateId)
        : [...current.templates, templateId],
    }));
  }

  async function finish() {
    setSaving(true);
    try {
      const record: CompetitionRecord = {
        id: form.id.trim().toUpperCase(),
        name: form.name.trim(),
        season: form.season,
        category: form.category,
        gender: form.gender,
        ageGroup: form.ageGroup,
        logo: form.logo,
        background: form.background,
        templates: form.templates,
        active: true,
      };

      if (isEditing) {
        await dataStore.updateCompetition(editingId!, record);
      } else {
        if (store.competitions.some((item) => item.id === record.id)) {
          toast.error(`Já existe uma competição com o ID "${record.id}".`);
          setSaving(false);
          return;
        }
        await dataStore.createCompetition(record);
      }

      toast.success("Competição salva.");
      navigate("/cadastros/competicoes");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar competição.");
    } finally {
      setSaving(false);
    }
  }

  const summaryMatches = form.id ? store.matches.filter((match) => match.competitionId === form.id) : [];
  const summaryClubs = new Set(summaryMatches.flatMap((match) => [match.homeClubId, match.awayClubId]));
  const summaryRounds = new Set(summaryMatches.map((match) => match.round).filter(Boolean));

  if (isEditing && !loaded) {
    return (
      <MainLayout>
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-slate-500">Competição não encontrada.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">{isEditing ? "Editar Competição" : "Nova Competição"}</h1>
          <p className="mt-2 text-sm text-slate-600">Cadastro guiado em 5 etapas — nada precisa ser editado por fora daqui.</p>
        </header>

        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {STEP_LABELS.map((label, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === step;
            const isDone = stepNumber < step;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    isActive
                      ? "bg-violet-600 text-white"
                      : isDone
                        ? "bg-violet-100 text-violet-700"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isDone ? <Check size={14} /> : stepNumber}
                </span>
                <span className={isActive ? "font-semibold text-slate-800" : "text-slate-500"}>{label}</span>
                {stepNumber < STEP_LABELS.length && <span className="mx-1 text-slate-300">—</span>}
              </li>
            );
          })}
        </ol>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Nome</label>
                  <input
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    placeholder="Alagoano Sub-20 Série A1"
                    className={inputClass()}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">ID</label>
                  <input
                    value={form.id}
                    disabled={isEditing}
                    onChange={(event) => update("id", event.target.value.toUpperCase())}
                    placeholder="ALAGOANO20A1"
                    className={inputClass(isEditing)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Temporada</label>
                  <input
                    type="number"
                    value={form.season}
                    onChange={(event) => update("season", Number(event.target.value))}
                    className={inputClass()}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Categoria</label>
                  <input
                    value={form.category}
                    onChange={(event) => update("category", event.target.value)}
                    placeholder="Base, Profissional…"
                    className={inputClass()}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Faixa etária</label>
                  <input
                    value={form.ageGroup}
                    onChange={(event) => update("ageGroup", event.target.value)}
                    placeholder="Sub-20"
                    className={inputClass()}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Sexo</label>
                <select value={form.gender} onChange={(event) => update("gender", event.target.value)} className={inputClass()}>
                  <option value="">Selecione</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Misto">Misto</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <AssetUploadField
                  label="Logo"
                  hint="public/assets/logos"
                  value={form.logo}
                  onFile={(file) => void handleAssetUpload(file, "logo")}
                />
                <AssetUploadField
                  label="Background Thumb"
                  hint="public/assets/backgrounds"
                  value={form.background.thumb}
                  onFile={(file) => void handleAssetUpload(file, "thumb")}
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">Assets futuros</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {["Story", "Feed", "Marca d'água"].map((label) => (
                    <div key={label} className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
                      {label}
                      <p className="mt-1 text-xs">Em breve</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Planilha (CSV ou XLSX)</label>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleImportFile(file);
                  }}
                  className="mt-2 block w-full text-sm text-slate-600"
                />
                {importFileName && <p className="mt-1 text-xs text-slate-500">Arquivo: {importFileName}</p>}
              </div>

              {importPreview && (
                <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{importPreview.valid}</p>
                      <p className="text-xs text-slate-500">jogos válidos</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-600">{importPreview.invalid}</p>
                      <p className="text-xs text-slate-500">erros encontrados</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{existingMatchCount}</p>
                      <p className="text-xs text-slate-500">jogo(s) existentes que serão substituídos</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void confirmImport()}
                    disabled={importing || importConfirmed || !form.id}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {importConfirmed ? "Importação confirmada" : importing ? "Importando…" : "Confirmar importação"}
                  </button>
                  {!form.id && <p className="text-center text-xs text-red-500">Defina o ID da competição na Etapa 1 antes de importar.</p>}
                </div>
              )}

              {!importPreview && (
                <p className="text-sm text-slate-500">
                  {existingMatchCount > 0
                    ? `Esta competição já possui ${existingMatchCount} jogo(s) cadastrados. Envie uma planilha apenas se quiser substituí-los.`
                    : "Envie uma planilha para importar jogos, rodadas e clubes automaticamente."}
                </p>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Marque os templates disponíveis para esta competição.</p>
              {templateRegistry.map((template) => (
                <label
                  key={template.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={form.templates.includes(template.id)}
                    onChange={() => toggleTemplate(template.id)}
                    className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  {template.name}
                </label>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <SummaryPreview label="Logo" src={form.logo} />
                <SummaryPreview label="Background" src={form.background.thumb} />
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 text-center text-sm">
                <div>
                  <p className="text-2xl font-bold text-slate-900">{summaryMatches.length}</p>
                  <p className="text-xs text-slate-500">jogos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{summaryClubs.size}</p>
                  <p className="text-xs text-slate-500">clubes</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{summaryRounds.size}</p>
                  <p className="text-xs text-slate-500">rodadas</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700">Templates habilitados</p>
                <p className="mt-1 text-sm text-slate-600">
                  {form.templates.length > 0
                    ? form.templates.map((id) => templateRegistry.find((t) => t.id === id)?.name ?? id).join(", ")
                    : "Nenhum selecionado"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void finish()}
                disabled={saving}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Salvando…" : "Finalizar Cadastro"}
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 1}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Voltar
          </button>
          {step < 5 && (
            <button
              type="button"
              onClick={goNext}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Avançar
            </button>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

function AssetUploadField({
  label,
  hint,
  value,
  onFile,
}: {
  label: string;
  hint: string;
  value: string;
  onFile: (file: File) => void;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <p className="text-xs text-slate-400">{hint}</p>
      <div className="mt-2 flex items-center gap-3">
        {value && <img src={value} alt="" className="h-14 w-14 rounded-lg border border-slate-200 object-cover" />}
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
          }}
          className="block w-full text-sm text-slate-600"
        />
      </div>
    </div>
  );
}

function SummaryPreview({ label, src }: { label: string; src: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <div className="mt-2 flex h-32 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {src ? <img src={src} alt={label} className="h-full w-full object-cover" /> : <span className="text-xs text-slate-400">Sem imagem</span>}
      </div>
    </div>
  );
}
