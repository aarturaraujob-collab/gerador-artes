import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDataStore } from "@/hooks/useDataStore";
import { dataStore, type OperationalStaff, type StaffArea } from "@/modules/dataStore";
import { rolesForArea } from "@/modules/operationalStaffRepository";

interface OperationalStaffFormProps {
  area: StaffArea;
}

function basePath(area: StaffArea): string {
  return area === "FAFTV" ? "/cadastros/faftv" : "/cadastros/oficiais-dco";
}

interface FormState {
  name: string;
  photo: string;
  cpf: string;
  phone: string;
  address: string;
  role: string;
}

function emptyForm(area: StaffArea): FormState {
  return { name: "", photo: "", cpf: "", phone: "", address: "", role: rolesForArea(area)[0] };
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function slugifyId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function OperationalStaffForm({ area }: OperationalStaffFormProps) {
  const { id: editingId } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const store = useDataStore();
  const isEditing = Boolean(editingId);
  const base = basePath(area);
  const roles = rolesForArea(area);

  const [form, setForm] = useState<FormState>(emptyForm(area));
  const [loaded, setLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    const existing = store.staff.find((item) => item.id === editingId);
    if (existing) {
      setForm({
        name: existing.name,
        photo: existing.photo ?? "",
        cpf: existing.cpf ?? "",
        phone: existing.phone ?? "",
        address: existing.address ?? "",
        role: existing.role,
      });
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, editingId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handlePhotoUpload(file: File) {
    update("photo", await fileToDataUri(file));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Preencha o nome.");
      return;
    }
    setSaving(true);
    try {
      const record: OperationalStaff = {
        id: editingId ?? "",
        name: form.name.trim(),
        photo: form.photo || undefined,
        cpf: form.cpf.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        role: form.role,
        area,
      };

      if (isEditing) {
        await dataStore.updateStaff(editingId!, record);
      } else {
        const id = slugifyId(form.name);
        if (store.staff.some((item) => item.id === id)) {
          toast.error("Já existe uma pessoa com esse nome.");
          setSaving(false);
          return;
        }
        await dataStore.createStaff({ ...record, id });
      }

      toast.success("Registro salvo.");
      navigate(base);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar registro.");
    } finally {
      setSaving(false);
    }
  }

  if (isEditing && !loaded) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-foreground-muted">Registro não encontrado.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader title={isEditing ? "Editar Pessoa" : "Nova Pessoa"} />

        <Card className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">Nome</label>
              <Input
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="Nome completo"
                className="mt-2 h-11"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">Função</label>
              <Select value={form.role} onValueChange={(value) => update("role", value)}>
                <SelectTrigger className="mt-2 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">CPF</label>
              <Input
                value={form.cpf}
                onChange={(event) => update("cpf", event.target.value)}
                placeholder="000.000.000-00"
                className="mt-2 h-11"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">Telefone</label>
              <Input
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="(82) 90000-0000"
                className="mt-2 h-11"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground-secondary">Endereço</label>
            <Input
              value={form.address}
              onChange={(event) => update("address", event.target.value)}
              placeholder="Rua, número, bairro"
              className="mt-2 h-11"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground-secondary">Foto</label>
            <div className="mt-2 flex items-center gap-3">
              {form.photo && (
                <img src={form.photo} alt="" className="h-14 w-14 rounded-full border border-border object-cover" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handlePhotoUpload(file);
                }}
                className="block w-full text-sm text-foreground-secondary"
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => navigate(base)}>
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
