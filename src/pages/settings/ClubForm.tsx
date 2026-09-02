import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDataStore } from "@/hooks/useDataStore";
import { dataStore, type Club } from "@/modules/dataStore";
import { resolveClubShieldValue } from "@/engine/assets/AssetRepository";
import { assetRepository } from "@/engine";

const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const CURRENT_YEAR = new Date().getFullYear();

const clubFormSchema = z.object({
  fullName: z.string().trim().min(1, "Informe o nome do clube."),
  shortName: z.string().trim(),
  shield: z.string(),
  cityId: z.string(),
  state: z.enum(BRAZILIAN_STATES, { message: "Selecione uma UF válida." }),
  primaryColor: z.string().refine((value) => value === "" || HEX_COLOR_PATTERN.test(value), "Cor primária inválida."),
  secondaryColor: z
    .string()
    .refine((value) => value === "" || HEX_COLOR_PATTERN.test(value), "Cor secundária inválida."),
  foundedYear: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || (/^\d{4}$/.test(value) && Number(value) >= 1800 && Number(value) <= CURRENT_YEAR),
      `Ano de fundação deve ser um ano entre 1800 e ${CURRENT_YEAR}.`,
    ),
});

interface FormState {
  fullName: string;
  shortName: string;
  shield: string;
  cityId: string;
  state: string;
  primaryColor: string;
  secondaryColor: string;
  foundedYear: string;
}

function emptyForm(): FormState {
  return {
    fullName: "",
    shortName: "",
    shield: "",
    cityId: "",
    state: "AL",
    primaryColor: "#6B7280",
    secondaryColor: "#111827",
    foundedYear: "",
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

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/** Amostra os pixels do escudo (ignorando fundo transparente/quase-branco/quase-preto) e devolve as duas cores mais frequentes. */
async function extractDominantColors(dataUri: string): Promise<{ primary: string; secondary: string } | null> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Falha ao ler a imagem."));
    image.src = dataUri;
  });

  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, size, size);
  const pixels = ctx.getImageData(0, 0, size, size).data;

  const BUCKET = 24;
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    if (a < 128) continue;
    if (r > 235 && g > 235 && b > 235) continue;
    if (r < 20 && g < 20 && b < 20) continue;
    const key = [r, g, b].map((channel) => Math.round(channel / BUCKET) * BUCKET).join(",");
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }

  const sorted = [...buckets.values()]
    .map((bucket) => ({
      count: bucket.count,
      r: Math.round(bucket.r / bucket.count),
      g: Math.round(bucket.g / bucket.count),
      b: Math.round(bucket.b / bucket.count),
    }))
    .sort((a, b) => b.count - a.count);

  if (sorted.length === 0) return null;

  const primary = sorted[0];
  const secondary =
    sorted.find((candidate) => colorDistance([candidate.r, candidate.g, candidate.b], [primary.r, primary.g, primary.b]) > 60) ??
    sorted[1] ??
    primary;

  return { primary: toHex(primary.r, primary.g, primary.b), secondary: toHex(secondary.r, secondary.g, secondary.b) };
}

export function ClubForm() {
  const { id: editingId } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const store = useDataStore();
  const isEditing = Boolean(editingId);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [loaded, setLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing || loaded) return;
    // Clubes agora vêm do Supabase (Fase 1 da migração) — carregam
    // assincronamente, então esse efeito precisa reagir a `store.clubs`
    // preenchendo depois do primeiro render, não só na chegada da rota.
    // `loaded` no guard acima garante que só aplicamos uma vez.
    const existing = store.clubs.find((item) => item.id === editingId);
    if (existing) {
      setForm({
        fullName: existing.fullName,
        shortName: existing.shortName,
        shield: existing.shield,
        cityId: existing.cityId ?? "",
        state: existing.state ?? "AL",
        primaryColor: existing.primaryColor ?? "#6B7280",
        secondaryColor: existing.secondaryColor ?? "#111827",
        foundedYear: existing.foundedYear ? String(existing.foundedYear) : "",
      });
      setLoaded(true);
    }
  }, [isEditing, editingId, loaded, store.clubs]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleShieldUpload(file: File) {
    const dataUri = await fileToDataUri(file);
    const colors = await extractDominantColors(dataUri).catch(() => null);
    setForm((current) => ({
      ...current,
      shield: dataUri,
      ...(colors ? { primaryColor: colors.primary, secondaryColor: colors.secondary } : {}),
    }));
  }

  const cityOptions = store.cities.map((city) => ({ value: city.id, label: city.name }));

  // Um clube sem `shield` salvo ainda pode ter um escudo visível em todo o
  // resto do app via convenção de nome de arquivo (ver AssetRepository.clubShieldPath) —
  // o preview aqui precisa cair no mesmo fallback, não só no valor bruto do form.
  const shieldPreview = form.shield ? resolveClubShieldValue(form.shield) : editingId ? assetRepository.clubShieldPath(editingId) : null;

  async function handleSave() {
    const result = clubFormSchema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Verifique os campos do formulário.");
      return;
    }

    setSaving(true);
    try {
      const record: Club = {
        id: editingId ?? "",
        fullName: result.data.fullName,
        shortName: result.data.shortName || result.data.fullName,
        shield: result.data.shield,
        cityId: result.data.cityId || undefined,
        state: result.data.state || undefined,
        primaryColor: result.data.primaryColor || undefined,
        secondaryColor: result.data.secondaryColor || undefined,
        foundedYear: result.data.foundedYear ? Number(result.data.foundedYear) : null,
      };

      if (isEditing) {
        await dataStore.updateClub(editingId!, record);
      } else {
        const id = result.data.fullName.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        if (store.clubs.some((item) => item.id === id)) {
          toast.error("Já existe um clube com esse nome.");
          setSaving(false);
          return;
        }
        await dataStore.createClub({ ...record, id });
      }

      toast.success("Clube salvo.");
      navigate("/cadastros/clubes");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar clube.");
    } finally {
      setSaving(false);
    }
  }

  if (isEditing && !loaded) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl">
          {store.loadingRegistry ? (
            <div className="flex items-center gap-2 text-sm text-foreground-muted">
              <Spinner /> Carregando…
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">Clube não encontrado.</p>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader hero title={isEditing ? "Editar Clube" : "Novo Clube"} />

        <Card className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">Nome</label>
              <Input
                value={form.fullName}
                onChange={(event) => update("fullName", event.target.value)}
                placeholder="Centro Sportivo Alagoano"
                className="mt-2 h-11"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">Apelido</label>
              <Input
                value={form.shortName}
                onChange={(event) => update("shortName", event.target.value)}
                placeholder="CSA"
                className="mt-2 h-11"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">Cidade</label>
              <Combobox
                className="mt-2 h-11"
                options={cityOptions}
                value={form.cityId || undefined}
                onValueChange={(value) => update("cityId", value)}
                placeholder="Selecione a cidade"
                searchPlaceholder="Buscar cidade..."
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">UF</label>
              <Select value={form.state} onValueChange={(value) => update("state", value)}>
                <SelectTrigger className="mt-2 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_STATES.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">Cor Primária</label>
              <div className="mt-2 flex h-11 items-center gap-2 rounded-md border border-input px-3">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(event) => update("primaryColor", event.target.value)}
                  className="h-6 w-8 shrink-0 cursor-pointer border-0 bg-transparent p-0"
                />
                <span className="text-sm text-foreground-secondary">{form.primaryColor}</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">Cor Secundária</label>
              <div className="mt-2 flex h-11 items-center gap-2 rounded-md border border-input px-3">
                <input
                  type="color"
                  value={form.secondaryColor}
                  onChange={(event) => update("secondaryColor", event.target.value)}
                  className="h-6 w-8 shrink-0 cursor-pointer border-0 bg-transparent p-0"
                />
                <span className="text-sm text-foreground-secondary">{form.secondaryColor}</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">Fundação</label>
              <Input
                type="number"
                value={form.foundedYear}
                onChange={(event) => update("foundedYear", event.target.value)}
                placeholder="1913"
                className="mt-2 h-11"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground-secondary">Escudo</label>
            <div className="mt-2 flex items-center gap-3">
              {shieldPreview && (
                <img
                  src={shieldPreview}
                  alt=""
                  className="h-14 w-14 rounded-lg border border-border object-contain"
                  onError={(event) => {
                    event.currentTarget.style.visibility = "hidden";
                  }}
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleShieldUpload(file);
                }}
                className="block w-full text-sm text-foreground-secondary"
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => navigate("/cadastros/clubes")}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving && <Spinner />}
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
