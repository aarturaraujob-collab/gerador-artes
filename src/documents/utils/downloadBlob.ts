/** Desktop Chrome/Edge also implement Web Share, where popping the OS share sheet
 * instead of just downloading would be a regression — so sharing is only attempted
 * on actual mobile devices, which is where `a.download` silently fails to save. */
function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Saves a Blob to the device. On iOS Safari/WebViews, `a.download` on a blob/data
 * URI silently fails to save the file (it just opens the image) while still
 * resolving without error — so callers would show a false "downloaded" toast.
 * Web Share API actually hands the file to the OS share sheet, so it's used
 * on mobile whenever the platform supports sharing files.
 */
export async function triggerBlobDownload(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  if (isMobileDevice() && nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return; // user cancelled the share sheet
      // Sharing failed for some other reason — fall through to the anchor-download path.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
