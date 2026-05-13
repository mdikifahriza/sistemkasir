/**
 * Utility to ensure media URLs are correctly proxied through the internal API
 * for privacy and consistency.
 */
export function getMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  // If it's already an internal API path with query param, return it
  if (url.startsWith('/api/upload?path=')) return url;
  
  // If it's a full Cloudflare URL, extract the path and convert to internal proxy
  if (url.includes('.r2.dev/')) {
    const parts = url.split('.r2.dev/');
    if (parts.length > 1) {
      return `/api/upload?path=${parts[1]}`;
    }
  }
  
  // Handle the 'undefined/' prefix issue from previous misconfiguration
  if (url.startsWith('undefined/')) {
    const path = url.replace('undefined/', '');
    return `/api/upload?path=${path}`;
  }

  // If it's just a raw path (e.g. 'products/abc.jpg'), convert to internal proxy
  if (!url.startsWith('http') && !url.startsWith('/') && !url.startsWith('blob:') && !url.startsWith('data:')) {
    return `/api/upload?path=${url}`;
  }
  
  return url;
}
