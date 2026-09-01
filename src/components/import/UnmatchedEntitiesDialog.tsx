import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import type { UnmatchedEntities, EntityAliases } from "@/modules/importPreview";
import { emptyEntityAliases } from "@/modules/importPreview";
import type { DataStore } from "@/modules/dataStore";

export interface UnmatchedEntitiesDialogProps {
  open: boolean;
  entities: UnmatchedEntities | null;
  store: DataStore;
  onCancel: () => void;
  onConfirm: (aliases: EntityAliases) => void;
}

const NEW_RECORD = "__novo__";

interface EntityRowProps {
  name: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
}

function EntityRow({ name, options, value, onChange }: EntityRowProps) {
  const comboOptions: ComboboxOption[] = [{ value: NEW_RECORD, label: "Cadastrar novo" }, ...options];
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5">
      <span className="text-sm font-medium text-foreground">{name}</span>
      <Combobox
        options={comboOptions}
        value={value}
        onValueChange={onChange}
        searchPlaceholder="Buscar clube/estádio/cidade..."
        emptyText="Nenhum encontrado."
        className="h-8 w-56 text-xs"
      />
    </div>
  );
}

/**
 * Shows every club/estádio/cidade an import would newly register before it
 * happens, so nothing gets created silently. For each one, the user can
 * either let it be cadastrado (default) or link it to a record that already
 * exists (e.g. the FAF site's full name "Chute Inicial - Quebrangulo" vs the
 * already-registered "Chute Inicial") — avoids the duplicate-club bug this
 * screen exists to prevent. Confirming doesn't create/link anything itself —
 * it just returns the chosen aliases so the caller can rewrite the rows
 * before running the same dataStore.importMatchesForCompetition it always
 * called (see applyEntityAliases in importPreview.ts).
 */
export function UnmatchedEntitiesDialog({ open, entities, store, onCancel, onConfirm }: UnmatchedEntitiesDialogProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});

  const clubOptions = [...store.clubs].sort((a, b) => a.shortName.localeCompare(b.shortName)).map((club) => ({ value: club.id, label: club.shortName }));
  const stadiumOptions = [...store.stadiums].sort((a, b) => a.name.localeCompare(b.name)).map((stadium) => ({ value: stadium.id, label: stadium.name }));
  const cityOptions = [...store.cities].sort((a, b) => a.name.localeCompare(b.name)).map((city) => ({ value: city.id, label: city.name }));

  function selectionFor(key: string): string {
    return selections[key] ?? NEW_RECORD;
  }

  function setSelection(key: string, value: string) {
    setSelections((prev) => ({ ...prev, [key]: value }));
  }

  function handleConfirm() {
    const aliases = emptyEntityAliases();
    for (const name of entities?.clubs ?? []) {
      const value = selectionFor(`club:${name}`);
      if (value !== NEW_RECORD) aliases.clubs.set(name, value);
    }
    for (const name of entities?.stadiums ?? []) {
      const value = selectionFor(`stadium:${name}`);
      if (value !== NEW_RECORD) aliases.stadiums.set(name, value);
    }
    for (const name of entities?.cities ?? []) {
      const value = selectionFor(`city:${name}`);
      if (value !== NEW_RECORD) aliases.cities.set(name, value);
    }
    setSelections({});
    onConfirm(aliases);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Foram encontrados registros ainda não cadastrados</DialogTitle>
          <DialogDescription>
            Por padrão, cada item abaixo vai ser cadastrado como um registro novo. Se algum já existe com outro nome (ex.:
            "Chute Inicial - Quebrangulo" da FAF é o mesmo "Chute Inicial" já cadastrado), selecione-o para linkar em vez de
            duplicar.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-96 space-y-4 overflow-y-auto">
          {(entities?.clubs.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Clubes</p>
              {entities!.clubs.map((name) => (
                <EntityRow
                  key={name}
                  name={name}
                  options={clubOptions}
                  value={selectionFor(`club:${name}`)}
                  onChange={(value) => setSelection(`club:${name}`, value)}
                />
              ))}
            </div>
          )}

          {(entities?.stadiums.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Estádios</p>
              {entities!.stadiums.map((name) => (
                <EntityRow
                  key={name}
                  name={name}
                  options={stadiumOptions}
                  value={selectionFor(`stadium:${name}`)}
                  onChange={(value) => setSelection(`stadium:${name}`, value)}
                />
              ))}
            </div>
          )}

          {(entities?.cities.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Cidades</p>
              {entities!.cities.map((name) => (
                <EntityRow
                  key={name}
                  name={name}
                  options={cityOptions}
                  value={selectionFor(`city:${name}`)}
                  onChange={(value) => setSelection(`city:${name}`, value)}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
