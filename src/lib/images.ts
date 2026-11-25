/** Resolve caminho do Storage (bucket "products") ou URL https absoluta. */
export function productImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https:\/\//.test(path)) return path;
  if (path.startsWith("/")) return path; // arquivo local em /public (somente dev/demonstração)
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/products/${path.split("/").map(encodeURIComponent).join("/")}`;
}
