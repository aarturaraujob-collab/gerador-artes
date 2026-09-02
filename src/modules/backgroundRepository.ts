import { supabase } from "@/lib/supabaseClient";

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

interface BackgroundRow {
  id: string;
  name: string;
  data_uri: string;
}

function fromRow(row: BackgroundRow): BackgroundAsset {
  return { id: row.id, name: row.name, dataUri: row.data_uri };
}

function toRow(asset: BackgroundAsset): BackgroundRow {
  return { id: asset.id, name: asset.name, data_uri: asset.dataUri };
}

/** Persists the reusable background library in Supabase — one upload, usable by any competition. */
export class BackgroundRepository {
  async list(): Promise<BackgroundAsset[]> {
    const { data, error } = await supabase.from("backgrounds").select("*");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async seedIfEmpty(): Promise<BackgroundAsset[]> {
    const existing = await this.list();
    if (existing.length > 0) return existing;

    const { error } = await supabase.from("backgrounds").insert(SEED_BACKGROUNDS.map(toRow));
    if (error) throw error;
    return SEED_BACKGROUNDS;
  }

  async upsert(record: BackgroundAsset): Promise<void> {
    const { error } = await supabase.from("backgrounds").upsert(toRow(record));
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("backgrounds").delete().eq("id", id);
    if (error) throw error;
  }
}

export const backgroundRepository = new BackgroundRepository();
