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
import { dataStore, type Stadium } from "@/modules/dataStore";

const TURF_TYPES = ["Natural", "Sintético", "Híbrido"];

interface FormState {
  name: string;
  cityId: string;
  capacity: string;
  turfType: string;
  image: string;
}

function emptyForm(): FormState {
  return { name: "", cityId: "", capacity: "", turfType: "", image: "" };
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function StadiumForm() {
  const { id: editingId } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const store = useDataStore();
  const isEditing = Boolean(editingId);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [loaded, setLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    const existing = store.stadiums.find((item) => item.id === editingId);
    if (existing) {
      setForm({
        name: existing.name,
        cityId: existing.cityId,
        capacity: existing.capacity ? String(existing.capacity) : "",
        turfType: existing.turfType ?? "",
        image: existing.image ?? "",
      });
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, editingId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleImageUpload(file: File) {
    update("image", await fileToDataUri(file));
  }

  const cityOptions = store.cities.map((city) => ({ value: city.id, label: city.name }));

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Preencha o nome do estádio.");
      return;
    }
    setSaving(true);
    try {
      const record: Stadium = {
        id: editingId ?? "",
        name: form.name.trim(),
        cityId: form.cityId,
        capacity: form.capacity ? Number(form.capacity) : null,
        turfType: form.turfType || undefined,
        image: form.image || undefined,
      };

      if (isEditing) {
        await dataStore.updateStadium(editingId!, record);
      } else {
        const id = form.name.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        if (store.stadiums.some((item) => item.id === id)) {
          toast.error("Já existe um estádio com esse nome.");
          setSaving(false);
          return;
        }
        await dataStore.createStadium({ ...record, id });
      }

      toast.success("Estádio salvo.");
      navigate("/cadastros/estadios");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar estádio.");
    } finally {
      setSaving(false);
    }
  }

  if (isEditing && !loaded) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-foreground-muted">Estádio não encontrado.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader title={isEditing ? "Editar Estádio" : "Novo Estádio"} />

        <Card className="space-y-4 p-6">
          <div>
            <label className="text-sm font-semibold text-foreground-secondary">Nome</label>
            <Input
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Rei Pelé"
              className="mt-2 h-11"
            />
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
              <label className="text-sm font-semibold text-foreground-secondary">Capacidade</label>
              <Input
                type="number"
                value={form.capacity}
                onChange={(event) => update("capacity", event.target.value)}
                placeholder="18000"
                className="mt-2 h-11"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground-secondary">Tipo de gramado</label>
            <Select value={form.turfType || undefined} onValueChange={(value) => update("turfType", value)}>
              <SelectTrigger className="mt-2 h-11">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {TURF_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground-secondary">Imagem</label>
            <div className="mt-2 flex items-center gap-3">
              {form.image && (
                <img src={form.image} alt="" className="h-14 w-20 rounded-lg border border-border object-cover" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImageUpload(file);
                }}
                className="block w-full text-sm text-foreground-secondary"
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => navigate("/cadastros/estadios")}>
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
