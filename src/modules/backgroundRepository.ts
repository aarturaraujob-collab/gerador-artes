import { getStore, promisify } from "./db";

export interface BackgroundAsset {
  id: string;
  name: string;
  /** Filename under public/assets/backgrounds/, or a data: URI from an upload — same convention AssetRepository already resolves. */
  dataUri: string;
}

/** The backgrounds already shipped on disk, registered so the library starts non-empty. */
const SEED_BACKGROUNDS: BackgroundAsset[] = [
  { id: "bg-default", name: "Padrão", dataUri: "bg_default.png" },
  { id: "bg-thumbnail", name: "Thumbnail padrão", dataUri: "bg_thumbnail.png" },
  { id: "bg-thumbnail-20a1", name: "Thumbnail Sub-20 Série A1", dataUri: "bg_thumbnail_20a1.png" },
  { id: "bg-thumbnail-20a2", name: "Thumbnail Sub-20 Série A2", dataUri: "bg_thumbnail_20a2.png" },
];

/** Persists the reusable background library in IndexedDB — one upload, usable by any competition. */
export class BackgroundRepository {
  async list(): Promise<BackgroundAsset[]> {
    const store = await getStore("backgrounds", "readonly");
    return promisify(store.getAll());
  }

  async seedIfEmpty(): Promise<BackgroundAsset[]> {
    const existing = await this.list();
    if (existing.length > 0) return existing;

    const store = await getStore("backgrounds", "readwrite");
    for (const record of SEED_BACKGROUNDS) store.put(record);
    return SEED_BACKGROUNDS;
  }

  async upsert(record: BackgroundAsset): Promise<void> {
    const store = await getStore("backgrounds", "readwrite");
    store.put(record);
  }

  async remove(id: string): Promise<void> {
    const store = await getStore("backgrounds", "readwrite");
    store.delete(id);
  }
}

export const backgroundRepository = new BackgroundRepository();
