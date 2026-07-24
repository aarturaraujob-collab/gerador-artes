import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Combobox } from "@/components/ui/combobox";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { templates as templateRegistry } from "@/templates/templates";
import { useDataStore } from "@/hooks/useDataStore";
import { dataStore, type BackgroundAssets, type CompetitionRecord, type ExtractedRow } from "@/modules/dataStore";
import { assetRepository, spreadsheetImporter } from "@/engine";
import { emptyBackground } from "@/modules/competitionRepository";
import { groupCompetitionsBySeries } from "@/modules/competitionSeries";
import { detectUnmatchedEntities, hasUnmatchedEntities, type UnmatchedEntities } from "@/modules/importPreview";
import { UnmatchedEntitiesDialog } from "@/components/import/UnmatchedEntitiesDialog";
import { backgroundRepository, type BackgroundAsset } from "@/modules/backgroundRepository";

const STEP_LABELS = ["Dados", "Assets", "Importação", "Templates", "Resumo"];

const CATEGORY_OPTIONS = ["Profissional", "Base", "Amador", "Universitário"] as const;
const AGE_GROUP_OPTIONS = ["Livre", "Sub-13", "Sub-15", "Sub-17", "Sub-20", "Máster"] as const;
const GENDER_OPTIONS = ["Masculino", "Feminino", "Misto"] as const;

function seasonYearOptions(currentSeason: number): number[] {
  const currentYear = new Date().getFullYear();
  const years = new Set([currentSeason, currentYear]);
  for (let year = currentYear - 1; year <= currentYear + 4; year += 1) years.add(year);
  return [...years].sort((a, b) => a - b);
}

interface FormState {
  id: string;
  seriesId: string;
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
    seriesId: "",
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

const competitionFormSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Informe o ID da competição.")
    .regex(/^[A-Za-z0-9_-]+$/, "O ID deve conter apenas letras, números, hífen ou underscore."),
  seriesId: z.string(),
  name: z.string().trim().min(1, "Informe o nome da competição."),
  season: z
    .number()
    .int("A temporada deve ser um ano válido.")
    .min(1900, "A temporada deve ser um ano válido.")
    .max(2100, "A temporada deve ser um ano válido."),
  category: z
    .string()
    .refine(
      (value) => value === "" || CATEGORY_OPTIONS.includes(value as (typeof CATEGORY_OPTIONS)[number]),
      "Categoria inválida.",
    ),
  gender: z
    .string()
    .refine(
      (value) => value === "" || GENDER_OPTIONS.includes(value as (typeof GENDER_OPTIONS)[number]),
      "Sexo inválido.",
    ),
  ageGroup: z
    .string()
    .refine(
      (value) => value === "" || AGE_GROUP_OPTIONS.includes(value as (typeof AGE_GROUP_OPTIONS)[number]),
      "Faixa etária inválida.",
    ),
});

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
  const [pendingUnmatched, setPendingUnmatched] = useState<UnmatchedEntities | null>(null);
  const [backgroundLibrary, setBackgroundLibrary] = useState<BackgroundAsset[]>([]);

  useEffect(() => {
    void backgroundRepository.seedIfEmpty().then(setBackgroundLibrary);
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    const existing = store.competitions.find((item) => item.id === editingId);
    if (existing) {
      setForm({
        id: existing.id,
        seriesId: existing.seriesId ?? "",
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
  const seriesOptions = groupCompetitionsBySeries(store.competitions).map((group) => ({
    value: group.seriesId,
    label: group.name,
  }));
  const templateOptions = templateRegistry.map((template) => ({ value: template.id, label: template.name }));

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
    const unmatched = detectUnmatchedEntities(store, importPreview.rows);
    if (hasUnmatchedEntities(unmatched)) {
      setPendingUnmatched(unmatched);
      return;
    }
    await runImport();
  }

  async function runImport() {
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

  async function finish() {
    const result = competitionFormSchema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Verifique os campos da competição.");
      return;
    }

    setSaving(true);
    try {
      const record: CompetitionRecord = {
        id: result.data.id.toUpperCase(),
        seriesId: result.data.seriesId.trim() || undefined,
        name: result.data.name,
        season: result.data.season,
        category: result.data.category,
        gender: result.data.gender,
        ageGroup: result.data.ageGroup,
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
      <AppShell>
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-foreground-muted">Competição não encontrada.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title={isEditing ? "Editar Competição" : "Nova Competição"}
          description="Cadastro guiado em 5 etapas — nada precisa ser editado por fora daqui."
        />

        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {STEP_LABELS.map((label, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === step;
            const isDone = stepNumber < step;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-success/10 text-success-solid"
                        : "bg-muted text-foreground-muted",
                  )}
                >
                  {isDone ? <Check size={14} /> : stepNumber}
                </span>
                <span className={isActive ? "font-semibold text-foreground" : "text-foreground-muted"}>{label}</span>
                {stepNumber < STEP_LABELS.length && <span className="mx-1 text-foreground-muted">—</span>}
              </li>
            );
          })}
        </ol>

        <Card className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-foreground-secondary">Nome</label>
                  <Input
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    placeholder="Alagoano Sub-20 Série A1"
                    className="mt-2 h-11"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground-secondary">ID</label>
                  <Input
                    value={form.id}
                    disabled={isEditing}
                    onChange={(event) => update("id", event.target.value.toUpperCase())}
                    placeholder="ALAGOANO20A1"
                    className="mt-2 h-11"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground-secondary">Série</label>
                <Combobox
                  className="mt-2 h-11"
                  options={seriesOptions}
                  value={form.seriesId || undefined}
                  onValueChange={(value) => update("seriesId", value)}
                  placeholder="Nova série (a partir do nome)"
                  searchPlaceholder="Buscar série existente..."
                  emptyText="Nenhuma série encontrada — deixe em branco para criar uma nova a partir do nome."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-semibold text-foreground-secondary">Temporada</label>
                  <Select
                    value={String(form.season)}
                    onValueChange={(value) => update("season", Number(value))}
                  >
                    <SelectTrigger className="mt-2 h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {seasonYearOptions(form.season).map((year) => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground-secondary">Categoria</label>
                  <Select value={form.category || undefined} onValueChange={(value) => update("category", value)}>
                    <SelectTrigger className="mt-2 h-11">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground-secondary">Faixa etária</label>
                  <Select value={form.ageGroup || undefined} onValueChange={(value) => update("ageGroup", value)}>
                    <SelectTrigger className="mt-2 h-11">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {AGE_GROUP_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground-secondary">Sexo</label>
                <Select value={form.gender || undefined} onValueChange={(value) => update("gender", value)}>
                  <SelectTrigger className="mt-2 h-11">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                    <SelectItem value="Misto">Misto</SelectItem>
                  </SelectContent>
                </Select>
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
                <div>
                  <AssetUploadField
                    label="Background Thumb"
                    hint="public/assets/backgrounds"
                    value={form.background.thumb}
                    onFile={(file) => void handleAssetUpload(file, "thumb")}
                  />
                  <div className="mt-2">
                    <Combobox
                      className="h-10"
                      options={backgroundLibrary.map((asset) => ({ value: asset.id, label: asset.name }))}
                      value={undefined}
                      onValueChange={(id) => {
                        const asset = backgroundLibrary.find((item) => item.id === id);
                        if (!asset) return;
                        update("background", { ...form.background, thumb: assetRepository.backgroundPath(asset.dataUri) });
                      }}
                      placeholder="Ou escolher da biblioteca"
                      searchPlaceholder="Buscar background..."
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-foreground-secondary">Assets futuros</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {["Story", "Feed", "Marca d'água"].map((label) => (
                    <div key={label} className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-foreground-muted">
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
                <label className="text-sm font-semibold text-foreground-secondary">Planilha (CSV ou XLSX)</label>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleImportFile(file);
                  }}
                  className="mt-2 block w-full text-sm text-foreground-secondary"
                />
                {importFileName && <p className="mt-1 text-xs text-foreground-muted">Arquivo: {importFileName}</p>}
              </div>

              {importPreview && (
                <div className="space-y-3 rounded-xl bg-muted p-4 text-sm">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-2xl font-bold text-foreground">{importPreview.valid}</p>
                      <p className="text-xs text-foreground-muted">jogos válidos</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-warning-solid">{importPreview.invalid}</p>
                      <p className="text-xs text-foreground-muted">erros encontrados</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-danger-solid">{existingMatchCount}</p>
                      <p className="text-xs text-foreground-muted">jogo(s) existentes que serão substituídos</p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => void confirmImport()}
                    disabled={importing || importConfirmed || !form.id}
                    className="w-full"
                  >
                    {importing && <Spinner />}
                    {importConfirmed ? "Importação confirmada" : importing ? "Importando…" : "Confirmar importação"}
                  </Button>
                  {!form.id && <p className="text-center text-xs text-danger-solid">Defina o ID da competição na Etapa 1 antes de importar.</p>}
                </div>
              )}

              {!importPreview && (
                <p className="text-sm text-foreground-secondary">
                  {existingMatchCount > 0
                    ? `Esta competição já possui ${existingMatchCount} jogo(s) cadastrados. Envie uma planilha apenas se quiser substituí-los.`
                    : "Envie uma planilha para importar jogos, rodadas e clubes automaticamente."}
                </p>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-foreground-secondary">Escolha os templates disponíveis para esta competição.</p>
              <MultiSelect
                options={templateOptions}
                value={form.templates}
                onValueChange={(value) => update("templates", value)}
                placeholder="Selecione um ou mais templates"
                searchPlaceholder="Buscar template..."
              />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <SummaryPreview label="Logo" src={form.logo} />
                <SummaryPreview label="Background" src={form.background.thumb} />
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted p-4 text-center text-sm">
                <div>
                  <p className="text-2xl font-bold text-foreground">{summaryMatches.length}</p>
                  <p className="text-xs text-foreground-muted">jogos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{summaryClubs.size}</p>
                  <p className="text-xs text-foreground-muted">clubes</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{summaryRounds.size}</p>
                  <p className="text-xs text-foreground-muted">rodadas</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground-secondary">Templates habilitados</p>
                <p className="mt-1 text-sm text-foreground-secondary">
                  {form.templates.length > 0
                    ? form.templates.map((id) => templateRegistry.find((t) => t.id === id)?.name ?? id).join(", ")
                    : "Nenhum selecionado"}
                </p>
              </div>

              <Button
                type="button"
                variant="success"
                onClick={() => void finish()}
                disabled={saving}
                className="w-full"
              >
                {saving && <Spinner />}
                {saving ? "Salvando…" : "Finalizar Cadastro"}
              </Button>
            </div>
          )}
        </Card>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={goBack} disabled={step === 1}>
            Voltar
          </Button>
          {step < 5 && (
            <Button type="button" onClick={goNext}>
              Avançar
            </Button>
          )}
        </div>
      </div>

      <UnmatchedEntitiesDialog
        open={pendingUnmatched !== null}
        entities={pendingUnmatched}
        onCancel={() => setPendingUnmatched(null)}
        onConfirm={() => {
          setPendingUnmatched(null);
          void runImport();
        }}
      />
    </AppShell>
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
      <label className="text-sm font-semibold text-foreground-secondary">{label}</label>
      <p className="text-xs text-foreground-muted">{hint}</p>
      <div className="mt-2 flex items-center gap-3">
        {value && <img src={value} alt="" className="h-14 w-14 rounded-lg border border-border object-cover" />}
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
          }}
          className="block w-full text-sm text-foreground-secondary"
        />
      </div>
    </div>
  );
}

function SummaryPreview({ label, src }: { label: string; src: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-foreground-secondary">{label}</p>
      <div className="mt-2 flex h-32 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
        {src ? <img src={src} alt={label} className="h-full w-full object-cover" /> : <span className="text-xs text-foreground-muted">Sem imagem</span>}
      </div>
    </div>
  );
}
