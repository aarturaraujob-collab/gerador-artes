import { AssetRepository } from "@/engine/assets/AssetRepository";
import { TemplateResolver } from "@/engine/core/TemplateResolver";
import { BatchRenderService } from "@/engine/render/BatchRenderService";
import { MatchTemplateRenderer } from "@/engine/render/MatchTemplateRenderer";
import { StandingsTemplateRenderer } from "@/engine/render/StandingsTemplateRenderer";
import { SpreadsheetImporter } from "@/engine/import/SpreadsheetImporter";
import { dataStore } from "@/modules/dataStore";

// Compose the engine once, bound to the single data store. Everything visual —
// asset resolution, rendering, batching, import — hangs off these instances.
const templates = new TemplateResolver();
const assets = new AssetRepository(dataStore);
const renderer = new MatchTemplateRenderer(dataStore, templates, assets);

export const batchRenderService = new BatchRenderService(templates, renderer);
export const standingsTemplateRenderer = new StandingsTemplateRenderer(dataStore, templates, assets);
export const templateResolver = templates;
export const assetRepository = assets;
export const spreadsheetImporter = new SpreadsheetImporter(dataStore);

export { readSvgDimensions } from "@/engine/render/BatchRenderService";
export type { RenderResult } from "@/engine/render/BatchRenderService";
export { availableFormats } from "@/engine/core/TemplateConfig";
export type { TemplateFormat } from "@/engine/core/TemplateConfig";

// Template introspection (Sprint 06) — a separate, read-only layer that
// analyzes a raw SVG's structure. Not wired into the render pipeline above;
// exported here only so future consumers (a template import screen, a
// visual editor) can reach it through the engine's public surface.
export { TemplateLoader } from "@/engine/template-intelligence";
export type { LoadedTemplate, TemplateField, TemplateMetadata, ValidationReport } from "@/engine/template-intelligence";
