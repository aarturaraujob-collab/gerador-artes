import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

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

const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

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

export function ClubForm() {
  const { id: editingId } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const store = useDataStore();
  const isEditing = Boolean(editingId);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [loaded, setLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, editingId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleShieldUpload(file: File) {
    update("shield", await fileToDataUri(file));
  }

  const cityOptions = store.cities.map((city) => ({ value: city.id, label: city.name }));

  async function handleSave() {
    if (!form.fullName.trim()) {
      toast.error("Preencha o nome do clube.");
      return;
    }
    setSaving(true);
    try {
      const record: Club = {
        id: editingId ?? "",
        fullName: form.fullName.trim(),
        shortName: form.shortName.trim() || form.fullName.trim(),
        shield: form.shield,
        cityId: form.cityId || undefined,
        state: form.state || undefined,
        primaryColor: form.primaryColor || undefined,
        secondaryColor: form.secondaryColor || undefined,
        foundedYear: form.foundedYear ? Number(form.foundedYear) : null,
      };

      if (isEditing) {
        await dataStore.updateClub(editingId!, record);
      } else {
        const id = form.fullName.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
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
          <p className="text-sm text-foreground-muted">Clube não encontrado.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader title={isEditing ? "Editar Clube" : "Novo Clube"} />

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
              {form.shield && (
                <img src={form.shield} alt="" className="h-14 w-14 rounded-lg border border-border object-contain" />
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
