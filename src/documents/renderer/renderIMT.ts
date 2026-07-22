import imtTemplate from "../templates/imt.html?raw";
import type { IMTPlaceholders } from "../types/imt";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Loads imt.html and substitutes every {{placeholder}} with the matching
 * field from `placeholders`. Pure string substitution only — no PDF export,
 * no data access, no conditionals/loops (the template itself has none
 * either). Values are HTML-escaped since some of them (motivo, solicitante,
 * responsável) come from free-text user input.
 */
export function renderIMT(placeholders: IMTPlaceholders): string {
  return imtTemplate.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = (placeholders as unknown as Record<string, string>)[key];
    return value !== undefined ? escapeHtml(value) : match;
  });
}
