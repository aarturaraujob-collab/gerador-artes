import { supabase } from "@/lib/supabaseClient";

/** One YouTube video linked to a competition edition — shown in FAF Lab's Mídia tab. */
export interface FafLabMedia {
  id: string;
  competitionId: string;
  title: string;
  youtubeId: string;
}

interface FafLabMediaRow {
  id: string;
  competition_id: string;
  title: string;
  youtube_id: string;
}

function fromRow(row: FafLabMediaRow): FafLabMedia {
  return { id: row.id, competitionId: row.competition_id, title: row.title, youtubeId: row.youtube_id };
}

/** Accepts a bare video id, or a youtube.com/watch, youtu.be, or /embed/ URL. */
export function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1) || null;
    if (url.pathname.startsWith("/embed/")) return url.pathname.replace("/embed/", "") || null;
    return url.searchParams.get("v");
  } catch {
    return null;
  }
}

export class FafLabMediaRepository {
  async listByCompetition(competitionId: string): Promise<FafLabMedia[]> {
    const { data, error } = await supabase
      .from("faflab_media")
      .select("*")
      .eq("competition_id", competitionId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async add(media: FafLabMedia): Promise<void> {
    const { error } = await supabase.from("faflab_media").insert({
      id: media.id,
      competition_id: media.competitionId,
      title: media.title,
      youtube_id: media.youtubeId,
    });
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("faflab_media").delete().eq("id", id);
    if (error) throw error;
  }
}

export const faflabMediaRepository = new FafLabMediaRepository();
