import { AssetRepository } from "@/engine/assets/AssetRepository";
import { TemplateResolver } from "@/engine/core/TemplateResolver";
import { BatchRenderService } from "@/engine/render/BatchRenderService";
import { MatchTemplateRenderer } from "@/engine/render/MatchTemplateRenderer";
import { SpreadsheetImporter } from "@/engine/import/SpreadsheetImporter";
import { dataStore } from "@/modules/dataStore";

// Compose the engine once, bound to the single data store. Everything visual —
// asset resolution, rendering, batching, import — hangs off these instances.
const templates = new TemplateResolver();
const assets = new AssetRepository(dataStore);
const renderer = new MatchTemplateRenderer(dataStore, templates, assets);

export const batchRenderService = new BatchRenderService(templates, renderer);
export const assetRepository = assets;
export const spreadsheetImporter = new SpreadsheetImporter(dataStore);

export type { RenderResult } from "@/engine/render/BatchRenderService";
