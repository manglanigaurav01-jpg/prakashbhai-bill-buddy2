/**
 * CORS Handler for Bill Buddy App
 *
 * Manages Cross-Origin Resource Sharing (CORS) security
 * with configurable allowed origins, methods, and headers.
 */

export interface CORSConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  allowCredentials: boolean;
  maxAge: number; // in seconds
  optionsSuccessStatus: number;
}

export interface CORSResult {
  allowed: boolean;
  headers: Record<string, string>;
  error?: string;
}

export class CORSHandler {
  private static readonly DEFAULT_CONFIG: CORSConfig = {
    allowedOrigins: ['http://localhost:3000', ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers'
    ],
    exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
    allowCredentials: true,
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 204
  };

  private static config: CORSConfig = { ...this.DEFAULT_CONFIG };

  /**
   * Configure CORS settings
   */
  public static configure(config: Partial<CORSConfig>): void {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  /**
   * Handle CORS preflight request
   */
  public static handlePreflight(
    origin: string | undefined,
    method: string,
    headers: string[] = []
  ): CORSResult {
    const corsCheck = this.checkOrigin(origin);
    if (!corsCheck.allowed) {
      return {
        allowed: false,
        headers: {},
        error: corsCheck.error
      };
    }

    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': this.config.allowedMethods.join(', '),
      'Access-Control-Allow-Headers': this.config.allowedHeaders.join(', '),
      'Access-Control-Max-Age': this.config.maxAge.toString(),
      'Access-Control-Allow-Credentials': this.config.allowCredentials.toString()
    };

    if (this.config.exposedHeaders.length > 0) {
      corsHeaders['Access-Control-Expose-Headers'] = this.config.exposedHeaders.join(', ');
    }

    return {
      allowed: true,
      headers: corsHeaders
    };
  }

  /**
   * Handle actual CORS request
   */
  public static handleRequest(origin: string | undefined): CORSResult {
    const corsCheck = this.checkOrigin(origin);
    if (!corsCheck.allowed) {
      return {
        allowed: false,
        headers: {},
        error: corsCheck.error
      };
    }

    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Credentials': this.config.allowCredentials.toString()
    };

    if (this.config.exposedHeaders.length > 0) {
      corsHeaders['Access-Control-Expose-Headers'] = this.config.exposedHeaders.join(', ');
    }

    return {
      allowed: true,
      headers: corsHeaders
    };
  }

  /**
   * Check if origin is allowed
   */
  private static checkOrigin(origin: string | undefined): { allowed: boolean; error?: string } {
    // If no origin specified and credentials not required, allow
    if (!origin && !this.config.allowCredentials) {
      return { allowed: true };
    }

    // If no origin specified but credentials required, deny
    if (!origin && this.config.allowCredentials) {
      return { allowed: false, error: 'Origin required for credentialed requests' };
    }

    // Check if origin is in allowed list
    if (this.config.allowedOrigins.includes('*')) {
      return { allowed: true };
    }

    if (origin && this.config.allowedOrigins.includes(origin)) {
      return { allowed: true };
    }

    return { allowed: false, error: `Origin '${origin}' not allowed` };
  }

  /**
   * Validate request method
   */
  public static isMethodAllowed(method: string): boolean {
    return this.config.allowedMethods.includes(method.toUpperCase());
  }

  /**
   * Validate request headers
   */
  public static validateHeaders(requestHeaders: string[]): { valid: boolean; invalidHeaders: string[] } {
    const invalidHeaders: string[] = [];

    for (const header of requestHeaders) {
      if (!this.config.allowedHeaders.includes(header)) {
        invalidHeaders.push(header);
      }
    }

    return {
      valid: invalidHeaders.length === 0,
      invalidHeaders
    };
  }

  /**
   * Get CORS configuration
   */
  public static getConfig(): CORSConfig {
    return { ...this.config };
  }

  /**
   * Add allowed origin dynamically
   */
  public static addAllowedOrigin(origin: string): void {
    if (!this.config.allowedOrigins.includes(origin)) {
      this.config.allowedOrigins.push(origin);
    }
  }

  /**
   * Remove allowed origin
   */
  public static removeAllowedOrigin(origin: string): void {
    this.config.allowedOrigins = this.config.allowedOrigins.filter(o => o !== origin);
  }

  /**
   * Check if CORS is properly configured for production
   */
  public static validateProductionConfig(): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    // Check for wildcard origin in production
    if (this.config.allowedOrigins.includes('*') && this.config.allowCredentials) {
      warnings.push('Wildcard origin (*) with credentials is insecure');
    }

    // Check for localhost in production config
    if (this.config.allowedOrigins.some(origin => origin.includes('localhost'))) {
      warnings.push('Localhost origins should not be in production config');
    }

    // Check for HTTP origins in production
    if (this.config.allowedOrigins.some(origin => origin.startsWith('http://') && !origin.includes('localhost'))) {
      warnings.push('HTTP origins should not be allowed in production');
    }

    return {
      valid: warnings.length === 0,
      warnings
    };
  }

  /**
   * Generate CORS headers for manual response
   */
  public static generateHeaders(origin?: string): Record<string, string> {
    const headers: Record<string, string> = {};

    if (origin && this.checkOrigin(origin).allowed) {
      headers['Access-Control-Allow-Origin'] = origin;
    } else if (!this.config.allowCredentials) {
      headers['Access-Control-Allow-Origin'] = '*';
    }

    if (this.config.allowCredentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    if (this.config.exposedHeaders.length > 0) {
      headers['Access-Control-Expose-Headers'] = this.config.exposedHeaders.join(', ');
    }

    return headers;
  }
}
