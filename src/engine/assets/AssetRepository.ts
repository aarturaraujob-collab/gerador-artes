import type { DataStore } from "@/modules/dataStore";

const FALLBACK_CLUB_SHIELD = "/assets/logos/faf.png";

export class AssetRepository {
  private readonly dataUriCache = new Map<string, Promise<string>>();

  constructor(private readonly store: DataStore) {}

  getClubShieldPath(clubId: string): string {
    return this.store.clubsById.get(clubId)?.shield || FALLBACK_CLUB_SHIELD;
  }

  getImageDataUri(path: string): Promise<string> {
    const cached = this.dataUriCache.get(path);
    if (cached) return cached;
    const dataUri = fetch(path).then(async (response) => {
      if (!response.ok) throw new Error(`Asset não encontrado: ${path}`);
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    });
    this.dataUriCache.set(path, dataUri);
    return dataUri;
  }

  getClubShieldDataUri(clubId: string): Promise<string> {
    return this.getImageDataUri(this.getClubShieldPath(clubId));
  }
}
