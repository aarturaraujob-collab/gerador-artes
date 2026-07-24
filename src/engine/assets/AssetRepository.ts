import type { DataStore } from "@/modules/dataStore";

const ESCUDOS_DIR = "/assets/escudos";
const LOGOS_DIR = "/assets/logos";
const BACKGROUNDS_DIR = "/assets/backgrounds";
const RODADAS_DIR = "/assets/rodadas";

const FALLBACK_CLUB_SHIELD = `${LOGOS_DIR}/faf.png`;

function stripDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Resolves a stored asset value against a directory convention. Values that
 * are already a complete reference — a Data URI from an upload, or an
 * absolute path — pass through untouched; anything else is treated as a
 * filename living in `dir`. This is what lets uploaded assets (stored as
 * Data URIs) and shipped assets (stored as filenames) share one resolver.
 */
function resolveAssetValue(value: string, dir: string): string {
  if (value.startsWith("data:") || value.startsWith("/")) return value;
  return `${dir}/${value}`;
}

/**
 * Single source of truth for every visual asset (shields, backgrounds,
 * round images). No React component or renderer builds asset paths on its own —
 * everything resolves here so conventions live in exactly one place.
 */
export class AssetRepository {
  private readonly dataUriCache = new Map<string, Promise<string>>();

  constructor(private readonly store: DataStore) {}

  // ─── Escudos (clubs) ──────────────────────────────────────────────────────

  /**
   * Resolves a club shield path. Uses the club's `shield` field when set,
   * otherwise derives it from the club id (`inter-arabia` → `inter_arabia.png`).
   * Missing assets fall back at load time to the FAF badge.
   */
  clubShieldPath(clubId: string): string {
    const club = this.store.clubsById.get(clubId);
    const shield = club?.shield?.trim();
    if (shield) return resolveAssetValue(shield, ESCUDOS_DIR);
    return `${ESCUDOS_DIR}/${clubId.replace(/-/g, "_")}.png`;
  }

  getClubShieldDataUri(clubId: string): Promise<string> {
    return this.getImageDataUri(this.clubShieldPath(clubId), FALLBACK_CLUB_SHIELD);
  }

  // ─── Backgrounds ──────────────────────────────────────────────────────────

  backgroundPath(name: string): string {
    return resolveAssetValue(name, BACKGROUNDS_DIR);
  }

  async getBackgroundDataUri(name: string): Promise<string | null> {
    return this.tryImageDataUri(this.backgroundPath(name));
  }

  /**
   * Resolves a competition's own thumbnail background, if one is registered.
   * Returns null when the competition has none (or isn't found, or the file
   * fails to load) — callers should leave the template's own default in
   * place rather than treating this as an error.
   */
  async getCompetitionBackgroundDataUri(competitionId: string): Promise<string | null> {
    const competition = this.store.competitions.find((item) => item.id === competitionId);
    const background = competition?.background.thumb?.trim();
    if (!background) return null;
    return this.getBackgroundDataUri(background);
  }

  // ─── Competition logos ────────────────────────────────────────────────────

  /** Resolves a competition logo value to a displayable path — same convention as clubShieldPath, for <img src>. */
  logoPath(logo: string): string {
    return resolveAssetValue(logo, LOGOS_DIR);
  }

  /**
   * Resolves a competition's logo, if one is registered. Same contract as
   * the background resolver: null (never a throw) when there's nothing to
   * show, so a template without this data simply keeps its own artwork.
   */
  async getCompetitionLogoDataUri(competitionId: string): Promise<string | null> {
    const competition = this.store.competitions.find((item) => item.id === competitionId);
    const logo = competition?.logo?.trim();
    if (!logo) return null;
    return this.tryImageDataUri(resolveAssetValue(logo, LOGOS_DIR));
  }

  // ─── Round images (img_rodada) ────────────────────────────────────────────

  /**
   * Maps a match round label to a round-image file. Numeric rounds map to
   * `img_rodada<N>.png`; knockout phases map to their named files, optionally
   * with an `_ida`/`_volta` leg suffix. Returns null when nothing matches.
   */
  roundImagePath(round: string): string | null {
    const normalized = stripDiacritics(round);
    if (!normalized) return null;

    const numeric = normalized.match(/(\d+)/);
    if (numeric) return `${RODADAS_DIR}/img_rodada${numeric[1]}.png`;

    const phases: Array<[RegExp, string]> = [
      [/oitav/, "oitavas"],
      [/quart/, "quartas"],
      [/semi/, "semifinal"],
      [/final/, "final"],
    ];
    const phase = phases.find(([pattern]) => pattern.test(normalized))?.[1];
    if (!phase) return null;

    const leg = /volta/.test(normalized) ? "_volta" : /ida/.test(normalized) ? "_ida" : "";
    return `${RODADAS_DIR}/img_rodada_${phase}${leg}.png`;
  }

  async getRoundImageDataUri(round: string): Promise<string | null> {
    const path = this.roundImagePath(round);
    if (!path) return null;
    return this.tryImageDataUri(path);
  }

  // ─── Generic loading ──────────────────────────────────────────────────────

  getImageDataUri(path: string, fallback?: string): Promise<string> {
    if (path.startsWith("data:")) return Promise.resolve(path);

    const cached = this.dataUriCache.get(path);
    if (cached) return cached;

    const dataUri = fetch(path)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Asset não encontrado: ${path}`);
        return toDataUri(await response.blob());
      })
      .catch((error: unknown) => {
        if (fallback && fallback !== path) return this.getImageDataUri(fallback);
        throw error;
      });

    this.dataUriCache.set(path, dataUri);
    return dataUri;
  }

  private async tryImageDataUri(path: string): Promise<string | null> {
    try {
      return await this.getImageDataUri(path);
    } catch {
      return null;
    }
  }
}

function toDataUri(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
