import type { SvgFieldType } from "./types";

/**
 * Mirrors — deliberately as a separate, read-only copy, not an import — the
 * id-prefix classification src/engine/document/SvgDocument.ts's private
 * index() already uses to drive the live renderer. This introspection layer
 * must never import from (or risk changing behavior of) the active render
 * engine, per Sprint 06's "não alterar o motor existente". Keep this in sync
 * by hand if that convention ever changes.
 */
export function classifyByIdPrefix(id: string): SvgFieldType {
  if (id.startsWith("txt_")) return "text";
  if (id.startsWith("img_")) return "image";
  if (id.startsWith("grp_")) return "group";
  return "shape";
}

/**
 * Splits a numbered slot suffix off an id — the inverse of
 * MatchTemplateRenderer's slotId(base, index) (`base` for slot 0,
 * `${base}_${index + 1}` for slot index > 0): "img_escudo_mandante_2" ->
 * { baseId: "img_escudo_mandante", slotIndex: 1 }. An id with no numeric
 * suffix — or one ending in "_1" (that convention never emits it — slot 0 is
 * always the bare base id) — is treated as its own base id at slot 0.
 *
 * This is a heuristic, not a guarantee: an id that's genuinely just named
 * "..._2" on its own (not a slot variant of a shorter base id that also
 * exists) will still get split. Good enough for grouping the txt_/img_
 * per-match fields the renderer actually depends on; CP7 leaves refining
 * this to future work.
 */
export function parseSlot(id: string): { baseId: string; slotIndex: number } {
  const match = id.match(/^(.+)_(\d+)$/);
  if (!match) return { baseId: id, slotIndex: 0 };

  const [, base, digits] = match;
  const slotNumber = Number(digits);
  if (!Number.isFinite(slotNumber) || slotNumber < 2) return { baseId: id, slotIndex: 0 };

  return { baseId: base, slotIndex: slotNumber - 1 };
}
