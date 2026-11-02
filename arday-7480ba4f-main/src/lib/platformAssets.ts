export function normalizeAssetUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  try {
    const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');
    const absolute = new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, `${apiBase}/`).toString();
    return absolute;
  } catch {
    return trimmed.startsWith('/') ? `${window.location.origin}${trimmed}` : trimmed;
  }
}
