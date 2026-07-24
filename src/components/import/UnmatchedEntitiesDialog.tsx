import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { UnmatchedEntities } from "@/modules/importPreview";

export interface UnmatchedEntitiesDialogProps {
  open: boolean;
  entities: UnmatchedEntities | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function EntityList({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-semibold text-foreground-secondary">{label}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-foreground">
        {names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Shows every club/estádio/cidade a CSV import would newly register before
 * it happens, so nothing gets created silently. Confirming doesn't do the
 * creation itself — it just lets the caller proceed to the same
 * dataStore.importMatchesForCompetition it would already call, which is
 * still the only place that creates these records.
 */
export function UnmatchedEntitiesDialog({ open, entities, onCancel, onConfirm }: UnmatchedEntitiesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Foram encontrados registros ainda não cadastrados</DialogTitle>
          <DialogDescription>
            Esta importação vai cadastrar automaticamente os itens abaixo. Você pode completá-los
            (escudo, cidade, UF etc.) depois em Cadastros ou no Gerenciador de Assets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <EntityList label="Clubes" names={entities?.clubs ?? []} />
          <EntityList label="Estádios" names={entities?.stadiums ?? []} />
          <EntityList label="Cidades" names={entities?.cities ?? []} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm}>
            Cadastrar e continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
