import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useDataStore } from "@/hooks/useDataStore";
import { dataStore, type City } from "@/modules/dataStore";

interface FormState {
  name: string;
  state: string;
}

function emptyForm(): FormState {
  return { name: "", state: "" };
}

export function CityForm() {
  const { id: editingId } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const store = useDataStore();
  const isEditing = Boolean(editingId);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [loaded, setLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    const existing = store.cities.find((item) => item.id === editingId);
    if (existing) {
      setForm({ name: existing.name, state: existing.state ?? "" });
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, editingId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Preencha o nome da cidade.");
      return;
    }
    setSaving(true);
    try {
      const record: City = {
        id: editingId ?? "",
        name: form.name.trim(),
        state: form.state.trim().toUpperCase() || undefined,
      };

      if (isEditing) {
        await dataStore.updateCity(editingId!, record);
      } else {
        const id = form.name.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        if (store.cities.some((item) => item.id === id)) {
          toast.error("Já existe uma cidade com esse nome.");
          setSaving(false);
          return;
        }
        await dataStore.createCity({ ...record, id });
      }

      toast.success("Cidade salva.");
      navigate("/cadastros/cidades");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar cidade.");
    } finally {
      setSaving(false);
    }
  }

  if (isEditing && !loaded) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-foreground-muted">Cidade não encontrada.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader title={isEditing ? "Editar Cidade" : "Nova Cidade"} />

        <Card className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">Nome</label>
              <Input
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="Maceió"
                className="mt-2 h-11"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">UF</label>
              <Input
                value={form.state}
                onChange={(event) => update("state", event.target.value.slice(0, 2))}
                placeholder="AL"
                className="mt-2 h-11 w-20 uppercase"
                maxLength={2}
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => navigate("/cadastros/cidades")}>
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
