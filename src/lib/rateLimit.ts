/**
 * In-memory rate limiter using Fixed Window approach.
 * Note: In serverless environments (like Vercel), this memory is cleared between cold starts.
 * For production with high traffic, consider using Upstash Redis.
 */
interface RateLimitInfo {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitInfo>();

export function rateLimit(identifier: string, limit: number, windowMs: number): { success: boolean; headers: Record<string, string> } {
  const now = Date.now();
  const record = store.get(identifier);

  // Clear expired records periodically to prevent memory leaks
  if (Math.random() < 0.05) {
    for (const [key, val] of store.entries()) {
      if (now > val.resetTime) {
        store.delete(key);
      }
    }
  }

  if (!record || now > record.resetTime) {
    // First request or window expired
    store.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': (limit - 1).toString(),
        'X-RateLimit-Reset': (now + windowMs).toString(),
      },
    };
  }

  // Inside window
  if (record.count >= limit) {
    return {
      success: false,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': record.resetTime.toString(),
        'Retry-After': Math.ceil((record.resetTime - now) / 1000).toString(),
      },
    };
  }

  // Increment
  record.count += 1;
  store.set(identifier, record);

  return {
    success: true,
    headers: {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': (limit - record.count).toString(),
      'X-RateLimit-Reset': record.resetTime.toString(),
    },
  };
}
