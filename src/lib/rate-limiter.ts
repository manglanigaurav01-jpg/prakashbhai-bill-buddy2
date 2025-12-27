/**
 * Rate Limiter for Bill Buddy App
 *
 * Prevents abuse by limiting the number of requests per time window.
 * Uses localStorage for client-side rate limiting.
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
  blockDurationMs: number; // How long to block after limit exceeded
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
  blockedUntil?: number;
}

export class RateLimiter {
  private static instances: Map<string, RateLimiter> = new Map();

  private config: RateLimitConfig;
  private storageKey: string;

  private constructor(identifier: string, config: RateLimitConfig) {
    this.config = config;
    this.storageKey = `rate_limit_${identifier}`;
  }

  /**
   * Get or create a rate limiter instance
   */
  public static getInstance(identifier: string, config?: Partial<RateLimitConfig>): RateLimiter {
    if (!RateLimiter.instances.has(identifier)) {
      const defaultConfig: RateLimitConfig = {
        maxRequests: 5,
        windowMs: 15 * 60 * 1000, // 15 minutes
        blockDurationMs: 60 * 60 * 1000, // 1 hour
        ...config
      };

      RateLimiter.instances.set(identifier, new RateLimiter(identifier, defaultConfig));
    }

    return RateLimiter.instances.get(identifier)!;
  }

  /**
   * Check if request is allowed
   */
  public checkLimit(): RateLimitResult {
    const now = Date.now();
    const data = this.getStoredData();

    // Check if currently blocked
    if (data.blockedUntil && now < data.blockedUntil) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: data.blockedUntil,
        blockedUntil: data.blockedUntil
      };
    }

    // Reset if window has passed
    if (now - data.windowStart >= this.config.windowMs) {
      data.requests = 0;
      data.windowStart = now;
      data.blockedUntil = undefined;
    }

    const remainingRequests = Math.max(0, this.config.maxRequests - data.requests);

    if (data.requests >= this.config.maxRequests) {
      // Block the user
      data.blockedUntil = now + this.config.blockDurationMs;
      this.saveData(data);

      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: data.blockedUntil,
        blockedUntil: data.blockedUntil
      };
    }

    // Allow the request
    return {
      allowed: true,
      remainingRequests: remainingRequests - 1,
      resetTime: data.windowStart + this.config.windowMs
    };
  }

  /**
   * Record a successful request
   */
  public recordRequest(): void {
    const data = this.getStoredData();
    data.requests += 1;
    this.saveData(data);
  }

  /**
   * Reset rate limit (admin function)
   */
  public reset(): void {
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Get current status
   */
  public getStatus(): {
    requests: number;
    maxRequests: number;
    windowStart: number;
    blockedUntil?: number;
    isBlocked: boolean;
  } {
    const data = this.getStoredData();
    const now = Date.now();

    return {
      requests: data.requests,
      maxRequests: this.config.maxRequests,
      windowStart: data.windowStart,
      blockedUntil: data.blockedUntil,
      isBlocked: !!(data.blockedUntil && now < data.blockedUntil)
    };
  }

  private getStoredData(): {
    requests: number;
    windowStart: number;
    blockedUntil?: number;
  } {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate data structure
        if (typeof parsed.requests === 'number' &&
            typeof parsed.windowStart === 'number') {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Invalid rate limit data, resetting:', error);
    }

    // Return default data
    return {
      requests: 0,
      windowStart: Date.now()
    };
  }

  private saveData(data: any): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save rate limit data:', error);
    }
  }
}

// Pre-configured rate limiters for common operations
export const loginRateLimiter = RateLimiter.getInstance('login', {
  maxRequests: 5, // 5 attempts
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 60 * 60 * 1000 // 1 hour block
});

export const signupRateLimiter = RateLimiter.getInstance('signup', {
  maxRequests: 3, // 3 attempts
  windowMs: 60 * 60 * 1000, // 1 hour
  blockDurationMs: 60 * 60 * 1000 // 1 hour block
});

export const passwordResetRateLimiter = RateLimiter.getInstance('password_reset', {
  maxRequests: 3, // 3 attempts
  windowMs: 60 * 60 * 1000, // 1 hour
  blockDurationMs: 60 * 60 * 1000 // 1 hour block
});

export const apiRateLimiter = RateLimiter.getInstance('api', {
  maxRequests: 100, // 100 requests
  windowMs: 60 * 1000, // 1 minute
  blockDurationMs: 5 * 60 * 1000 // 5 minute block
});

export const formRateLimiter = RateLimiter.getInstance('form', {
  maxRequests: 20, // 20 submissions
  windowMs: 10 * 60 * 1000, // 10 minutes
  blockDurationMs: 30 * 60 * 1000 // 30 minute block
});

/**
 * Check rate limit before operation
 * @param limiter - Rate limiter instance
 * @param operation - Function to execute if allowed
 * @returns Result of operation or rate limit error
 */
export async function withRateLimit<T>(
  limiter: RateLimiter,
  operation: () => Promise<T>
): Promise<T | { error: string; retryAfter?: number }> {
  const result = limiter.checkLimit();

  if (!result.allowed) {
    const retryAfter = result.blockedUntil
      ? Math.ceil((result.blockedUntil - Date.now()) / 1000)
      : undefined;

    return {
      error: 'Rate limit exceeded. Please try again later.',
      retryAfter
    } as any;
  }

  try {
    const operationResult = await operation();
    limiter.recordRequest();
    return operationResult;
  } catch (error) {
    // Don't count failed requests against rate limit
    return error as any;
  }
}

/**
 * Get user-friendly rate limit message
 */
export function getRateLimitMessage(result: RateLimitResult): string {
  if (result.allowed) {
    return `Requests remaining: ${result.remainingRequests}`;
  }

  if (result.blockedUntil) {
    const minutesLeft = Math.ceil((result.blockedUntil - Date.now()) / (60 * 1000));
    return `Too many attempts. Try again in ${minutesLeft} minutes.`;
  }

  const minutesLeft = Math.ceil((result.resetTime - Date.now()) / (60 * 1000));
  return `Rate limit exceeded. Try again in ${minutesLeft} minutes.`;
}
