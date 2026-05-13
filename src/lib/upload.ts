/**
 * Media upload helper mapping to the R2 upload endpoint.
 */
import { assertOnline, OFFLINE_DISABLED_MESSAGE, isLikelyNetworkError } from '@/lib/network';

export async function uploadMedia(
  file: File,
  pathPrefix: string = 'general'
): Promise<{ publicUrl: string }> {
  assertOnline();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('pathPrefix', pathPrefix);

  let res: Response;
  try {
    res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    if (isLikelyNetworkError(error)) {
      throw new Error(OFFLINE_DISABLED_MESSAGE);
    }
    throw error;
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Gagal mengunggah file');
  }

  const { data } = await res.json();
  return { publicUrl: data.publicUrl };
}
