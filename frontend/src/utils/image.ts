/** Derive full-resolution URL from a thumbnail AVIF URL.
 *
 * Convention: thumbnails are `{uuid}.avif`, full-res companions are `{uuid}.full.avif`.
 * Returns null if the URL is missing or not an AVIF file.
 */
export function getFullResUrl(thumbUrl: string | null | undefined): string | null {
  if (!thumbUrl?.endsWith('.avif')) return null;
  return thumbUrl.replace(/\.avif$/, '.full.avif');
}
