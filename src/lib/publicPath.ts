/** Builds a URL for an asset published from Vite's configured base path. */
export function publicPath(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}
